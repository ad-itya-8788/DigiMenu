// Sales Routes - Admin ke liye sales reports
const express = require("express");
const router = express.Router();
const db = require("./database");
const { requireAdmin } = require("./auth");

// Overview statistics
router.get("/stats/overview", requireAdmin, async (req, res) => {
  try {
    const period = req.query.period || "all";
    let dateFilter = "";
    
    if (period === "today") {
      dateFilter = "WHERE DATE(created_at) = CURRENT_DATE";
    } else if (period === "week") {
      dateFilter = "WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'";
    } else if (period === "month") {
      dateFilter = "WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'";
    }

    const result = await db.query(`
      SELECT 
        COUNT(*) as total_orders,
        COUNT(DISTINCT customer_id) as total_customers,
        COALESCE(SUM(total_amount), 0) as total_revenue,
        COALESCE(AVG(total_amount), 0) as avg_order_value
      FROM orders 
      ${dateFilter}
    `);

    res.json({ success: true, stats: result.rows[0] });
  } catch (error) {
    console.error("Overview stats error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Best selling items
router.get("/stats/best-sellers", requireAdmin, async (req, res) => {
  try {
    const period = req.query.period || "all";
    const limit = parseInt(req.query.limit) || 10;
    let dateFilter = "";
    
    if (period === "today") {
      dateFilter = "AND DATE(o.created_at) = CURRENT_DATE";
    } else if (period === "week") {
      dateFilter = "AND o.created_at >= CURRENT_DATE - INTERVAL '7 days'";
    } else if (period === "month") {
      dateFilter = "AND o.created_at >= CURRENT_DATE - INTERVAL '30 days'";
    }

    const result = await db.query(`
      SELECT 
        i.item_id,
        i.item_name as name,
        i.price,
        COALESCE(mc.category_name, 'Uncategorized') as category,
        i.image_url,
        SUM(oi.quantity) as total_quantity_sold,
        SUM(oi.quantity * oi.price) as total_revenue
      FROM order_items oi
      JOIN menu_items i ON oi.item_id = i.item_id
      LEFT JOIN menu_category mc ON i.category_id = mc.category_id
      JOIN orders o ON oi.order_id = o.order_id
      WHERE 1=1 ${dateFilter}
      GROUP BY i.item_id, i.item_name, i.price, mc.category_name, i.image_url
      ORDER BY total_quantity_sold DESC
      LIMIT $1
    `, [limit]);

    res.json({ success: true, items: result.rows });
  } catch (error) {
    console.error("Best sellers error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Worst selling items
router.get("/stats/worst-sellers", requireAdmin, async (req, res) => {
  try {
    const period = req.query.period || "all";
    const limit = parseInt(req.query.limit) || 10;
    let dateFilter = "";
    
    if (period === "today") {
      dateFilter = "AND DATE(o.created_at) = CURRENT_DATE";
    } else if (period === "week") {
      dateFilter = "AND o.created_at >= CURRENT_DATE - INTERVAL '7 days'";
    } else if (period === "month") {
      dateFilter = "AND o.created_at >= CURRENT_DATE - INTERVAL '30 days'";
    }

    const result = await db.query(`
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
      LEFT JOIN orders o ON oi.order_id = o.order_id ${dateFilter.replace('WHERE', 'AND')}
      WHERE i.is_available = true
      GROUP BY i.item_id, i.item_name, i.price, mc.category_name, i.image_url
      ORDER BY total_quantity_sold ASC
      LIMIT $1
    `, [limit]);

    res.json({ success: true, items: result.rows });
  } catch (error) {
    console.error("Worst sellers error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Sales by category
router.get("/stats/by-category", requireAdmin, async (req, res) => {
  try {
    const period = req.query.period || "all";
    let dateFilter = "";
    
    if (period === "today") {
      dateFilter = "AND DATE(o.created_at) = CURRENT_DATE";
    } else if (period === "week") {
      dateFilter = "AND o.created_at >= CURRENT_DATE - INTERVAL '7 days'";
    } else if (period === "month") {
      dateFilter = "AND o.created_at >= CURRENT_DATE - INTERVAL '30 days'";
    }

    const result = await db.query(`
      SELECT 
        COALESCE(mc.category_name, 'Uncategorized') as category,
        SUM(oi.quantity * oi.price) as total_revenue
      FROM order_items oi
      JOIN menu_items i ON oi.item_id = i.item_id
      LEFT JOIN menu_category mc ON i.category_id = mc.category_id
      JOIN orders o ON oi.order_id = o.order_id
      WHERE 1=1 ${dateFilter}
      GROUP BY mc.category_name
      ORDER BY total_revenue DESC
    `);

    res.json({ success: true, categories: result.rows });
  } catch (error) {
    console.error("Category stats error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Revenue trend
router.get("/stats/revenue-trend", requireAdmin, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;

    const result = await db.query(`
      SELECT 
        DATE(created_at) as date,
        COALESCE(SUM(total_amount), 0) as revenue
      FROM orders
      WHERE created_at >= CURRENT_DATE - INTERVAL '${days} days'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `);

    res.json({ success: true, trend: result.rows });
  } catch (error) {
    console.error("Revenue trend error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Payment methods statistics
router.get("/stats/payment-methods", requireAdmin, async (req, res) => {
  try {
    const period = req.query.period || "all";
    let dateFilter = "";
    
    if (period === "today") {
      dateFilter = "AND DATE(o.created_at) = CURRENT_DATE";
    } else if (period === "week") {
      dateFilter = "AND o.created_at >= CURRENT_DATE - INTERVAL '7 days'";
    } else if (period === "month") {
      dateFilter = "AND o.created_at >= CURRENT_DATE - INTERVAL '30 days'";
    }

    const result = await db.query(`
      SELECT 
        COALESCE(p.payment_method, 'cash') as payment_method,
        COALESCE(SUM(o.total_amount), 0) as total_amount
      FROM orders o
      LEFT JOIN payments p ON o.order_id = p.order_id
      WHERE 1=1 ${dateFilter}
      GROUP BY p.payment_method
      ORDER BY total_amount DESC
    `);

    res.json({ success: true, payment_methods: result.rows });
  } catch (error) {
    console.error("Payment methods error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Peak hours
router.get("/stats/peak-hours", requireAdmin, async (req, res) => {
  try {
    const period = req.query.period || "week";
    let dateFilter = "";
    
    if (period === "today") {
      dateFilter = "AND DATE(created_at) = CURRENT_DATE";
    } else if (period === "week") {
      dateFilter = "AND created_at >= CURRENT_DATE - INTERVAL '7 days'";
    } else if (period === "month") {
      dateFilter = "AND created_at >= CURRENT_DATE - INTERVAL '30 days'";
    }

    const result = await db.query(`
      SELECT 
        EXTRACT(HOUR FROM created_at)::integer as hour,
        COUNT(*) as order_count
      FROM orders
      WHERE 1=1 ${dateFilter}
      GROUP BY EXTRACT(HOUR FROM created_at)
      ORDER BY hour ASC
    `);

    res.json({ success: true, peak_hours: result.rows });
  } catch (error) {
    console.error("Peak hours error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Top customers
router.get("/stats/customers", requireAdmin, async (req, res) => {
  try {
    const period = req.query.period || "all";
    let dateFilter = "";
    
    if (period === "today") {
      dateFilter = "AND DATE(o.created_at) = CURRENT_DATE";
    } else if (period === "week") {
      dateFilter = "AND o.created_at >= CURRENT_DATE - INTERVAL '7 days'";
    } else if (period === "month") {
      dateFilter = "AND o.created_at >= CURRENT_DATE - INTERVAL '30 days'";
    }

    const result = await db.query(`
      SELECT 
        c.customer_id,
        c.name,
        c.phone,
        COUNT(o.order_id) as total_orders,
        COALESCE(SUM(o.total_amount), 0) as total_spent,
        MAX(o.created_at) as last_order_date
      FROM customers c
      JOIN orders o ON c.customer_id = o.customer_id
      WHERE 1=1 ${dateFilter}
      GROUP BY c.customer_id, c.name, c.phone
      ORDER BY total_spent DESC
      LIMIT 20
    `);

    res.json({ success: true, top_customers: result.rows });
  } catch (error) {
    console.error("Top customers error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
