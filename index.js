// ============================================
// 🍽️ RESTAURANT MANAGEMENT SYSTEM - MAIN SERVER FILE
// ============================================
// Ye file main server setup karta hai
// Express.js framework use karta hai

const express = require('express');
const app = express();
const path = require('path');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
require('dotenv').config(); // Environment variables load karta hai (.env file se)

// ⏰ IST Timezone set karo (India Standard Time)
// Saare timestamps IST me honge
process.env.TZ = 'Asia/Kolkata';

// 🔒 Trust Proxy - Cloud platforms (Railway, Heroku) ke liye zaroori
// Reverse proxy headers (X-Forwarded-For) ko trust karta hai
app.set('trust proxy', 1);

// 🛡️ Security: X-Powered-By header disable karo
// Ye header batata hai backend kis technology me bana hai
// Disable karne se hackers ko kam information milti hai
app.disable('x-powered-by');

// ================= CORS CONFIGURATION =================
// 🌐 CORS = Cross-Origin Resource Sharing
// Ye decide karta hai kaun se domains se API call aa sakti hai
// Production me: Sirf allowed domain se requests accept hoti hain (security ke liye)
// Development me: Sab domains se requests allow hain (testing ke liye)
const allowedOrigin = process.env.ALLOWED_ORIGIN || 'https://www.servhunt.in';
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? allowedOrigin : '*',
  credentials: true // Cookies aur authentication headers allow karta hai
}));

// ================= RATE LIMITING =================
// 🚦 Rate Limiting = Ek IP se kitni baar request aa sakti hai limit karta hai
// Spam aur abuse attacks se bachata hai

// 📱 OTP endpoints ke liye rate limiting
// Koi bhi IP 15 minutes me sirf 5 baar OTP request kar sakta hai
// Isse OTP spam aur SMS bombing attacks rukti hain
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes ka window
  max: 5, // Maximum 5 requests per IP
  message: { success: false, message: 'Too many OTP requests. Please try again after 15 minutes.' },
  standardHeaders: true, // Rate limit info headers me bhejta hai
  legacyHeaders: false, // Purane headers disable karta hai
});

// 💳 Payment endpoints ke liye rate limiting
// 15 minutes me max 10 payment requests per IP
// Payment fraud aur repeated failed attempts rokta hai
const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes ka window
  max: 10, // Maximum 10 requests per IP
  message: { success: false, message: 'Too many payment requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ================= MIDDLEWARE SETUP =================
// 📦 Middleware = Request aur Response ke beech me kaam karne wale functions

// JSON request body read karne ke liye
// API calls me JSON data parse karta hai
app.use(express.json({ limit: '10mb' })); // Max 10MB JSON data allow

// Form data read karne ke liye
// HTML forms se aaya hua data parse karta hai
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 🍪 Cookies read karne ke liye
// User authentication ke liye cookies use hoti hain
// Secret key se cookies ko encrypt karta hai (security ke liye)
app.use(cookieParser(process.env.COOKIE_SECRET));

// ================= SECURITY HEADERS =================
// 🛡️ Security headers browser ko batate hain ki website ko kaise protect karna hai

app.use((req, res, next) => {
  // Clickjacking attack se bachata hai
  // Website ko iframe me open hone se rokta hai
  res.setHeader('X-Frame-Options', 'DENY');

  // XSS (Cross-Site Scripting) attack se bachata hai
  // Browser ka built-in XSS protection enable karta hai
  res.setHeader('X-XSS-Protection', '1; mode=block');

  next(); // Agle middleware ko call karta hai
});

// 🔄 Cache Control - Logout ke baad back button issue fix karta hai
// Browser ko pages cache nahi karne deta
// Isse logout ke baad back button dabane par protected pages nahi khulte
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// ================= STATIC FILES =================
// 📁 Static files = HTML, CSS, JS, images jo directly serve hoti hain
// public folder me rakhi saari files directly accessible hongi
// Example: public/index.html ko /index.html se access kar sakte hain
app.use(express.static('public'));

// ================= HEALTH CHECK ENDPOINT =================
// ✅ Server running hai ya nahi check karne ke liye
// Cloud platforms aur monitoring tools ye endpoint use karte hain
// Response me server status, time, aur uptime milta hai
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', // Server chal raha hai
    timestamp: new Date().toISOString(), // Current time (ISO format)
    uptime: process.uptime() // Server kitne seconds se chal raha hai
  });
});

// ================= API ROUTES =================
// 🔌 API Routes = Backend endpoints jo frontend se data exchange karte hain

// Rate limiting apply karo specific endpoints pe
app.use('/api/auth/send-otp', otpLimiter); // OTP bhejne ki limit
app.use('/api/auth/verify-otp', otpLimiter); // OTP verify karne ki limit
app.use('/api/payments', paymentLimiter); // Payment requests ki limit

// Authentication routes (Login, Signup, OTP, Session)
app.use('/api/auth', require('./routes/auth'));

// Customer profile aur orders
app.use('/api', require('./routes/profile'));

// Menu items aur categories (Public access)
app.use('/api/menu', require('./routes/menu'));

// Admin panel routes (Admin authentication required)
app.use('/api/admin', require('./routes/admin'));

// Order creation aur management
app.use('/api/orders', require('./routes/orders'));

// Payment gateway integration (Razorpay)
app.use('/api/payments', require('./routes/payments'));

// Sales reports aur statistics (Admin only)
app.use('/api/sales', require('./routes/sales'));

// Customer ratings aur reviews
app.use('/api/ratings', require('./routes/ratings'));

// ================= ADDITIONAL HEALTH CHECK ENDPOINTS =================
// 🏥 Monitoring aur load balancers ke liye extra endpoints

// Detailed health check with environment info
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(), // Seconds me uptime
    environment: process.env.NODE_ENV || 'development'
  });
});

// Simple ping endpoint - fast response ke liye
app.get('/ping', (req, res) => {
  res.status(200).send('pong');
});

// ================= PAGE ROUTES (CUSTOMER PAGES) =================
// 🌐 Frontend pages serve karte hain

// Home page - Landing page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Customer login page - OTP based authentication
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// README/Documentation page
app.get('/readme', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'README.html'));
});

// Menu page - Browse menu items
app.get('/menu', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'menu.html'));
});

// Customer profile page - View orders, update profile
app.get('/profile', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'profile.html'));
});

// ================= ADMIN PAGES =================
// 👨‍💼 Admin panel pages - Restaurant management

// Admin login page - Username/password authentication
app.get('/admin/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-login.html'));
});

// Admin dashboard - Overview aur active orders
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Users management - Customer list aur details
app.get('/admin/users', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-users.html'));
});

// Old orders - Past orders history
app.get('/admin/oldorders', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'oldorders.html'));
});

// Kitchen display - Active orders for kitchen staff
app.get('/admin/kitchen', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'kitchen.html'));
});

// Sales report - Revenue aur statistics
app.get('/admin/sales-report', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'hotelreport.html'));
});

// Individual customer report
app.get('/admin/report/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'reportcustomer.html'));
});

// Admin settings - Menu management, categories
app.get('/admin/settings', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'adminsetting.html'));
});

// Ratings management - View aur delete customer reviews
app.get('/admin/ratings', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-ratings.html'));
});

// ================= 404 HANDLER =================
// ❌ Jab koi route match nahi hota to ye chalega
// User ko home page redirect kar dete hain
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ================= ERROR HANDLER =================
// 🚨 Global error handler - Koi bhi unhandled error yahan aayega
// Production me detailed error message nahi bhejte (security ke liye)
app.use((err, req, res, next) => {
  console.error('Server error:', err); // Console me error log karo
  res.status(500).json({ 
    success: false,
    message: 'Internal server error' 
  });
});

// ================= SERVER START =================
// 🚀 Server ko start karta hai
// PORT environment variable se port number leta hai
// Agar PORT set nahi hai to default 3000 use karta hai
const port = process.env.PORT || 3000;
const server = app.listen(port, () => {
  console.log(`✅ Server running on port ${port}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📍 Local URL: http://localhost:${port}`);
});
