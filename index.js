const express = require('express');
const app = express();
const path = require('path');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
require('dotenv').config();

// IST timezone
process.env.TZ = 'Asia/Kolkata';

// Trust proxy - Railway/cloud platforms ke liye zaroori hai
// Reverse proxy headers (X-Forwarded-For) ko trust karta hai
app.set('trust proxy', 1);

//x-powred by return krta hai backend kis cheez mai baana hai to wo disable kiya taki name return na ho
app.disable('x-powered-by');

// ================= CORS CONFIGURATION =================
// Production me sirf allowed domain se requests accept karte hain
// Development me sab domains allow hain
const allowedOrigin = process.env.ALLOWED_ORIGIN || 'https://www.servhunt.in';
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? allowedOrigin : '*',
  credentials: true
}));

// ================= RATE LIMITING =================
// OTP endpoints ke liye rate limiting (spam/abuse rokne ke liye)
// 15 minutes me max 5 requests per IP
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // max 5 requests per IP
  message: { success: false, message: 'Too many OTP requests. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Payment endpoints ke liye rate limiting
// 15 minutes me max 10 requests per IP
const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // max 10 requests per IP
  message: { success: false, message: 'Too many payment requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// JSON request body read karne ke liye
app.use(express.json({ limit: '10mb' }));

// Form data read karne ke liye
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Cookies read karne ke liye (with secret for signed cookies)
app.use(cookieParser(process.env.COOKIE_SECRET));

// ================= SIMPLE SECURITY HEADERS =================

app.use((req, res, next) => {

  // Website iframe me open hone se rokta hai (clickjacking protection)
  res.setHeader('X-Frame-Options', 'DENY');

  // Browser ka basic XSS protection ON karta hai
  res.setHeader('X-XSS-Protection', '1; mode=block');

  next();
});


// Logout ke baad back button issue avoid karne ke liye
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// ================= STATIC FILES =================

// public folder ko static banaya
app.use(express.static('public'));

// ================= HEALTH CHECK =================
// Server running hai ya nahi check karne ke liye
// Monitoring tools use kar sakte hain
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// ================= API ROUTES =================

// OTP endpoints pe rate limiting apply karo
app.use('/api/auth/send-otp', otpLimiter);
app.use('/api/auth/verify-otp', otpLimiter);

// Payment endpoints pe rate limiting apply karo
app.use('/api/payments', paymentLimiter);

app.use('/api/auth', require('./routes/auth'));
app.use('/api', require('./routes/profile'));
app.use('/api/menu', require('./routes/menu'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/sales', require('./routes/sales'));
app.use('/api/ratings', require('./routes/ratings'));

// ================= HEALTH CHECK =================

// Health check endpoint for monitoring and load balancers
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Alternative ping endpoint
app.get('/ping', (req, res) => {
  res.status(200).send('pong');
});

// ================= PAGE ROUTES =================

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/readme', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'README.html'));
});

app.get('/menu', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'menu.html'));
});

app.get('/profile', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'profile.html'));
});

// ================= ADMIN PAGES =================

app.get('/admin/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-login.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/admin/users', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-users.html'));
});

app.get('/admin/oldorders', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'oldorders.html'));
});

app.get('/admin/kitchen', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'kitchen.html'));
});

app.get('/admin/sales-report', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'hotelreport.html'));
});

app.get('/admin/report/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'reportcustomer.html'));
});

app.get('/admin/settings', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'adminsetting.html'));
});

app.get('/admin/ratings', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-ratings.html'));
});

// ================= 404 =================

app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ================= ERROR HANDLER =================

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ message: 'Server error' });
});


// ================= SERVER START =================

const port = process.env.PORT || 3000;
const server = app.listen(port, () => {
  console.log(`✅ Server running on port ${port}`);
});
