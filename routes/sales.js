// 📌 Sales Routes - Admin ke liye sales reports aur statistics
// Sirf admin access kar sakta hai (requireAdmin middleware)
const express = require("express");
const router = express.Router();
const db = require("./database");
const { requireAdmin } = require("./auth");

// 📊 Overview statistics - Total orders, revenue, customers
// Period filter: today, week, month, all
router.get("/stats/overview", requireAdmin, async (req, res) => {
  try {
    const period = req.query.period || "all";
    let dateCondition = "";
    
    if (period === "today") {
      dateCondition = "AND DATE(created_at) = CURRENT_DATE";
    } else if (period === "week") {
      dateCondition = "AND created_at >= CURRENT_DATE - INTERVAL '7 days'";
    } else if (period === "month") {
      dateCondition = "AND created_at >= CURRENT_DATE - INTERVAL '30 days'";
    }

    const statsQuery = `
      SELECT 
        COUNT(order_id) as total_orders,
        COUNT(DISTINCT customer_id) as total_customers,
        COALESCE(SUM(total_amount), 0) as total_revenue,
        COALESCE(AVG(total_amount), 0) as avg_order_value
      FROM orders 
      WHERE 1=1 ${dateCondition}
    `;

    const stats = await db.query(statsQuery);
    res.json({ success: true, stats: stats.rows[0] });
  } catch (error) {
    console.error("Get overview stats error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// 🏆 Best selling items - Sabse zyada bikne wale items
// Quantity ke basis pe sort hota hai
// Period filter: today, week, month, all
router.get("/stats/best-sellers", requireAdmin, async (req, res) => {
  try {
    const period = req.query.period || "all";
    const limit = parseInt(req.query.limit) || 10;
    let dateCondition = "";
    
    // Period ke basis pe date filter apply karo
    if (period === "today") {
      dateCondition = "AND DATE(o.created_at) = CURRENT_DATE";
    } else if (period === "week") {
      dateCondition = "AND o.created_at >= CURRENT_DATE - INTERVAL '7 days'";
    } else if (period === "month") {
      dateCondition = "AND o.created_at >= CURRENT_DATE - INTERVAL '30 days'";
    }

    // Items ko quantity sold ke basis pe sort karo
    const query = `
      SELECT 
        i.item_id,
        i.item_name as name,
        i.price,
        COALESCE(mc.category_name, 'Uncategorized') as category,
        i.image_url,
        SUM(oi.quantity) as total_quantity_sold,
        SUM(oi.quantity * oi.price) as total_revenue
      FROM order_items oi
      INNER JOIN menu_items i ON oi.item_id = i.item_id
      LEFT JOIN menu_category mc ON i.category_id = mc.category_id
      INNER JOIN orders o ON oi.order_id = o.order_id
      WHERE 1=1 ${dateCondition}
      GROUP BY i.item_id, i.item_name, i.price, mc.category_name, i.image_url
      ORDER BY total_quantity_sold DESC
      LIMIT ${limit}
    `;

    const result = await db.query(query);
    res.json({ success: true, items: result.rows });
  } catch (error) {
    console.error("Get best sellers error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

router.get("/stats/worst-sellers", requireAdmin, async (req, res) => {
  try {
    const period = req.query.period || "all";
    const limit = parseInt(req.query.limit) || 10;
    let dateCondition = "";
    
    if (period === "today") {
      dateCondition = "AND DATE(o.created_at) = CURRENT_DATE";
    } else if (period === "week") {
      dateCondition = "AND o.created_at >= CURRENT_DATE - INTERVAL '7 days'";
    } else if (period === "month") {
      dateCondition = "AND o.created_at >= CURRENT_DATE - INTERVAL '30 days'";
    }

    const query = `
      SELECT 
        i.item_id,
        i.item_name as name,
        i.price,
        COALESCE(mc.category_name, 'Uncategorized') as category,
        i.image_url,
        COALESCE(SUM(oi.quantity), 0) as total_quantity_sold,
        COALESCE(SUM(oi.quantity * oi.price), 0) as total_revenue
      FROM menu_items i
      LEFT JOIN menu_category mc ON i.category_id = mc.category_id
      LEFT JOIN order_items oi ON i.item_id = oi.item_id
      LEFT JOIN orders o ON oi.order_id = o.order_id
      WHERE i.is_available = true ${dateCondition !== "" ? dateCondition : ""}
      GROUP BY i.item_id, i.item_name, i.price, mc.category_name, i.image_url
      ORDER BY total_quantity_sold ASC
      LIMIT ${limit}
    `;

    const result = await db.query(query);
    res.json({ success: true, items: result.rows });
  } catch (error) {
    console.error("Get worst sellers error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Get sales by category
router.get("/stats/by-category", requireAdmin, async (req, res) => {
  try {
    const period = req.query.period || "all";
    let dateCondition = "";
    
    if (period === "today") {
      dateCondition = "AND DATE(o.created_at) = CURRENT_DATE";
    } else if (period === "week") {
      dateCondition = "AND o.created_at >= CURRENT_DATE - INTERVAL '7 days'";
    } else if (period === "month") {
      dateCondition = "AND o.created_at >= CURRENT_DATE - INTERVAL '30 days'";
    }

    const query = `
      SELECT 
        COALESCE(mc.category_name, 'Uncategorized') as category,
        SUM(oi.quantity * oi.price) as total_revenue
      FROM order_items oi
      INNER JOIN menu_items i ON oi.item_id = i.item_id
      LEFT JOIN menu_category mc ON i.category_id = mc.category_id
      INNER JOIN orders o ON oi.order_id = o.order_id
      WHERE 1=1 ${dateCondition}
      GROUP BY mc.category_name
      ORDER BY total_revenue DESC
    `;

    const result = await db.query(query);
    res.json({ success: true, categories: result.rows });
  } catch (error) {
    console.error("Get category stats error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Get revenue trend
router.get("/stats/revenue-trend", requireAdmin, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;

    const query = `
      SELECT 
        DATE(created_at) as date,
        COALESCE(SUM(total_amount), 0) as revenue
      FROM orders
      WHERE created_at >= CURRENT_DATE - INTERVAL '${days} days'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `;

    const result = await db.query(query);
    res.json({ success: true, trend: result.rows });
  } catch (error) {
    console.error("Get revenue trend error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// 💳 Payment methods statistics - Cash vs Razorpay breakdown
// Payments table se data fetch hota hai (orders table se nahi)
router.get("/stats/payment-methods", requireAdmin, async (req, res) => {
  try {
    const period = req.query.period || "all";
    let dateCondition = "";
    
    if (period === "today") {
      dateCondition = "AND DATE(o.created_at) = CURRENT_DATE";
    } else if (period === "week") {
      dateCondition = "AND o.created_at >= CURRENT_DATE - INTERVAL '7 days'";
    } else if (period === "month") {
      dateCondition = "AND o.created_at >= CURRENT_DATE - INTERVAL '30 days'";
    }

    // Payment method payments table se fetch karo (orders table me nahi hai)
    const query = `
      SELECT 
        COALESCE(p.payment_method, 'cash') as payment_method,
        COALESCE(SUM(o.total_amount), 0) as total_amount
      FROM orders o
      LEFT JOIN payments p ON o.order_id = p.order_id
      WHERE 1=1 ${dateCondition}
      GROUP BY p.payment_method
      ORDER BY total_amount DESC
    `;

    const result = await db.query(query);
    res.json({ success: true, payment_methods: result.rows });
  } catch (error) {
    console.error("Get payment methods error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Get peak hours
router.get("/stats/peak-hours", requireAdmin, async (req, res) => {
  try {
    const period = req.query.period || "week";
    let dateCondition = "";
    
    if (period === "today") {
      dateCondition = "AND DATE(created_at) = CURRENT_DATE";
    } else if (period === "week") {
      dateCondition = "AND created_at >= CURRENT_DATE - INTERVAL '7 days'";
    } else if (period === "month") {
      dateCondition = "AND created_at >= CURRENT_DATE - INTERVAL '30 days'";
    }

    const query = `
      SELECT 
        EXTRACT(HOUR FROM created_at)::integer as hour,
        COUNT(order_id) as order_count
      FROM orders
      WHERE 1=1 ${dateCondition}
      GROUP BY EXTRACT(HOUR FROM created_at)
      ORDER BY hour ASC
    `;

    const result = await db.query(query);
    res.json({ success: true, peak_hours: result.rows });
  } catch (error) {
    console.error("Get peak hours error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Get top customers
router.get("/stats/customers", requireAdmin, async (req, res) => {
  try {
    const period = req.query.period || "all";
    let dateCondition = "";
    
    if (period === "today") {
      dateCondition = "AND DATE(o.created_at) = CURRENT_DATE";
    } else if (period === "week") {
      dateCondition = "AND o.created_at >= CURRENT_DATE - INTERVAL '7 days'";
    } else if (period === "month") {
      dateCondition = "AND o.created_at >= CURRENT_DATE - INTERVAL '30 days'";
    }

    const query = `
      SELECT 
        c.customer_id,
        c.name,
        c.phone,
        COUNT(o.order_id) as total_orders,
        COALESCE(SUM(o.total_amount), 0) as total_spent,
        MAX(o.created_at) as last_order_date
      FROM customers c
      INNER JOIN orders o ON c.customer_id = o.customer_id
      WHERE 1=1 ${dateCondition}
      GROUP BY c.customer_id, c.name, c.phone
      ORDER BY total_spent DESC
      LIMIT 20
    `;

    const result = await db.query(query);
    res.json({ success: true, top_customers: result.rows });
  } catch (error) {
    console.error("Get top customers error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
