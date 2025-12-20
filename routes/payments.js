// 📌 Payments Routes - Razorpay online payment integration
// Authentication required hai (requireAuth middleware)
const express = require("express");
const router = express.Router();
const Razorpay = require("razorpay");
const crypto = require("crypto");
const db = require("./database");
const { requireAuth } = require("./auth");
require("dotenv").config();

// 🔐 Razorpay credentials - MUST be set in environment variables
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

// ✅ Production safety check - fail fast if credentials not configured
if ((!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) && process.env.NODE_ENV === 'production') {
  console.error("❌ FATAL: RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set in production environment");
  process.exit(1);
}

// Razorpay instance create karo (API keys se)
const razorpay = new Razorpay({
  key_id: RAZORPAY_KEY_ID,
  key_secret: RAZORPAY_KEY_SECRET,
});

// 🔑 GET Razorpay Key - Frontend ko securely key provide karta hai
// Frontend me hardcoded key nahi hogi, ye API se fetch hogi
router.get("/razorpay-key", requireAuth, (req, res) => {
  res.json({ 
    success: true,
    key: RAZORPAY_KEY_ID 
  });
});

// 💳 Razorpay order create karta hai (database order nahi banata)
// Ye sirf payment gateway ke liye order ID generate karta hai
// Actual order tab banta hai jab payment successful ho jaye
router.post("/create-razorpay-order", requireAuth, async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount) {
      return res.status(400).json({ success: false, message: "Amount is required" });
    }

    // Create Razorpay order
    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(parseFloat(amount) * 100), // Convert to paise
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
    });

    return res.json({
      success: true,
      razorpay_order: razorpayOrder,
    });
  } catch (error) {
    console.error("Create Razorpay order error:", error);
    return res.status(500).json({ success: false, message: "Failed to create payment order" });
  }
});

// Create Razorpay order (OLD - for existing orders)
router.post("/create-order", requireAuth, async (req, res) => {
  try {
    const { order_id, amount } = req.body;

    if (!order_id || !amount) {
      return res.status(400).json({ success: false, message: "Order ID and amount are required" });
    }

    // Verify order exists and belongs to customer
    const orderResult = await db.query(
      "SELECT order_id, customer_id, total_amount FROM orders WHERE order_id = $1",
      [order_id]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const order = orderResult.rows[0];

    if (order.customer_id !== req.customer.customerId) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    // Create Razorpay order
    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(parseFloat(amount) * 100), // Convert to paise
      currency: "INR",
      receipt: `order_${order_id}`,
    });

    return res.json({
      success: true,
      razorpay_order: razorpayOrder,
    });
  } catch (error) {
    console.error("Create Razorpay order error:", error);
    return res.status(500).json({ success: false, message: "Failed to create payment order" });
  }
});

// ✅ Payment verify karta hai aur database me save karta hai
// Step 1: Razorpay signature verify karo (security ke liye)
// Step 2: Order customer ka hai ya nahi check karo
// Step 3: Payment record database me save karo with 'completed' status
// NOTE: Order status 'pending' hi rahta hai, admin baad me change karta hai
router.post("/verify", requireAuth, async (req, res) => {
  try {
    const { order_id, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!order_id || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: "All payment details are required" });
    }

    // Order exist karta hai ya nahi check karo
    const orderResult = await db.query(
      "SELECT order_id, customer_id, total_amount FROM orders WHERE order_id = $1",
      [order_id]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const order = orderResult.rows[0];

    // Order customer ka hai ya nahi verify karo
    if (order.customer_id !== req.customer.customerId) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    // Razorpay signature verify karo (payment genuine hai ya nahi)
    const text = `${razorpay_order_id}|${razorpay_payment_id}`;
    const generatedSignature = crypto
      .createHmac("sha256", RAZORPAY_KEY_SECRET)
      .update(text)
      .digest("hex");

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, message: "Invalid payment signature" });
    }

    // Database transaction start karo
    await db.query("BEGIN");

    try {
      // Payment record save karo with 'completed' status
      // Order status 'pending' hi rahega, admin baad me change karega
      await db.query(
        `INSERT INTO payments (order_id, amount, payment_status, payment_method, razorpay_payment_id) 
         VALUES ($1, $2, 'completed', 'razorpay', $3)`,
        [order_id, order.total_amount, razorpay_payment_id]
      );

      await db.query("COMMIT");

      return res.json({
        success: true,
        message: "Payment verified and saved successfully",
      });
    } catch (error) {
      await db.query("ROLLBACK");
      throw error;
    }
  } catch (error) {
    console.error("Verify payment error:", error);
    return res.status(500).json({ success: false, message: "Failed to verify payment" });
  }
});

module.exports = router;
