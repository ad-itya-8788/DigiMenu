// Order creation and management routes

const express = require("express");
const router = express.Router();
const db = require("./database");
const { requireAuth } = require("./auth");
const crypto = require("crypto");
require("dotenv").config();

const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

if (!RAZORPAY_KEY_SECRET && process.env.NODE_ENV === 'production') {
  console.error("RAZORPAY_KEY_SECRET must be set in production");
  process.exit(1);
}

router.post("/create-after-payment", requireAuth, async (req, res) => {
  try {
    const { items, table_number, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const customerId = req.customer.customerId;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: "Cart is empty. Please add items to cart." });
    }

    if (!table_number || !table_number.trim()) {
      return res.status(400).json({ success: false, message: "Table number is required." });
    }

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: "Payment details are required." });
    }

    const text = `${razorpay_order_id}|${razorpay_payment_id}`;
    const generatedSignature = crypto
      .createHmac("sha256", RAZORPAY_KEY_SECRET)
      .update(text)
      .digest("hex");

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, message: "Invalid payment signature. Payment verification failed." });
    }

    const tableCheck = await db.query(
      `SELECT order_id FROM orders 
       WHERE table_number = $1 
       AND status IN ('pending', 'preparing', 'ready')
       AND DATE(created_at) = CURRENT_DATE
       LIMIT 1`,
      [table_number.trim()]
    );

    if (tableCheck.rows.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: `Table ${table_number} is currently occupied. Please select another table.` 
      });
    }

    let totalAmount = 0;
    for (const item of items) {
      if (!item.item_id || !item.quantity || !item.price) {
        return res.status(400).json({ success: false, message: "Invalid item data." });
      }
      totalAmount += parseFloat(item.price) * parseInt(item.quantity);
    }

    await db.query("BEGIN");

    try {
      const orderResult = await db.query(
        `INSERT INTO orders (customer_id, table_number, total_amount, status) 
         VALUES ($1, $2, $3, 'pending') 
         RETURNING order_id, customer_id, table_number, total_amount, status, created_at`,
        [customerId, table_number.trim(), totalAmount]
      );

      const order = orderResult.rows[0];

      const orderItemsValues = items.map((item, index) => 
        `($1, $${index * 3 + 2}, $${index * 3 + 3}, $${index * 3 + 4})`
      ).join(', ');
      
      const orderItemsParams = [order.order_id];
      items.forEach(item => {
        orderItemsParams.push(item.item_id, item.quantity, item.price);
      });

      await db.query(
        `INSERT INTO order_items (order_id, item_id, quantity, price) VALUES ${orderItemsValues}`,
        orderItemsParams
      );

      await db.query(
        `INSERT INTO payments (order_id, amount, payment_status, payment_method, razorpay_payment_id) 
         VALUES ($1, $2, 'completed', 'razorpay', $3)`,
        [order.order_id, totalAmount, razorpay_payment_id]
      );

      await db.query("COMMIT");

      return res.json({
        success: true,
        message: "Order placed successfully after payment!",
        order: {
          order_id: order.order_id,
          table_number: order.table_number,
          total_amount: parseFloat(order.total_amount),
          status: order.status,
          created_at: order.created_at,
        },
      });
    } catch (error) {
      await db.query("ROLLBACK");
      throw error;
    }
  } catch (error) {
    console.error("Create order after payment error:", error);
    return res.status(500).json({ success: false, message: "Failed to create order after payment. Please contact support." });
  }
});

router.get("/table-availability", requireAuth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT DISTINCT table_number 
       FROM orders 
       WHERE status IN ('pending', 'preparing', 'ready')
       AND DATE(created_at) = CURRENT_DATE`
    );

    const occupiedTables = result.rows.map(row => row.table_number);
    const allTables = ['T-1', 'T-2', 'T-3', 'T-4', 'T-5'];
    const availableTables = allTables.filter(table => !occupiedTables.includes(table));
    
    return res.json({
      success: true,
      occupied: occupiedTables,
      available: availableTables,
      tableStatus: allTables.reduce((acc, table) => {
        acc[table] = !occupiedTables.includes(table);
        return acc;
      }, {})
    });
  } catch (error) {
    console.error("Check table availability error:", error);
    return res.status(500).json({ success: false, message: "Failed to check table availability" });
  }
});

router.post("/create", requireAuth, async (req, res) => {
  try {
    const { items, table_number } = req.body;
    const customerId = req.customer.customerId;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: "Cart is empty. Please add items to cart." });
    }

    if (!table_number || !table_number.trim()) {
      return res.status(400).json({ success: false, message: "Table number is required." });
    }

    const tableCheck = await db.query(
      `SELECT order_id FROM orders 
       WHERE table_number = $1 
       AND status IN ('pending', 'preparing', 'ready')
       AND DATE(created_at) = CURRENT_DATE
       LIMIT 1`,
      [table_number.trim()]
    );

    if (tableCheck.rows.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: `Table ${table_number} is currently occupied. Please select another table.` 
      });
    }

    let totalAmount = 0;
    for (const item of items) {
      if (!item.item_id || !item.quantity || !item.price) {
        return res.status(400).json({ success: false, message: "Invalid item data." });
      }
      totalAmount += parseFloat(item.price) * parseInt(item.quantity);
    }

    await db.query("BEGIN");

    try {
      const orderResult = await db.query(
        `INSERT INTO orders (customer_id, table_number, total_amount, status) 
         VALUES ($1, $2, $3, 'pending') 
         RETURNING order_id, customer_id, table_number, total_amount, status, created_at`,
        [customerId, table_number.trim(), totalAmount]
      );

      const order = orderResult.rows[0];

      const orderItemsValues = items.map((item, index) => 
        `($1, $${index * 3 + 2}, $${index * 3 + 3}, $${index * 3 + 4})`
      ).join(', ');
      
      const orderItemsParams = [order.order_id];
      items.forEach(item => {
        orderItemsParams.push(item.item_id, item.quantity, item.price);
      });

      await db.query(
        `INSERT INTO order_items (order_id, item_id, quantity, price) VALUES ${orderItemsValues}`,
        orderItemsParams
      );

      await db.query(
        `INSERT INTO payments (order_id, amount, payment_status, payment_method) 
         VALUES ($1, $2, 'pending', 'cash')`,
        [order.order_id, totalAmount]
      );

      await db.query("COMMIT");

      return res.json({
        success: true,
        message: "Order placed successfully!",
        order: {
          order_id: order.order_id,
          table_number: order.table_number,
          total_amount: parseFloat(order.total_amount),
          status: order.status,
          created_at: order.created_at,
        },
      });
    } catch (error) {
      await db.query("ROLLBACK");
      throw error;
    }
  } catch (error) {
    console.error("Create order error:", error);
    return res.status(500).json({ success: false, message: "Failed to place order. Please try again." });
  }
});

router.delete("/cancel/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const customerId = req.customer.customerId;

    const orderCheck = await db.query(
      "SELECT order_id, status FROM orders WHERE order_id = $1 AND customer_id = $2",
      [id, customerId]
    );

    if (orderCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const order = orderCheck.rows[0];

    if (order.status !== 'pending') {
      return res.status(400).json({ 
        success: false, 
        message: "Cannot cancel order. Order is already being processed." 
      });
    }

    const paymentCheck = await db.query(
      "SELECT payment_status FROM payments WHERE order_id = $1",
      [id]
    );

    if (paymentCheck.rows.length > 0 && paymentCheck.rows[0].payment_status === 'completed') {
      return res.status(400).json({ 
        success: false, 
        message: "Cannot cancel order. Payment has already been completed." 
      });
    }

    await db.query("BEGIN");

    try {
      await db.query("DELETE FROM order_items WHERE order_id = $1", [id]);
      await db.query("DELETE FROM payments WHERE order_id = $1", [id]);
      await db.query("DELETE FROM orders WHERE order_id = $1", [id]);

      await db.query("COMMIT");

      return res.json({ success: true, message: "Order cancelled successfully" });
    } catch (error) {
      await db.query("ROLLBACK");
      throw error;
    }
  } catch (error) {
    console.error("Cancel order error:", error);
    return res.status(500).json({ success: false, message: "Failed to cancel order" });
  }
});

module.exports = router;
