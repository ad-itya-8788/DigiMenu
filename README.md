# 🍽️ Restaurant Management System

> Complete Digital Menu & Ordering Platform for Hotel Aditya

## 📋 Table of Contents
- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Database Schema](#database-schema)
- [API Documentation](#api-documentation)
- [Environment Variables](#environment-variables)
- [Installation](#installation)
- [Project Structure](#project-structure)
- [Application Flow](#application-flow)

---

## 🎯 Overview

Ye ek complete restaurant management system hai jo customers ko digital menu browse karne, orders place karne, aur payments karne ki facility deta hai. Admin panel se restaurant staff orders manage kar sakte hain, menu update kar sakte hain, aur sales reports dekh sakte hain.

### Key Highlights
- **OTP-based Authentication** - Secure customer login via SMS OTP
- **Digital Menu** - Browse menu items with images, prices, and ratings
- **Online Ordering** - Place orders with table selection
- **Payment Integration** - Razorpay payment gateway support
- **Admin Dashboard** - Complete restaurant management interface
- **Real-time Updates** - Live order status tracking
- **Sales Analytics** - Detailed reports and statistics

---

## ✨ Features

### Customer Features
- 📱 OTP-based registration and login
- 🍕 Browse menu by categories
- ⭐ View item ratings and reviews
- 🛒 Add items to cart
- 💳 Online payment via Razorpay
- 💵 Cash payment option
- 📊 Order history and tracking
- ✍️ Submit ratings and reviews
- 👤 Profile management

### Admin Features
- 🔐 Secure admin authentication
- 📋 Order management (view, update status, delete)
- 🍽️ Menu management (add, edit, delete items)
- 📂 Category management
- 👥 Customer management
- 💰 Sales reports and analytics
- ⭐ Ratings management
- 🖼️ Image upload to CDN
- 📈 Dashboard with statistics

---

## 🛠️ Tech Stack

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **PostgreSQL** - Database

### Third-Party Services
- **Razorpay** - Payment gateway
- **MessageCentral** - SMS OTP service
- **BunnyCDN** - Image hosting and delivery

### Security & Performance
- **express-rate-limit** - API rate limiting
- **cookie-parser** - Cookie management
- **cors** - Cross-origin resource sharing
- **crypto** - Password hashing and security

---

## 🗄️ Database Schema

### Tables Overview

#### 1. **customers** - Customer information
```sql
customer_id (PK) | name | phone | dob | created_at
```
- Stores customer details
- Phone number is unique identifier
- DOB optional for birthday offers

#### 2. **admins** - Admin users
```sql
admin_id (PK) | username | password | name | email | created_at | is_order_accept
```
- Admin authentication credentials
- Password stored as SHA-256 hash
- `is_order_accept` flag to pause/resume orders

#### 3. **menu_category** - Menu categories
```sql
category_id (PK) | category_name
```
- Organizes menu items (e.g., Starters, Main Course, Desserts)

#### 4. **menu_items** - Menu items
```sql
item_id (PK) | item_name | category_id (FK) | price | image_url | description | is_available
```
- Complete menu item details
- `is_available` flag to show/hide items
- Images stored on BunnyCDN

#### 5. **orders** - Customer orders
```sql
order_id (PK) | customer_id (FK) | table_number | total_amount | status | created_at
```
- Order status: pending → preparing → ready → completed
- Table number for dine-in orders

#### 6. **order_items** - Order line items
```sql
order_item_id (PK) | order_id (FK) | item_id (FK) | quantity | price
```
- Individual items in each order
- Price snapshot at order time

#### 7. **payments** - Payment records
```sql
payment_id (PK) | order_id (FK) | amount | payment_status | payment_method | razorpay_payment_id | created_at
```
- Payment method: cash or razorpay
- Razorpay payment ID for online payments

#### 8. **ratings** - Customer reviews
```sql
rating_id (PK) | customer_id (FK) | rating_value | review_text | item_id (FK) | order_id (FK) | created_at
```
- Customers can rate items or overall orders
- Rating value: 1-5 stars

#### 9. **sessions** - User sessions
```sql
session_id (PK) | customer_id (FK) | admin_id (FK) | ip_address | user_agent | created_at | expires_at | last_activity
```
- Manages customer and admin sessions
- Auto-expires after inactivity

### Database Relationships
```
customers (1) ──→ (N) orders
customers (1) ──→ (N) ratings
customers (1) ──→ (N) sessions

orders (1) ──→ (N) order_items
orders (1) ──→ (1) payments
orders (1) ──→ (N) ratings

menu_category (1) ──→ (N) menu_items
menu_items (1) ──→ (N) order_items
menu_items (1) ──→ (N) ratings

admins (1) ──→ (N) sessions
```

---

## 🔌 API Documentation

### Base URL
```
Development: http://localhost:3000
Production: https://your-domain.com
```

### Authentication APIs

#### 1. Send OTP (Customer Registration/Login)
```http
POST /api/auth/send-otp
Content-Type: application/json

{
  "phone": "9876543210",
  "type": "login",  // or "register"
  "name": "John Doe"  // required only for registration
}
```

**Response:**
```json
{
  "success": true,
  "message": "OTP sent successfully"
}
```

#### 2. Verify OTP
```http
POST /api/auth/verify-otp
Content-Type: application/json

{
  "phone": "9876543210",
  "otp": "123456",
  "type": "login"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "customer": {
    "id": 1,
    "name": "John Doe",
    "phone": "9876543210"
  }
}
```

#### 3. Session Check
```http
GET /api/auth/session-check
Cookie: sessionId=xxx
```

**Response:**
```json
{
  "authenticated": true,
  "customer": {
    "id": 1,
    "name": "John Doe",
    "phone": "9876543210",
    "hasDob": true
  }
}
```

#### 4. Logout
```http
POST /api/auth/logout
Cookie: sessionId=xxx
```

### Admin Authentication APIs

#### 1. Admin Login
```http
POST /api/auth/admin/login
Content-Type: application/json

{
  "username": "admin",
  "password": "password123"
}
```

#### 2. Admin Session Check
```http
GET /api/auth/admin/session-check
Cookie: adminSessionId=xxx
```

### Menu APIs (Public)

#### 1. Get All Categories
```http
GET /api/menu/categories
```

**Response:**
```json
{
  "success": true,
  "categories": [
    {
      "category_id": 1,
      "category_name": "Starters"
    }
  ]
}
```

#### 2. Get Menu Items
```http
GET /api/menu/items?category_id=1
```

**Response:**
```json
{
  "success": true,
  "items": [
    {
      "item_id": 1,
      "item_name": "Paneer Tikka",
      "category_id": 1,
      "category_name": "Starters",
      "price": "250.00",
      "image_url": "https://cdn.example.com/image.jpg",
      "description": "Delicious paneer tikka",
      "is_available": true,
      "avg_rating": "4.5",
      "rating_count": "10"
    }
  ]
}
```

### Order APIs (Authentication Required)

#### 1. Create Order (Cash Payment)
```http
POST /api/orders/create
Cookie: sessionId=xxx
Content-Type: application/json

{
  "items": [
    {
      "item_id": 1,
      "quantity": 2,
      "price": 250
    }
  ],
  "table_number": "T-1"
}
```

#### 2. Create Order After Payment (Razorpay)
```http
POST /api/orders/create-after-payment
Cookie: sessionId=xxx
Content-Type: application/json

{
  "items": [...],
  "table_number": "T-1",
  "razorpay_order_id": "order_xxx",
  "razorpay_payment_id": "pay_xxx",
  "razorpay_signature": "signature_xxx"
}
```

#### 3. Check Table Availability
```http
GET /api/orders/table-availability
Cookie: sessionId=xxx
```

**Response:**
```json
{
  "success": true,
  "occupied": ["T-1", "T-3"],
  "available": ["T-2", "T-4", "T-5"],
  "tableStatus": {
    "T-1": false,
    "T-2": true,
    "T-3": false,
    "T-4": true,
    "T-5": true
  }
}
```

#### 4. Cancel Order
```http
DELETE /api/orders/cancel/:orderId
Cookie: sessionId=xxx
```

### Payment APIs (Authentication Required)

#### 1. Get Razorpay Key
```http
GET /api/payments/razorpay-key
Cookie: sessionId=xxx
```

#### 2. Create Razorpay Order
```http
POST /api/payments/create-razorpay-order
Cookie: sessionId=xxx
Content-Type: application/json

{
  "amount": 500
}
```

**Response:**
```json
{
  "success": true,
  "razorpay_order": {
    "id": "order_xxx",
    "amount": 50000,
    "currency": "INR"
  }
}
```

### Profile APIs (Authentication Required)

#### 1. Get Profile
```http
GET /api/profile
Cookie: sessionId=xxx
```

#### 2. Get Order History
```http
GET /api/orders?limit=20&offset=0
Cookie: sessionId=xxx
```

#### 3. Update Date of Birth
```http
POST /api/profile/dob
Cookie: sessionId=xxx
Content-Type: application/json

{
  "dob": "1990-01-15"
}
```

### Ratings APIs

#### 1. Submit Item Rating (Authentication Required)
```http
POST /api/ratings/submit-item
Cookie: sessionId=xxx
Content-Type: application/json

{
  "rating": 5,
  "review_text": "Excellent food!",
  "item_id": 1
}
```

#### 2. Get My Ratings (Authentication Required)
```http
GET /api/ratings/my-ratings
Cookie: sessionId=xxx
```

#### 3. Get Ordered Items (Authentication Required)
```http
GET /api/ratings/ordered-items
Cookie: sessionId=xxx
```

#### 4. Get Average Rating (Public)
```http
GET /api/ratings/average
```

#### 5. Get Recent Ratings (Public)
```http
GET /api/ratings/recent?limit=10&offset=0
```

### Admin APIs (Admin Authentication Required)

#### 1. Get Dashboard Stats
```http
GET /api/admin/dashboard/stats
Cookie: adminSessionId=xxx
```

#### 2. Get All Orders
```http
GET /api/admin/orders?status=pending&view_type=active
Cookie: adminSessionId=xxx
```

#### 3. Update Order Status
```http
PUT /api/admin/orders/:orderId/status
Cookie: adminSessionId=xxx
Content-Type: application/json

{
  "status": "preparing"
}
```

#### 4. Mark Order as Paid
```http
PUT /api/admin/orders/:orderId/mark-paid
Cookie: adminSessionId=xxx
```

#### 5. Get All Menu Items
```http
GET /api/admin/items
Cookie: adminSessionId=xxx
```

#### 6. Create Menu Item
```http
POST /api/admin/items
Cookie: adminSessionId=xxx
Content-Type: multipart/form-data

{
  "item_name": "Paneer Tikka",
  "category_id": 1,
  "price": 250,
  "description": "Delicious paneer tikka",
  "is_available": true,
  "image": <file>
}
```

#### 7. Update Menu Item
```http
PUT /api/admin/items/:itemId
Cookie: adminSessionId=xxx
Content-Type: multipart/form-data
```

#### 8. Delete Menu Item
```http
DELETE /api/admin/items/:itemId
Cookie: adminSessionId=xxx
```

#### 9. Category Management
```http
GET /api/admin/categories
POST /api/admin/categories
PUT /api/admin/categories/:categoryId
DELETE /api/admin/categories/:categoryId
Cookie: adminSessionId=xxx
```

#### 10. Get All Users
```http
GET /api/admin/users
Cookie: adminSessionId=xxx
```

#### 11. Get User Details
```http
GET /api/admin/users/:userId
Cookie: adminSessionId=xxx
```

#### 12. Get All Ratings
```http
GET /api/admin/ratings
Cookie: adminSessionId=xxx
```

#### 13. Delete Rating
```http
DELETE /api/admin/ratings/:ratingId
Cookie: adminSessionId=xxx
```

### Sales Report APIs (Admin Authentication Required)

#### 1. Overview Statistics
```http
GET /api/sales/stats/overview?period=today
Cookie: adminSessionId=xxx
```
Period options: `today`, `week`, `month`, `all`

#### 2. Best Selling Items
```http
GET /api/sales/stats/best-sellers?period=week&limit=10
Cookie: adminSessionId=xxx
```

#### 3. Worst Selling Items
```http
GET /api/sales/stats/worst-sellers?period=month&limit=10
Cookie: adminSessionId=xxx
```

#### 4. Sales by Category
```http
GET /api/sales/stats/by-category?period=today
Cookie: adminSessionId=xxx
```

#### 5. Revenue Trend
```http
GET /api/sales/stats/revenue-trend?days=7
Cookie: adminSessionId=xxx
```

#### 6. Payment Methods Breakdown
```http
GET /api/sales/stats/payment-methods?period=month
Cookie: adminSessionId=xxx
```

#### 7. Peak Hours Analysis
```http
GET /api/sales/stats/peak-hours?period=week
Cookie: adminSessionId=xxx
```

#### 8. Top Customers
```http
GET /api/sales/stats/customers?period=all
Cookie: adminSessionId=xxx
```

---

## 🔐 Environment Variables

Create a `.env` file in the root directory:

```env
# ============================
# PostgreSQL Database Config
# ============================
DB_USER=postgres
DB_HOST=localhost
DB_NAME=DigiMenu
DB_PASSWORD=your_secure_password
DB_PORT=5432

# ============================
# Razorpay Payment Gateway
# ============================
# Get from: https://dashboard.razorpay.com/app/keys
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=your_razorpay_secret_key

# ============================
# Message Central OTP Service
# ============================
MESSAGE_CENTRAL_SEND_OTP_URL=https://cpaas.messagecentral.com/verification/v3/send
MESSAGE_CENTRAL_VALIDATE_OTP_URL=https://cpaas.messagecentral.com/verification/v3/validateOtp
MESSAGE_CENTRAL_COUNTRY_CODE=91
MESSAGE_CENTRAL_CUSTOMER_ID=your_customer_id
MESSAGE_CENTRAL_AUTH_TOKEN=your_auth_token

# ============================
# Security Configuration
# ============================
TRUSTED_CLIENT_KEY=your_random_secure_key_here
JWT_SECRET=your_jwt_secret_key_here
COOKIE_SECRET=your_cookie_secret_key_here

# ============================
# Bunny CDN Configuration
# ============================
BUNNY_ACCESS_KEY=your_bunny_access_key
BUNNY_STORAGE_ZONE=your_storage_zone_name
BUNNY_CDN_HOSTNAME=your-cdn.b-cdn.net

# ============================
# CORS & Domain Configuration
# ============================
ALLOWED_ORIGIN=https://www.servhunt.in

# ============================
# Server Configuration
# ============================
PORT=3000
NODE_ENV=production

# ============================
# Timezone Configuration
# ============================
TZ=Asia/Kolkata
```

### Environment Variables Explanation

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `DB_USER` | PostgreSQL username | Yes | postgres |
| `DB_HOST` | Database host address | Yes | localhost |
| `DB_NAME` | Database name | Yes | DigiMenu |
| `DB_PASSWORD` | Database password | Yes (Production) | 1234 |
| `DB_PORT` | PostgreSQL port | No | 5432 |
| `RAZORPAY_KEY_ID` | Razorpay API key | Yes | - |
| `RAZORPAY_KEY_SECRET` | Razorpay secret key | Yes | - |
| `MESSAGE_CENTRAL_AUTH_TOKEN` | SMS OTP service token | Yes | - |
| `MESSAGE_CENTRAL_CUSTOMER_ID` | MessageCentral customer ID | Yes | - |
| `BUNNY_ACCESS_KEY` | BunnyCDN access key | Yes | - |
| `BUNNY_STORAGE_ZONE` | CDN storage zone | Yes | - |
| `BUNNY_CDN_HOSTNAME` | CDN hostname | Yes | - |
| `COOKIE_SECRET` | Cookie encryption key | Yes | - |
| `ALLOWED_ORIGIN` | CORS allowed domain | Yes | - |
| `PORT` | Server port | No | 3000 |
| `NODE_ENV` | Environment mode | No | development |

---

## 📦 Installation

### Prerequisites
- Node.js (v18 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn

### Step 1: Clone Repository
```bash
git clone <repository-url>
cd restaurant-management-system
```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Setup Database
```bash
# Login to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE DigiMenu;

# Exit psql
\q

# Run database schema
psql -U postgres -d DigiMenu -f database.sql
```

### Step 4: Configure Environment
```bash
# Copy example env file
cp .env.example .env

# Edit .env file with your credentials
nano .env
```

### Step 5: Start Server
```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

Server will start at `http://localhost:3000`

---

## 📁 Project Structure

```
restaurant-management-system/
│
├── index.js                 # Main server file
├── package.json             # Dependencies
├── .env                     # Environment variables (not in git)
├── .env.example             # Environment template
├── database.sql             # Database schema
│
├── routes/                  # API route handlers
│   ├── auth.js             # Authentication (OTP, sessions)
│   ├── admin.js            # Admin panel APIs
│   ├── menu.js             # Public menu APIs
│   ├── orders.js           # Order management
│   ├── payments.js         # Payment gateway
│   ├── profile.js          # Customer profile
│   ├── ratings.js          # Ratings & reviews
│   ├── sales.js            # Sales reports
│   ├── database.js         # Database connection
│   ├── messageCentral.js   # OTP service
│   └── bunnyCDN.js         # Image CDN service
│
└── public/                  # Frontend files
    ├── index.html          # Landing page
    ├── login.html          # Customer login
    ├── menu.html           # Menu browsing
    ├── profile.html        # Customer profile
    ├── admin-login.html    # Admin login
    ├── admin.html          # Admin dashboard
    ├── admin-users.html    # User management
    ├── admin-ratings.html  # Ratings management
    ├── adminsetting.html   # Menu management
    ├── kitchen.html        # Kitchen display
    ├── oldorders.html      # Order history
    ├── hotelreport.html    # Sales reports
    └── reportcustomer.html # Customer report
```

---

## 🔄 Application Flow

### Customer Journey

1. **Landing Page** (`/`)
   - View restaurant info
   - Navigate to menu or login

2. **Login** (`/login`)
   - Enter mobile number
   - Receive OTP via SMS
   - Verify OTP
   - Session created (90 days)

3. **Browse Menu** (`/menu`)
   - View categories
   - Filter items
   - See ratings and reviews
   - Add items to cart

4. **Place Order**
   - Select table number
   - Review cart
   - Choose payment method:
     - **Cash**: Order created, pay at counter
     - **Online**: Razorpay payment → Order created

5. **Track Order** (`/profile`)
   - View order status
   - See order history
   - Submit ratings

### Admin Journey

1. **Admin Login** (`/admin/login`)
   - Username/password authentication
   - Session created (24 hours)

2. **Dashboard** (`/admin`)
   - View statistics
   - See active orders
   - Quick actions

3. **Order Management**
   - View all orders
   - Update status: pending → preparing → ready → completed
   - Mark cash payments as paid
   - Delete orders

4. **Menu Management** (`/admin/settings`)
   - Add/edit/delete categories
   - Add/edit/delete menu items
   - Upload images to CDN
   - Toggle item availability

5. **User Management** (`/admin/users`)
   - View all customers
   - See customer details
   - View order history

6. **Sales Reports** (`/admin/sales-report`)
   - Revenue statistics
   - Best/worst sellers
   - Payment methods breakdown
   - Peak hours analysis

7. **Ratings Management** (`/admin/ratings`)
   - View all ratings
   - Delete inappropriate reviews

### Order Status Flow

```
pending → preparing → ready → completed
   ↓
cancelled (only if pending)
```

### Payment Flow

#### Cash Payment
```
1. Customer places order
2. Order created with status "pending"
3. Payment record created with status "pending"
4. Customer pays at counter
5. Admin marks payment as "completed"
6. Order status updated by admin
```

#### Online Payment (Razorpay)
```
1. Customer initiates payment
2. Razorpay order created
3. Customer completes payment
4. Payment verified via signature
5. Order created with status "pending"
6. Payment record created with status "completed"
7. Order status updated by admin
```

---

## 🔒 Security Features

1. **Password Hashing**: SHA-256 for admin passwords
2. **Session Management**: Secure cookie-based sessions
3. **Rate Limiting**: Prevents spam and abuse
4. **CORS Protection**: Restricts API access to allowed domains
5. **Input Validation**: All inputs validated and sanitized
6. **SQL Injection Prevention**: Parameterized queries
7. **XSS Protection**: Security headers enabled
8. **Clickjacking Protection**: X-Frame-Options header

---

## 🚀 Deployment

### Railway Deployment

1. Create account on [Railway.app](https://railway.app)
2. Create new project
3. Add PostgreSQL database
4. Deploy from GitHub
5. Set environment variables
6. Deploy!

### Environment Variables for Production
- Set `NODE_ENV=production`
- Use strong passwords and secrets
- Configure proper CORS origin
- Set up database backups

---

## 📝 Notes for Beginners

### Hinglish Comments
Code me Hinglish comments hain jo beginners ko samajhne me help karenge:
- `// Ye function OTP bhejta hai` - This function sends OTP
- `// Database se data fetch karo` - Fetch data from database
- `// Error handle karo` - Handle errors

### Common Terms
- **API**: Application Programming Interface - Backend aur frontend ke beech communication
- **OTP**: One-Time Password - SMS se aane wala 6-digit code
- **Session**: User login state - Logout tak valid rahta hai
- **Cookie**: Browser me store hone wala data - Session ID store karta hai
- **CDN**: Content Delivery Network - Images fast load karne ke liye
- **Rate Limiting**: Ek IP se kitni baar request aa sakti hai limit karna

---

## 🐛 Troubleshooting

### Database Connection Error
```
Error: Cannot connect to database
```
**Solution**: Check database credentials in `.env` file

### OTP Not Sending
```
Error: SMS service not configured
```
**Solution**: Verify MessageCentral credentials in `.env`

### Image Upload Failing
```
Error: Failed to upload image
```
**Solution**: Check BunnyCDN credentials and storage zone

### Payment Gateway Error
```
Error: Invalid payment signature
```
**Solution**: Verify Razorpay key and secret

---

## 📞 Support

For any issues or questions:
- Check documentation above
- Review code comments
- Contact: [Your Contact Info]

---

## 📄 License

ISC License - Free to use and modify

---

**Made with ❤️ for Hotel Aditya**
