// Payments Routes - Razorpay integration
const express = require("express");
const router = express.Router();
const Razorpay = require("razorpay");
const crypto = require("crypto");
const db = require("./database");
const { requireAuth } = require("./auth");
require("dotenv").config();

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

// Production safety check
if ((!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) && process.env.NODE_ENV === 'production') {
  console.error("❌ FATAL: RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set in production environment");
  process.exit(1);
}

const razorpay = new Razorpay({
  key_id: RAZORPAY_KEY_ID,
  key_secret: RAZORPAY_KEY_SECRET,
});

// Get Razorpay key
router.get("/razorpay-key", requireAuth, (req, res) => {
  res.json({ 
    success: true,
    key: RAZORPAY_KEY_ID 
  });
});

// Create Razorpay order
router.post("/create-razorpay-order", requireAuth, async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount) {
      return res.status(400).json({ success: false, message: "Amount is required" });
    }

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

// Create order (for existing orders)
router.post("/create-order", requireAuth, async (req, res) => {
  try {
    const { order_id, amount } = req.body;

    if (!order_id || !amount) {
      return res.status(400).json({ success: false, message: "Order ID and amount are required" });
    }

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

// Verify payment
router.post("/verify", requireAuth, async (req, res) => {
  try {
    const { order_id, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!order_id || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: "All payment details are required" });
    }

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

    // Verify Razorpay signature
    const text = `${razorpay_order_id}|${razorpay_payment_id}`;
    const generatedSignature = crypto
      .createHmac("sha256", RAZORPAY_KEY_SECRET)
      .update(text)
      .digest("hex");

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, message: "Invalid payment signature" });
    }

    await db.query("BEGIN");

    try {
      // Save payment record
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
