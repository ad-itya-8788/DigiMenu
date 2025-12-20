// Customer profile and order history routes

const express = require("express");
const router = express.Router();
const db = require("./database");
const { requireAuth } = require("./auth");

router.get("/profile", requireAuth, async (req, res) => {
  try {
    const customerId = req.customer.customerId;

    const customerResult = await db.query(
      "SELECT customer_id, name, phone, created_at FROM customers WHERE customer_id = $1",
      [customerId]
    );

    if (customerResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Customer not found" });
    }

    const customer = customerResult.rows[0];

    const ordersCountResult = await db.query(
      "SELECT COUNT(*) as total FROM orders WHERE customer_id = $1",
      [customerId]
    );

    const totalSpentResult = await db.query(
      "SELECT COALESCE(SUM(total_amount), 0) as total FROM orders WHERE customer_id = $1 AND status = 'completed'",
      [customerId]
    );

    return res.json({
      success: true,
      profile: {
        id: customer.customer_id,
        name: customer.name,
        phone: customer.phone,
        joinDate: customer.created_at,
        totalOrders: parseInt(ordersCountResult.rows[0].total),
        totalSpent: parseFloat(totalSpentResult.rows[0].total),
      },
    });
  } catch (error) {
    console.error("Get profile error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch profile" });
  }
});

router.get("/orders", requireAuth, async (req, res) => {
  try {
    const customerId = req.customer.customerId;
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;

    const ordersResult = await db.query(
      `SELECT 
        o.order_id,
        o.table_number,
        o.total_amount,
        o.status,
        o.created_at,
        p.payment_status,
        p.payment_method,
        p.razorpay_payment_id
      FROM orders o
      LEFT JOIN payments p ON o.order_id = p.order_id
      WHERE o.customer_id = $1
      ORDER BY o.created_at DESC
      LIMIT $2 OFFSET $3`,
      [customerId, limit, offset]
    );

    const orders = ordersResult.rows;

    const ordersWithItems = await Promise.all(
      orders.map(async (order) => {
        const itemsResult = await db.query(
          `SELECT 
            oi.order_item_id,
            oi.quantity,
            oi.price,
            mi.item_name,
            mi.image_url
          FROM order_items oi
          INNER JOIN menu_items mi ON oi.item_id = mi.item_id
          WHERE oi.order_id = $1`,
          [order.order_id]
        );

        return {
          orderId: order.order_id,
          tableNumber: order.table_number,
          totalAmount: parseFloat(order.total_amount),
          status: order.status,
          createdAt: order.created_at,
          paymentStatus: order.payment_status,
          paymentMethod: order.payment_method,
          items: itemsResult.rows.map((item) => ({
            name: item.item_name,
            quantity: item.quantity,
            price: parseFloat(item.price),
            imageUrl: item.image_url,
          })),
        };
      })
    );

    return res.json({
      success: true,
      orders: ordersWithItems,
      total: orders.length,
    });
  } catch (error) {
    console.error("Get orders error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch orders" });
  }
});

router.post("/profile/dob", requireAuth, async (req, res) => {
  try {
    const customerId = req.customer.customerId;
    const { dob } = req.body;

    if (!dob) {
      return res.status(400).json({ success: false, message: "Date of birth is required" });
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dob)) {
      return res.status(400).json({ success: false, message: "Invalid date format. Please use YYYY-MM-DD" });
    }

    const dobDate = new Date(dob);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (dobDate > today) {
      return res.status(400).json({ success: false, message: "Date of birth cannot be in the future" });
    }

    const age = today.getFullYear() - dobDate.getFullYear();
    const monthDiff = today.getMonth() - dobDate.getMonth();
    const dayDiff = today.getDate() - dobDate.getDate();
    const actualAge = monthDiff < 0 || (monthDiff === 0 && dayDiff < 0) ? age - 1 : age;

    if (actualAge < 13) {
      return res.status(400).json({ success: false, message: "You must be at least 13 years old" });
    }

    if (actualAge > 120) {
      return res.status(400).json({ success: false, message: "Please enter a valid date of birth" });
    }

    await db.query(
      "UPDATE customers SET dob = $1 WHERE customer_id = $2",
      [dob, customerId]
    );

    return res.json({
      success: true,
      message: "Date of birth updated successfully",
    });
  } catch (error) {
    console.error("Update DOB error:", error);
    return res.status(500).json({ success: false, message: "Failed to update date of birth" });
  }
});

module.exports = router;
