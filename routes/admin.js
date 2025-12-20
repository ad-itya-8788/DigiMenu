const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const db = require("./database");
const { requireAdmin } = require("./auth");
const bunnyCDN = require("./bunnyCDN");
const crypto = require("crypto");

// Configure multer for file uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("Only image files are allowed (jpeg, jpg, png, gif, webp)"));
    }
  },
});

// Hash password helper
const hashPassword = (password) => {
  return crypto.createHash('sha256').update(password).digest('hex');
};

// ========== MENU CATEGORIES CRUD ==========

// Get all categories
router.get("/categories", requireAdmin, async (req, res) => 
  {
  try
  {
    const result = await db.query("SELECT category_id, category_name FROM menu_category ORDER BY category_name");
    return res.json({ success: true, categories: result.rows });
  }
 catch(error)
  {
    console.error("Get categories error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch categories" });
  }
});

// Create category 
router.post("/categories", requireAdmin, async (req, res) => {
  try {
    const name = req.body.category_name?.trim();
    if (!name)
      return res.status(400).json({ success: false, message: "Category name is required" });

    const { rows } = await db.query(
      "INSERT INTO menu_category (category_name) VALUES ($1) RETURNING category_id, category_name",
      [name]
    );

    res.json({ success: true, category: rows[0] });

  } catch (error) {
    if (error.code === "23505")
      return res.status(409).json({ success: false, message: "Category already exists" });

    console.error("Create category error:", error);
    res.status(500).json({ success: false, message: "Failed to create category" });
  }
});



// Update category
router.put("/categories/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { category_name } = req.body;

    if (!category_name || !category_name.trim()) {
      return res.status(400).json({ success: false, message: "Category name is required" });
    }

    const result = await db.query(
      "UPDATE menu_category SET category_name = $1 WHERE category_id = $2 RETURNING category_id, category_name",
      [category_name.trim(), id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    return res.json({ success: true, category: result.rows[0] });
  } catch (error) {
    console.error("Update category error:", error);
    return res.status(500).json({ success: false, message: "Failed to update category" });
  }
});

// Delete category
router.delete("/categories/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query("DELETE FROM menu_category WHERE category_id = $1 RETURNING category_id", [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    return res.json({ success: true, message: "Category deleted successfully" });
  } catch (error) {
    console.error("Delete category error:", error);
    if (error.code === '23503') {
      return res.status(409).json({ success: false, message: "Cannot delete category with existing items" });
    }
    return res.status(500).json({ success: false, message: "Failed to delete category" });
  }
});

// ========== MENU ITEMS CRUD ==========

// Get all menu items
router.get("/items", requireAdmin, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        mi.item_id,
        mi.item_name,
        mi.category_id,
        mc.category_name,
        mi.price,
        mi.image_url,
        mi.description,
        mi.is_available
      FROM menu_items mi
      LEFT JOIN menu_category mc ON mi.category_id = mc.category_id
      ORDER BY mc.category_name, mi.item_name
    `);
    return res.json({ success: true, items: result.rows });
  } catch (error) {
    console.error("Get items error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch items" });
  }
});

// Create menu item with image upload
router.post("/items", requireAdmin, (req, res, next) => {
  upload.single("image")(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, message: "Image file is too large. Maximum size is 10MB." });
      }
      return res.status(400).json({ success: false, message: `Upload error: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next();
  });
}, async (req, res) => {
  try {
    const { item_name, category_id, price, description, is_available } = req.body;
    let image_url = null;

    if (!item_name || !category_id || !price) {
      return res.status(400).json({ success: false, message: "Item name, category, and price are required" });
    }

    // Upload image to Bunny CDN if provided
    if (req.file) {
      const uploadResult = await bunnyCDN.uploadImage(
        req.file.buffer,
        req.file.originalname,
        "menu-items"
      );

      if (uploadResult.success) {
        image_url = uploadResult.url;
      } else {
        return res.status(500).json({ success: false, message: "Failed to upload image" });
      }
    }

    // Convert is_available to boolean properly
    let isAvailableBool;
    if (is_available === undefined || is_available === null) {
      isAvailableBool = true; // Default to available
    } else if (typeof is_available === 'string') {
      isAvailableBool = is_available.toLowerCase() === 'true';
    } else {
      isAvailableBool = Boolean(is_available);
    }

    const result = await db.query(
      `INSERT INTO menu_items (item_name, category_id, price, image_url, description, is_available) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING item_id, item_name, category_id, price, image_url, description, is_available`,
      [item_name.trim(), category_id, parseFloat(price), image_url, description || null, isAvailableBool]
    );

    return res.json({ success: true, item: result.rows[0] });
  } catch (error) {
    console.error("Create item error:", error);
    return res.status(500).json({ success: false, message: "Failed to create item" });
  }
});

// Update menu item with image upload
router.put("/items/:id", requireAdmin, (req, res, next) => {
  upload.single("image")(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, message: "Image file is too large. Maximum size is 10MB." });
      }
      return res.status(400).json({ success: false, message: `Upload error: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next();
  });
}, async (req, res) => {
  try {
    const { id } = req.params;
    const { item_name, category_id, price, description, is_available, existing_image_url } = req.body;

    if (!item_name || !category_id || !price) {
      return res.status(400).json({ success: false, message: "Item name, category, and price are required" });
    }

    let image_url = existing_image_url || null;

    // Upload new image to Bunny CDN if provided
    if (req.file) {
      // Delete old image if exists
      if (existing_image_url) {
        await bunnyCDN.deleteImage(existing_image_url);
      }

      const uploadResult = await bunnyCDN.uploadImage(
        req.file.buffer,
        req.file.originalname,
        "menu-items"
      );

      if (uploadResult.success) {
        image_url = uploadResult.url;
      } else {
        return res.status(500).json({ success: false, message: "Failed to upload image" });
      }
    }

    // Convert is_available to boolean properly
    let isAvailableBool;
    if (is_available === undefined || is_available === null) {
      isAvailableBool = true; // Default to available
    } else if (typeof is_available === 'string') {
      isAvailableBool = is_available.toLowerCase() === 'true';
    } else {
      isAvailableBool = Boolean(is_available);
    }

    const result = await db.query(
      `UPDATE menu_items 
       SET item_name = $1, category_id = $2, price = $3, image_url = $4, description = $5, is_available = $6 
       WHERE item_id = $7 
       RETURNING item_id, item_name, category_id, price, image_url, description, is_available`,
      [item_name.trim(), category_id, parseFloat(price), image_url, description || null, isAvailableBool, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Item not found" });
    }

    return res.json({ success: true, item: result.rows[0] });
  } catch (error) {
    console.error("Update item error:", error);
    return res.status(500).json({ success: false, message: "Failed to update item" });
  }
});

// Delete menu item
router.delete("/items/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if item exists
    const itemResult = await db.query("SELECT item_name, image_url FROM menu_items WHERE item_id = $1", [id]);

    if (itemResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Item not found" });
    }

    // Check if item is referenced in any orders
    const orderCheck = await db.query(
      "SELECT COUNT(*) as count FROM order_items WHERE item_id = $1",
      [id]
    );

    if (parseInt(orderCheck.rows[0].count) > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete "${itemResult.rows[0].item_name}" because it is referenced in existing orders. You can mark it as unavailable instead.`
      });
    }

    // Delete image from Bunny CDN if exists
    if (itemResult.rows[0].image_url) {
      try {
        await bunnyCDN.deleteImage(itemResult.rows[0].image_url);
      } catch (cdnError) {
        // Ignore CDN delete errors (image might already be deleted)
      }
    }

    const result = await db.query("DELETE FROM menu_items WHERE item_id = $1 RETURNING item_id", [id]);

    return res.json({ success: true, message: "Item deleted successfully" });
  } catch (error) {
    console.error("Delete item error:", error);

    // Check for foreign key constraint violation
    if (error.code === '23503') {
      return res.status(400).json({
        success: false,
        message: "Cannot delete this item because it is referenced in existing orders. You can mark it as unavailable instead."
      });
    }

    return res.status(500).json({ success: false, message: "Failed to delete item" });
  }
});

// ========== ORDERS MANAGEMENT ==========

// Get all orders
router.get("/orders", requireAdmin, async (req, res) => {
  try {
    const { status, date_filter, limit = 50, offset = 0, view_type } = req.query;

    let query = `
      SELECT 
        o.order_id,
        o.customer_id,
        c.name as customer_name,
        c.phone as customer_phone,
        o.table_number,
        o.total_amount,
        o.status,
        o.created_at,
        p.payment_status,
        p.payment_method,
        p.created_at as payment_date,
        p.razorpay_payment_id,
        COALESCE(
          json_agg(
            json_build_object(
              'order_item_id', oi.order_item_id,
              'quantity', oi.quantity,
              'price', oi.price,
              'item_name', mi.item_name
            ) ORDER BY mi.item_name
          ) FILTER (WHERE oi.order_item_id IS NOT NULL),
          '[]'::json
        ) as items
      FROM orders o
      INNER JOIN customers c ON o.customer_id = c.customer_id
      LEFT JOIN payments p ON o.order_id = p.order_id
      LEFT JOIN order_items oi ON o.order_id = oi.order_id
      LEFT JOIN menu_items mi ON oi.item_id = mi.item_id
    `;

    const params = [];
    const conditions = [];
    const { custom_date } = req.query;

    // Filter based on view_type
    if (view_type === 'active') {
      // For admin.html - Show ALL active orders (not completed)
      // EXCLUDE completed orders from active view
      conditions.push(`o.status != 'completed'`);
      // Status filter will be applied below if provided
    } else if (view_type === 'old') {
      // For oldorders.html - show ALL orders from all time
      // No date restriction - show all orders
      // No status filter - show completed, cancelled, all statuses
    }

    if (status) {
      // Handle comma-separated status values (e.g., "pending,preparing,ready")
      if (status.includes(',')) {
        const statusList = status.split(',').map(s => s.trim());
        const placeholders = statusList.map((_, i) => `$${params.length + i + 1}`).join(',');
        conditions.push(`o.status IN (${placeholders})`);
        params.push(...statusList);
      } else {
        conditions.push(`o.status = $${params.length + 1}`);
        params.push(status);
      }
    }

    if (date_filter === 'today') {
      conditions.push(`DATE(o.created_at) = CURRENT_DATE`);
    } else if (date_filter === 'old') {
      conditions.push(`DATE(o.created_at) < CURRENT_DATE`);
    }

    // Custom date filter
    // Custom date filter removed - using today's date by default
    if (custom_date) {
      conditions.push(`DATE(o.created_at) = $${params.length + 1}`);
      params.push(custom_date);
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    query += ` 
      GROUP BY o.order_id, o.customer_id, c.name, c.phone, o.table_number, 
               o.total_amount, o.status, o.created_at, p.payment_status, 
               p.payment_method, p.created_at, p.razorpay_payment_id
      ORDER BY o.created_at DESC 
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    params.push(parseInt(limit), parseInt(offset));

    const result = await db.query(query, params);

    const ordersWithItems = result.rows.map(order => ({
      ...order,
      items: order.items || []
    }));

    return res.json({ success: true, orders: ordersWithItems });
  } catch (error) {
    console.error("Get orders error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch orders" });
  }
});

// Delete order
router.delete("/orders/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Start transaction
    await db.query("BEGIN");

    try {
      // Delete order items first (foreign key constraint)
      await db.query("DELETE FROM order_items WHERE order_id = $1", [id]);

      // Delete payment if exists
      await db.query("DELETE FROM payments WHERE order_id = $1", [id]);

      // Delete order
      const result = await db.query("DELETE FROM orders WHERE order_id = $1 RETURNING order_id", [id]);

      if (result.rows.length === 0) {
        await db.query("ROLLBACK");
        return res.status(404).json({ success: false, message: "Order not found" });
      }

      await db.query("COMMIT");

      return res.json({ success: true, message: "Order deleted successfully" });
    } catch (error) {
      await db.query("ROLLBACK");
      throw error;
    }
  } catch (error) {
    console.error("Delete order error:", error);
    return res.status(500).json({ success: false, message: "Failed to delete order" });
  }
});

// Update order status
router.put("/orders/:id/status", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['pending', 'preparing', 'ready', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({ success: false, message: "Valid status is required" });
    }

    const result = await db.query(
      "UPDATE orders SET status = $1 WHERE order_id = $2 RETURNING order_id, status",
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    return res.json({ success: true, order: result.rows[0] });
  } catch (error) {
    console.error("Update order status error:", error);
    return res.status(500).json({ success: false, message: "Failed to update order status" });
  }
});

// Mark order as paid (for cash payments at counter) - Updates ONLY payments table
router.put("/orders/:id/mark-paid", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if order exists
    const orderCheck = await db.query(
      "SELECT order_id, total_amount FROM orders WHERE order_id = $1",
      [id]
    );

    if (orderCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const order = orderCheck.rows[0];

    // Start transaction
    await db.query("BEGIN");

    try {
      // Check if payment record exists
      const paymentCheck = await db.query(
        "SELECT payment_id FROM payments WHERE order_id = $1",
        [id]
      );

      // Update ONLY payments table - NO orders table update
      if (paymentCheck.rows.length > 0) {
        await db.query(
          "UPDATE payments SET payment_status = 'completed', payment_method = 'cash' WHERE order_id = $1",
          [id]
        );
      } else {
        // Create payment record
        await db.query(
          "INSERT INTO payments (order_id, amount, payment_status, payment_method) VALUES ($1, $2, 'completed', 'cash')",
          [id, order.total_amount]
        );
      }

      await db.query("COMMIT");

      return res.json({ success: true, message: "Order marked as paid successfully" });
    } catch (error) {
      await db.query("ROLLBACK");
      throw error;
    }
  } catch (error) {
    console.error("Mark order as paid error:", error);
    return res.status(500).json({ success: false, message: "Failed to mark order as paid" });
  }
});

// Get dashboard stats
router.get("/dashboard/stats", requireAdmin, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalOrders,
      todayOrders,
      totalRevenue,
      todayRevenue,
      pendingOrders,
      totalCustomers,
    ] = await Promise.all([
      db.query("SELECT COUNT(*) as count FROM orders"),
      db.query("SELECT COUNT(*) as count FROM orders WHERE created_at >= $1", [today]),
      db.query(`
        SELECT COALESCE(SUM(o.total_amount), 0) as total 
        FROM orders o 
        INNER JOIN payments p ON o.order_id = p.order_id 
        WHERE p.payment_status = 'completed'
      `),
      db.query(`
        SELECT COALESCE(SUM(o.total_amount), 0) as total 
        FROM orders o 
        INNER JOIN payments p ON o.order_id = p.order_id 
        WHERE p.payment_status = 'completed' AND o.created_at >= $1
      `, [today]),
      db.query("SELECT COUNT(*) as count FROM orders WHERE status IN ('pending', 'preparing', 'ready')"),
      db.query("SELECT COUNT(*) as count FROM customers"),
    ]);

    return res.json({
      success: true,
      stats: {
        totalOrders: parseInt(totalOrders.rows[0].count),
        todayOrders: parseInt(todayOrders.rows[0].count),
        totalRevenue: parseFloat(totalRevenue.rows[0].total),
        todayRevenue: parseFloat(todayRevenue.rows[0].total),
        pendingOrders: parseInt(pendingOrders.rows[0].count),
        totalCustomers: parseInt(totalCustomers.rows[0].count),
      },
    });
  } catch (error) {
    console.error("Get dashboard stats error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch stats" });
  }
});

// ========== USERS & REPORTS ==========

// Get customer statistics
router.get("/customer-stats", requireAdmin, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalCustomers, todayCustomers] = await Promise.all([
      db.query("SELECT COUNT(*) as count FROM customers"),
      db.query("SELECT COUNT(*) as count FROM customers WHERE DATE(created_at) = CURRENT_DATE"),
    ]);

    return res.json({
      success: true,
      stats: {
        totalCustomers: parseInt(totalCustomers.rows[0].count),
        todayCustomers: parseInt(todayCustomers.rows[0].count),
      },
    });
  } catch (error) {
    console.error("Get customer stats error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch customer stats" });
  }
});

// Get all users with their order statistics
router.get("/users", requireAdmin, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        c.customer_id,
        c.name,
        c.phone,
        c.dob,
        c.created_at as joined_date,
        COUNT(DISTINCT o.order_id) as total_orders,
        COALESCE(SUM(CASE WHEN o.status = 'completed' THEN o.total_amount ELSE 0 END), 0) as total_spent,
        MAX(o.created_at) as last_order_date
      FROM customers c
      LEFT JOIN orders o ON c.customer_id = o.customer_id
      GROUP BY c.customer_id, c.name, c.phone, c.dob, c.created_at
      ORDER BY total_orders DESC, c.created_at DESC
    `);

    return res.json({ success: true, users: result.rows });
  } catch (error) {
    console.error("Get users error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch users" });
  }
});

// Get user details with order history and reviews
router.get("/users/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Get user info
    const userResult = await db.query(
      "SELECT customer_id, name, phone, dob, created_at FROM customers WHERE customer_id = $1",
      [id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Get user orders with items in single query
    const ordersResult = await db.query(
      `SELECT 
        o.order_id,
        o.table_number,
        o.total_amount,
        o.status,
        o.created_at,
        p.payment_status,
        p.payment_method,
        COALESCE(
          json_agg(
            json_build_object(
              'order_item_id', oi.order_item_id,
              'quantity', oi.quantity,
              'price', oi.price,
              'item_name', mi.item_name
            ) ORDER BY mi.item_name
          ) FILTER (WHERE oi.order_item_id IS NOT NULL),
          '[]'::json
        ) as items
      FROM orders o
      LEFT JOIN payments p ON o.order_id = p.order_id
      LEFT JOIN order_items oi ON o.order_id = oi.order_id
      LEFT JOIN menu_items mi ON oi.item_id = mi.item_id
      WHERE o.customer_id = $1
      GROUP BY o.order_id, o.table_number, o.total_amount, o.status, o.created_at, 
               p.payment_status, p.payment_method
      ORDER BY o.created_at DESC`,
      [id]
    );

    const ordersWithItems = ordersResult.rows;

    // Get user reviews (both order and item reviews)
    const reviewsResult = await db.query(
      `SELECT 
        r.rating_id,
        r.rating_value,
        r.review_text,
        r.item_id,
        r.order_id,
        r.created_at,
        mi.item_name,
        mi.image_url as item_image
      FROM ratings r
      LEFT JOIN menu_items mi ON r.item_id = mi.item_id
      WHERE r.customer_id = $1
      ORDER BY r.created_at DESC`,
      [id]
    );

    return res.json({
      success: true,
      user: userResult.rows[0],
      orders: ordersWithItems,
      reviews: reviewsResult.rows,
    });
  } catch (error) {
    console.error("Get user details error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch user details" });
  }
});

// ========== NOTIFICATIONS ==========

// Get notifications (recent orders, low stock, etc.)
router.get("/notifications", requireAdmin, async (req, res) => {
  try {
    const notifications = [];

    // Recent pending orders
    const pendingOrders = await db.query(
      `SELECT COUNT(*) as count FROM orders 
       WHERE status IN ('pending', 'preparing', 'ready') 
       AND created_at > NOW() - INTERVAL '24 hours'`
    );

    if (parseInt(pendingOrders.rows[0].count) > 0) {
      notifications.push({
        type: "order",
        message: `${pendingOrders.rows[0].count} pending order(s) need attention`,
        priority: "high",
        timestamp: null,
      });
    }

    // Today's new orders
    const todayOrders = await db.query(
      `SELECT COUNT(*) as count FROM orders 
       WHERE created_at::date = CURRENT_DATE`
    );

    if (parseInt(todayOrders.rows[0].count) > 0) {
      notifications.push({
        type: "info",
        message: `${todayOrders.rows[0].count} new order(s) today`,
        priority: "medium",
        timestamp: null,
      });
    }

    // New customers today
    const newCustomers = await db.query(
      `SELECT COUNT(*) as count FROM customers 
       WHERE created_at::date = CURRENT_DATE`
    );

    if (parseInt(newCustomers.rows[0].count) > 0) {
      notifications.push({
        type: "user",
        message: `${newCustomers.rows[0].count} new customer(s) registered today`,
        priority: "low",
        timestamp: null,
      });
    }

    return res.json({ success: true, notifications });
  } catch (error) {
    console.error("Get notifications error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch notifications" });
  }
});

// ========== RATINGS MANAGEMENT ==========


// Admin ke liye saare ratings fetch karo
router.get("/ratings", requireAdmin, async (req, res) => {
  try {
    // Database se saare ratings fetch karo with customer aur item details
    const query = `
      SELECT 
        r.rating_id,
        r.customer_id,
        r.order_id,
        r.rating_value,
        r.review_text,
        r.item_id,
        r.created_at,
        c.name as customer_name,
        c.phone as customer_phone,
        mi.item_name,
        mi.image_url as item_image,
        mc.category_name as item_category
      FROM ratings r
      INNER JOIN customers c ON r.customer_id = c.customer_id
      LEFT JOIN menu_items mi ON r.item_id = mi.item_id
      LEFT JOIN menu_category mc ON mi.category_id = mc.category_id
      ORDER BY r.created_at DESC
    `;

    const result = await db.query(query);

    // Statistics calculate karo
    const statsResult = await db.query(`
      SELECT 
        COUNT(*) as total_ratings,
        AVG(rating_value) as average_rating,
        COUNT(CASE WHEN review_text IS NOT NULL AND review_text != '' THEN 1 END) as with_review,
        COUNT(CASE WHEN DATE(created_at) = CURRENT_DATE THEN 1 END) as today_ratings
      FROM ratings
    `);

    const stats = statsResult.rows[0];

    // Response bhejo
    return res.json({
      success: true,
      ratings: result.rows,
      total: result.rows.length,
      stats: {
        totalRatings: parseInt(stats.total_ratings),
        averageRating: parseFloat(stats.average_rating || 0).toFixed(2),
        todayRatings: parseInt(stats.today_ratings),
        withReview: parseInt(stats.with_review)
      }
    });
  } catch (error) {
    console.error("Get ratings error:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Failed to fetch ratings" 
    });
  }
});


// Delete a rating
router.delete("/ratings/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      "DELETE FROM ratings WHERE rating_id = $1 RETURNING rating_id",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Rating not found" });
    }

    return res.json({ success: true, message: "Rating deleted successfully" });
  } catch (error) {
    console.error("Delete rating error:", error);
    return res.status(500).json({ success: false, message: "Failed to delete rating" });
  }
});

// Get rating statistics for dashboard
router.get("/ratings/stats", requireAdmin, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        COUNT(*) as total_ratings,
        AVG(rating_value) as average_rating,
        COUNT(CASE WHEN rating_value = 5 THEN 1 END) as five_star,
        COUNT(CASE WHEN rating_value = 4 THEN 1 END) as four_star,
        COUNT(CASE WHEN rating_value = 3 THEN 1 END) as three_star,
        COUNT(CASE WHEN rating_value = 2 THEN 1 END) as two_star,
        COUNT(CASE WHEN rating_value = 1 THEN 1 END) as one_star,
        COUNT(CASE WHEN DATE(created_at) = CURRENT_DATE THEN 1 END) as today_ratings,
        COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as week_ratings,
        COUNT(CASE WHEN review_text IS NOT NULL AND review_text != '' THEN 1 END) as with_review
      FROM ratings
    `);

    const stats = result.rows[0];

    return res.json({
      success: true,
      stats: {
        totalRatings: parseInt(stats.total_ratings),
        averageRating: parseFloat(stats.average_rating || 0).toFixed(2),
        todayRatings: parseInt(stats.today_ratings),
        weekRatings: parseInt(stats.week_ratings),
        withReview: parseInt(stats.with_review),
        distribution: {
          5: parseInt(stats.five_star),
          4: parseInt(stats.four_star),
          3: parseInt(stats.three_star),
          2: parseInt(stats.two_star),
          1: parseInt(stats.one_star)
        }
      }
    });
  } catch (error) {
    console.error("Get rating stats error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch rating statistics" });
  }
});

// ========== ADMIN MANAGEMENT ==========

// Get all admins
router.get("/admins", requireAdmin, async (req, res) => {
  try {
    const result = await db.query(
      "SELECT admin_id, name, username, email, created_at FROM admins ORDER BY created_at DESC"
    );
    return res.json({ success: true, admins: result.rows });
  } catch (error) {
    console.error("Get admins error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch admins" });
  }
});

// Update admin details
router.put("/admins/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, username, email } = req.body;

    if (!username) {
      return res.status(400).json({ success: false, message: "Username is required" });
    }

    // Check if username is taken by another admin
    const existingAdmin = await db.query(
      "SELECT admin_id FROM admins WHERE username = $1 AND admin_id != $2",
      [username, id]
    );
    if (existingAdmin.rows.length > 0) {
      return res.status(409).json({ success: false, message: "Username already exists" });
    }

    // Check if email is taken by another admin (if provided)
    if (email) {
      const existingEmail = await db.query(
        "SELECT admin_id FROM admins WHERE email = $1 AND admin_id != $2",
        [email, id]
      );
      if (existingEmail.rows.length > 0) {
        return res.status(409).json({ success: false, message: "Email already exists" });
      }
    }

    const result = await db.query(
      "UPDATE admins SET name = $1, username = $2, email = $3 WHERE admin_id = $4 RETURNING admin_id, name, username, email",
      [name || null, username, email || null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Admin not found" });
    }

    return res.json({ success: true, admin: result.rows[0] });
  } catch (error) {
    console.error("Update admin error:", error);
    return res.status(500).json({ success: false, message: "Failed to update admin" });
  }
});

// Delete admin
router.delete("/admins/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent deleting yourself
    if (parseInt(id) === req.admin.id) {
      return res.status(400).json({ success: false, message: "You cannot delete your own account" });
    }

    // Check if admin exists
    const adminCheck = await db.query("SELECT admin_id FROM admins WHERE admin_id = $1", [id]);
    if (adminCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Admin not found" });
    }

    // Delete admin sessions first
    await db.query("DELETE FROM sessions WHERE customer_id = $1", [id]);

    // Delete admin
    await db.query("DELETE FROM admins WHERE admin_id = $1", [id]);

    return res.json({ success: true, message: "Admin deleted successfully" });
  } catch (error) {
    console.error("Delete admin error:", error);
    return res.status(500).json({ success: false, message: "Failed to delete admin" });
  }
});

// Change password
router.put("/change-password", requireAdmin, async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmNewPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

    if (newPassword !== confirmNewPassword) {
      return res.status(400).json({ success: false, message: "New passwords do not match" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: "New password must be at least 6 characters" });
    }

    // Verify current password
    const hashedCurrentPassword = hashPassword(currentPassword);
    const adminCheck = await db.query(
      "SELECT admin_id FROM admins WHERE admin_id = $1 AND password = $2",
      [req.admin.id, hashedCurrentPassword]
    );

    if (adminCheck.rows.length === 0) {
      return res.status(401).json({ success: false, message: "Current password is incorrect" });
    }

    // Update password
    const hashedNewPassword = hashPassword(newPassword);
    await db.query(
      "UPDATE admins SET password = $1 WHERE admin_id = $2",
      [hashedNewPassword, req.admin.id]
    );

    return res.json({ success: true, message: "Password changed successfully" });
  } catch (error) {
    console.error("Change password error:", error);
    return res.status(500).json({ success: false, message: "Failed to change password" });
  }
});

// ========== ORDER ACCEPTANCE TOGGLE ==========

// Get order acceptance status
router.get("/order-accept-status", async (req, res) => {
  try {
    const result = await db.query("SELECT is_order_accept FROM admins LIMIT 1");
    const isOrderAccept = result.rows.length > 0 ? result.rows[0].is_order_accept : true;
    return res.json({ success: true, isOrderAccept });
  } catch (error) {
    console.error("Get order accept status error:", error);
    return res.status(500).json({ success: false, message: "Failed to get status" });
  }
});

// Toggle order acceptance
router.post("/toggle-order-accept", requireAdmin, async (req, res) => {
  try {
    const { enabled } = req.body;
    await db.query("UPDATE admins SET is_order_accept = $1", [enabled]);
    return res.json({
      success: true,
      message: enabled ? "Orders enabled" : "Orders disabled",
      isOrderAccept: enabled
    });
  } catch (error) {
    console.error("Toggle order accept error:", error);
    return res.status(500).json({ success: false, message: "Failed to toggle orders" });
  }
});

module.exports = router;