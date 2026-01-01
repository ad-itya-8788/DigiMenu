# 🚀 Quick Start Guide - Restaurant Management System

## 5-Minute Setup (Beginners ke liye)

### Step 1: Prerequisites Install Karo
```bash
# Node.js download karo (v18 ya usse upar)
# https://nodejs.org/

# PostgreSQL download karo
# https://www.postgresql.org/download/
```

### Step 2: Project Setup
```bash
# Project folder me jao
cd restaurant-management-system

# Dependencies install karo
npm install
```

### Step 3: Database Setup
```bash
# PostgreSQL open karo
psql -U postgres

# Database banao
CREATE DATABASE DigiMenu;

# Exit karo
\q

# Schema run karo
psql -U postgres -d DigiMenu -f database.sql
```

### Step 4: Environment Variables
```bash
# .env file banao
cp .env.example .env

# .env file edit karo aur apni details daalo
```

**Minimum Required Variables:**
```env
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=DigiMenu
DB_HOST=localhost
DB_PORT=5432

RAZORPAY_KEY_ID=your_key
RAZORPAY_KEY_SECRET=your_secret

MESSAGE_CENTRAL_AUTH_TOKEN=your_token
MESSAGE_CENTRAL_CUSTOMER_ID=your_id

BUNNY_ACCESS_KEY=your_key
BUNNY_STORAGE_ZONE=your_zone
BUNNY_CDN_HOSTNAME=your-cdn.b-cdn.net

COOKIE_SECRET=any_random_string_here
ALLOWED_ORIGIN=http://localhost:3000
```

### Step 5: Start Server
```bash
# Development mode (auto-reload)
npm run dev

# Ya production mode
npm start
```

### Step 6: Access Application
```
Customer Side: http://localhost:3000
Admin Login: http://localhost:3000/admin/login
```

---

## 🎯 First Time Admin Setup

### Create Admin Account
```bash
# PostgreSQL me jao
psql -U postgres -d DigiMenu

# Admin account banao
INSERT INTO admins (username, password, name, email) 
VALUES ('admin', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'Admin User', 'admin@example.com');

# Exit karo
\q
```

**Default Admin Credentials:**
- Username: `admin`
- Password: (empty string - change immediately!)

**Password Change Kaise Karein:**
```javascript
// Node.js console me
const crypto = require('crypto');
const password = 'your_new_password';
const hash = crypto.createHash('sha256').update(password).digest('hex');
console.log(hash);
```

Ye hash copy karke database me update karo:
```sql
UPDATE admins SET password = 'your_hash_here' WHERE username = 'admin';
```

---

## 📋 Testing Checklist

### Customer Flow Test
- [ ] Open http://localhost:3000
- [ ] Click "Login" button
- [ ] Enter mobile number
- [ ] Receive OTP (check console logs)
- [ ] Verify OTP
- [ ] Browse menu
- [ ] Add items to cart
- [ ] Place order
- [ ] View profile

### Admin Flow Test
- [ ] Open http://localhost:3000/admin/login
- [ ] Login with admin credentials
- [ ] View dashboard statistics
- [ ] Check active orders
- [ ] Update order status
- [ ] Add new menu item
- [ ] Upload image
- [ ] View sales report

---

## 🔧 Common Issues & Solutions

### Issue 1: Database Connection Failed
```
Error: password authentication failed for user "postgres"
```
**Solution:** 
- Check DB_PASSWORD in .env file
- Verify PostgreSQL is running
- Test connection: `psql -U postgres`

### Issue 2: Port Already in Use
```
Error: listen EADDRINUSE: address already in use :::3000
```
**Solution:**
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Linux/Mac
lsof -ti:3000 | xargs kill -9
```

### Issue 3: OTP Not Sending
```
Error: SMS service not configured
```
**Solution:**
- Verify MESSAGE_CENTRAL credentials
- Check MessageCentral dashboard
- For testing, use bypass number: 8788200189 with OTP: 878820

### Issue 4: Image Upload Failed
```
Error: Failed to upload image
```
**Solution:**
- Check BUNNY_ACCESS_KEY
- Verify storage zone name
- Test CDN access

### Issue 5: Payment Gateway Error
```
Error: Invalid payment signature
```
**Solution:**
- Use Razorpay test keys for development
- Verify RAZORPAY_KEY_SECRET
- Check Razorpay dashboard

---

## 📱 API Testing with Postman

### Import Collection
1. Open Postman
2. Import → Raw Text
3. Paste API endpoints from README.md
4. Test each endpoint

### Example: Test OTP Send
```http
POST http://localhost:3000/api/auth/send-otp
Content-Type: application/json

{
  "phone": "9876543210",
  "type": "register",
  "name": "Test User"
}
```

---

## 🎓 Learning Path for Beginners

### Day 1: Understanding Structure
- Read README.md completely
- Understand database schema
- Review project structure

### Day 2: Backend Basics
- Study index.js (main server file)
- Understand routes/auth.js (authentication)
- Learn about middleware

### Day 3: Database Operations
- Study routes/database.js
- Learn SQL queries in route files
- Practice with PostgreSQL

### Day 4: API Development
- Study routes/menu.js (simple CRUD)
- Understand routes/orders.js
- Test APIs with Postman

### Day 5: Advanced Features
- Study routes/payments.js (Razorpay)
- Understand routes/ratings.js
- Learn about CDN integration

---

## 📚 Useful Resources

### Documentation
- [Express.js Guide](https://expressjs.com/en/guide/routing.html)
- [PostgreSQL Tutorial](https://www.postgresql.org/docs/current/tutorial.html)
- [Razorpay Docs](https://razorpay.com/docs/)
- [Node.js Docs](https://nodejs.org/docs/latest/api/)

### Video Tutorials
- Node.js Basics
- Express.js REST API
- PostgreSQL for Beginners
- Payment Gateway Integration

---

## 💡 Pro Tips

1. **Development Mode**: Always use `npm run dev` for auto-reload
2. **Console Logs**: Check terminal for errors and logs
3. **Database GUI**: Use pgAdmin for easy database management
4. **API Testing**: Use Postman or Thunder Client
5. **Code Comments**: Read Hinglish comments for better understanding
6. **Git**: Commit changes regularly
7. **Backup**: Take database backups before major changes

---

## 🎯 Next Steps

After setup is complete:

1. **Customize**
   - Change restaurant name
   - Update logo and branding
   - Modify menu categories

2. **Add Features**
   - Email notifications
   - WhatsApp integration
   - Loyalty program
   - Discount coupons

3. **Deploy**
   - Choose hosting platform (Railway, Heroku, AWS)
   - Set up domain name
   - Configure SSL certificate
   - Set up monitoring

---

## 📞 Need Help?

- Read error messages carefully
- Check console logs
- Review code comments
- Search error on Google/Stack Overflow
- Ask in developer communities

---

**Happy Coding! 🚀**
