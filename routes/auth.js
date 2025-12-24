// Authentication routes for customers and admins

const express = require("express");
const router = express.Router();
const db = require("./database");
const crypto = require("crypto");
const messageCentral = require("./messageCentral");
require("dotenv").config();

const SESSION_EXPIRY_HOURS = 90 * 24;
const ADMIN_SESSION_EXPIRY_HOURS = 24;
const OTP_EXPIRY_MINUTES = 10;
const MAX_OTP_ATTEMPTS = 5;
const otpStore = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [key, data] of otpStore.entries()) {
    if (now > data.expiresAt) otpStore.delete(key);
  }
}, 5 * 60 * 1000);

const hashPassword = (pwd) => crypto.createHash('sha256').update(pwd).digest('hex');
const validateMobile = (m) => /^[6-9]\d{9}$/.test(String(m).replace(/\D/g, ""));
const validateName = (n) => typeof n === "string" && n.trim().length >= 2 && /^[A-Za-z\s]+$/.test(n.trim());
const validateOTP = (o) => /^\d{6}$/.test(o);
const generateSessionId = () => crypto.randomBytes(32).toString("hex");
const getClientIp = (req) => req.headers["x-forwarded-for"]?.split(",")[0] || req.ip || "unknown";

const createSession = async (customerId, req) => {
  const sessionId = generateSessionId();
  const expiresAt = new Date(Date.now() + SESSION_EXPIRY_HOURS * 60 * 60 * 1000);
  
  await db.query(
    "INSERT INTO sessions (session_id, customer_id, ip_address, user_agent, expires_at) VALUES ($1, $2, $3, $4, $5)",
    [sessionId, customerId, getClientIp(req), req.headers["user-agent"] || "", expiresAt]
  );
  
  await db.query("DELETE FROM sessions WHERE expires_at < NOW()");
  
  return { sessionId, expiresAt };
};

const verifySession = async (sessionId) => {
  if (!sessionId) return null;
  
  const result = await db.query(
    "SELECT s.customer_id, c.name, c.phone FROM sessions s INNER JOIN customers c ON s.customer_id = c.customer_id WHERE s.session_id = $1 AND s.expires_at > NOW()",
    [sessionId]
  );
  
  if (result.rows.length === 0) return null;
  
  await db.query("UPDATE sessions SET last_activity = NOW() WHERE session_id = $1", [sessionId]);
  
  return {
    customerId: result.rows[0].customer_id,
    name: result.rows[0].name,
    phone: result.rows[0].phone
  };
};

router.post("/send-otp", async (req, res) => {
  try {
    const { phone, type, name } = req.body;
    
    if (!phone || !type) {
      return res.status(400).json({ success: false, message: "Phone number and type required." });
    }
    
    const mobile = String(phone).replace(/\D/g, "");
    if (!validateMobile(mobile)) {
      return res.status(400).json({ success: false, message: "Invalid mobile number." });
    }
    
    if (type === "register" && !validateName(name)) {
      return res.status(400).json({ success: false, message: "Valid name required." });
    }

    const existing = await db.query("SELECT customer_id FROM customers WHERE phone = $1", [mobile]);
    
    if (type === "login" && existing.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Customer not found. Please register." });
    }
    
    if (type === "register" && existing.rows.length > 0) {
      return res.status(409).json({ success: false, message: "Customer exists. Please login." });
    }

    const otpKey = `${mobile}_${type}`;
    otpStore.delete(otpKey);

    const smsResult = await messageCentral.sendOTP(mobile);
    if (!smsResult.success) {
      return res.status(500).json({ success: false, message: smsResult.error || "Failed to send OTP." });
    }

    otpStore.set(otpKey, {
      type,
      name: type === "register" ? name.trim() : null,
      attempts: 0,
      expiresAt: Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000,
      verified: false,
      verificationId: smsResult.verificationId
    });
    
    return res.json({ success: true, message: "OTP sent successfully" });
  } catch (error) {
    console.error("Send OTP error:", error);
    return res.status(500).json({ success: false, message: "Failed to send OTP." });
  }
});

router.post("/verify-otp", async (req, res) => {
  try {
    const { phone, otp, type } = req.body;
    
    if (!phone || !otp || !type) {
      return res.status(400).json({ success: false, message: "Phone, OTP, and type required." });
    }

    const mobile = String(phone).replace(/\D/g, "");
    const cleanOTP = String(otp).replace(/\D/g, "");
    
    if (!validateMobile(mobile)) {
      return res.status(400).json({ success: false, message: "Invalid mobile number." });
    }
    
    if (!validateOTP(cleanOTP)) {
      return res.status(400).json({ success: false, message: "OTP must be 6 digits." });
    }

    const otpKey = `${mobile}_${type}`;
    const otpRecord = otpStore.get(otpKey);
    
    if (!otpRecord || otpRecord.verified) {
      return res.status(400).json({ success: false, message: "No OTP found. Request new OTP." });
    }
    
    if (Date.now() > otpRecord.expiresAt) {
      otpStore.delete(otpKey);
      return res.status(400).json({ success: false, message: "OTP expired." });
    }
    
    if (otpRecord.attempts >= MAX_OTP_ATTEMPTS) {
      otpStore.delete(otpKey);
      return res.status(429).json({ success: false, message: "Too many attempts." });
    }

    const verifyResult = await messageCentral.verifyOTP(mobile, cleanOTP, otpRecord.verificationId);
    
    if (!verifyResult.success || !verifyResult.verified) {
      otpRecord.attempts++;
      return res.status(401).json({
        success: false,
        message: "Invalid OTP.",
        attemptsLeft: MAX_OTP_ATTEMPTS - otpRecord.attempts
      });
    }

    let customer;
    if (type === "register") {
      const result = await db.query(
        "INSERT INTO customers (name, phone) VALUES ($1, $2) RETURNING customer_id, name, phone",
        [otpRecord.name, mobile]
      );
      customer = result.rows[0];
    } else {
      const result = await db.query(
        "SELECT customer_id, name, phone FROM customers WHERE phone = $1",
        [mobile]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, message: "Customer not found." });
      }
      customer = result.rows[0];
    }

    await db.query("DELETE FROM sessions WHERE customer_id = $1", [customer.customer_id]);
    
    const { sessionId } = await createSession(customer.customer_id, req);
    
    res.cookie("sessionId", sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_EXPIRY_HOURS * 60 * 60 * 1000,
      path: "/"
    });
    
    otpStore.delete(otpKey);
    
    return res.json({
      success: true,
      message: type === "register" ? "Registration successful" : "Login successful",
      customer: { id: customer.customer_id, name: customer.name, phone: customer.phone }
    });
  } catch (error) {
    console.error("Verify OTP error:", error);
    return res.status(500).json({ success: false, message: "OTP verification failed." });
  }
});

router.get("/session-check", async (req, res) => {
  try {
    const session = await verifySession(req.cookies.sessionId);
    
    if (!session) {
      res.clearCookie("sessionId");
      return res.json({ authenticated: false });
    }
    
    const result = await db.query("SELECT dob FROM customers WHERE customer_id = $1", [session.customerId]);
    const hasDob = result.rows.length > 0 && result.rows[0].dob !== null;
    
    return res.json({
      authenticated: true,
      customer: {
        id: session.customerId,
        name: session.name,
        phone: session.phone,
        hasDob
      }
    });
  } catch (error) {
    console.error("Session check error:", error);
    res.clearCookie("sessionId");
    return res.json({ authenticated: false });
  }
});

router.post("/logout", async (req, res) => {
  try {
    if (req.cookies.sessionId) {
      await db.query("DELETE FROM sessions WHERE session_id = $1", [req.cookies.sessionId]);
    }
    res.clearCookie("sessionId");
    return res.json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    res.clearCookie("sessionId");
    return res.json({ success: true, message: "Logged out successfully" });
  }
});

const requireAuth = async (req, res, next) => {
  try {
    const session = await verifySession(req.cookies.sessionId);
    
    if (!session) {
      res.clearCookie("sessionId");
      return res.status(401).json({ success: false, message: "Authentication required" });
    }
    
    req.customer = session;
    next();
  } catch (error) {
    res.clearCookie("sessionId");
    return res.status(401).json({ success: false, message: "Authentication required" });
  }
};

const createAdminSession = async (adminId, req) => {
  const sessionId = generateSessionId();
  const expiresAt = new Date(Date.now() + ADMIN_SESSION_EXPIRY_HOURS * 60 * 60 * 1000);
  const userAgent = req.headers["user-agent"] || "";
  
  await db.query("DELETE FROM sessions WHERE admin_id = $1", [adminId]);
  
  await db.query(
    "INSERT INTO sessions (session_id, admin_id, user_agent, expires_at) VALUES ($1, $2, $3, $4)",
    [sessionId, adminId, userAgent, expiresAt]
  );
  
  await db.query("DELETE FROM sessions WHERE expires_at < NOW()");
  
  return { sessionId, expiresAt };
};

const verifyAdminSession = async (sessionId, req) => {
  if (!sessionId) return null;
  
  const currentUserAgent = req.headers["user-agent"] || "";
  
  const result = await db.query(
    `SELECT s.admin_id, s.user_agent, a.username 
     FROM sessions s 
     INNER JOIN admins a ON s.admin_id = a.admin_id 
     WHERE s.session_id = $1 AND s.expires_at > NOW() AND s.admin_id IS NOT NULL`,
    [sessionId]
  );
  
  if (result.rows.length === 0) return null;
  
  const session = result.rows[0];
  
  // Soft check: User-Agent mismatch warning only (no logout)
  if (session.user_agent && currentUserAgent && session.user_agent !== currentUserAgent) {
    console.warn(`Admin session User-Agent changed - Session: ${sessionId.substring(0, 8)}...`);
  }
  
  await db.query("UPDATE sessions SET last_activity = NOW() WHERE session_id = $1", [sessionId]);
  
  return {
    adminId: session.admin_id,
    username: session.username
  };
};

router.post("/admin/signup", async (req, res) => {
  try {
    const { name, username, email, password, confirmPassword } = req.body;
    
    if (!username || !password || !confirmPassword) {
      return res.status(400).json({ success: false, message: "Username and passwords required." });
    }
    
    if (password !== confirmPassword) {
      return res.status(400).json({ success: false, message: "Passwords do not match." });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: "Password must be 6+ characters." });
    }

    const existing = await db.query("SELECT admin_id FROM admins WHERE username = $1", [username]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ success: false, message: "Username exists." });
    }
    
    if (email) {
      const existingEmail = await db.query("SELECT admin_id FROM admins WHERE email = $1", [email]);
      if (existingEmail.rows.length > 0) {
        return res.status(409).json({ success: false, message: "Email exists." });
      }
    }

    const result = await db.query(
      "INSERT INTO admins (name, username, email, password) VALUES ($1, $2, $3, $4) RETURNING admin_id, name, username, email",
      [name || null, username, email || null, hashPassword(password)]
    );
    
    return res.json({
      success: true,
      message: "Admin created successfully",
      admin: result.rows[0]
    });
  } catch (error) {
    console.error("Admin signup error:", error);
    return res.status(500).json({ success: false, message: "Admin registration failed." });
  }
});

router.post("/admin/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ success: false, message: "Username and password required." });
    }

    const result = await db.query(
      "SELECT admin_id, username FROM admins WHERE username = $1 AND password = $2",
      [username, hashPassword(password)]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: "Invalid credentials." });
    }

    const admin = result.rows[0];
    
    const { sessionId } = await createAdminSession(admin.admin_id, req);
    
    res.cookie("adminSessionId", sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: ADMIN_SESSION_EXPIRY_HOURS * 60 * 60 * 1000,
      path: "/"
    });
    
    console.log(`Admin login: ${admin.username}`);
    
    return res.json({
      success: true,
      message: "Admin login successful",
      admin: { id: admin.admin_id, username: admin.username }
    });
  } catch (error) {
    console.error("Admin login error:", error);
    return res.status(500).json({ success: false, message: "Admin login failed." });
  }
});

router.get("/admin/session-check", async (req, res) => {
  try {
    const sessionId = req.cookies.adminSessionId;
    const session = await verifyAdminSession(sessionId, req);
    
    if (!session) {
      res.clearCookie("adminSessionId");
      return res.json({ authenticated: false });
    }
    
    return res.json({
      authenticated: true,
      admin: { id: session.adminId, username: session.username }
    });
  } catch (error) {
    console.error("Admin session check error:", error);
    res.clearCookie("adminSessionId");
    return res.json({ authenticated: false });
  }
});

router.post("/admin/logout", async (req, res) => {
  try {
    const sessionId = req.cookies.adminSessionId;
    
    if (sessionId) {
      await db.query("DELETE FROM sessions WHERE session_id = $1 AND admin_id IS NOT NULL", [sessionId]);
    }
    
    res.clearCookie("adminSessionId");
    return res.json({ success: true, message: "Admin logged out successfully" });
  } catch (error) {
    res.clearCookie("adminSessionId");
    return res.json({ success: true, message: "Admin logged out successfully" });
  }
});

const requireAdmin = async (req, res, next) => {
  try {
    const sessionId = req.cookies.adminSessionId;
    const session = await verifyAdminSession(sessionId, req);
    
    if (!session) {
      res.clearCookie("adminSessionId");
      return res.status(401).json({ success: false, message: "Admin authentication required" });
    }
    
    req.admin = { id: session.adminId, username: session.username };
    next();
  } catch (error) {
    console.error("Admin auth middleware error:", error);
    res.clearCookie("adminSessionId");
    return res.status(401).json({ success: false, message: "Admin authentication required" });
  }
};

module.exports = router;
module.exports.requireAuth = requireAuth;
module.exports.requireAdmin = requireAdmin;