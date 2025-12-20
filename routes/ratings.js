// 📌 Ratings Routes - Customer ratings aur reviews manage karta hai
// Authentication required hai (requireAuth middleware)
const express = require("express");
const router = express.Router();
const db = require("./database");
const { requireAuth } = require("./auth");

// ========== CUSTOMER RATINGS ENDPOINTS ==========

// ⭐ Menu ITEM ko rate karta hai (authentication required)
// IMPORTANT: Customer sirf un items ko rate kar sakta hai jo usne order kiya ho
// Step 1: Rating validate karo (1-5 ke beech)
// Step 2: Check karo customer ne item order kiya hai ya nahi
// Step 3: Check karo customer ne pehle se rate kiya hai ya nahi
// Step 4: Rating database me save karo
router.post("/submit-item", requireAuth, async (req, res) => {
  try {
    const { rating, review_text, item_id } = req.body;
    const customerId = req.customer.customerId;

    // Validate rating value
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ 
        success: false, 
        message: "Rating must be between 1 and 5" 
      });
    }

    // STRICT VALIDATION: item_id is REQUIRED
    if (!item_id) {
      return res.status(400).json({
        success: false,
        message: "Item ID is required"
      });
    }

    // Verify item exists
    const itemExists = await db.query(
      `SELECT item_id, item_name FROM menu_items WHERE item_id = $1`,
      [item_id]
    );

    if (itemExists.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Menu item not found"
      });
    }

    // CRITICAL VALIDATION: Check if customer has ORDERED this item in a COMPLETED order
    const hasOrdered = await db.query(
      `SELECT EXISTS (
        SELECT 1
        FROM orders o
        INNER JOIN order_items oi ON o.order_id = oi.order_id
        WHERE o.customer_id = $1
        AND oi.item_id = $2
        AND o.status = 'completed'
      ) as has_ordered`,
      [customerId, item_id]
    );

    if (!hasOrdered.rows[0].has_ordered) {
      return res.status(403).json({
        success: false,
        message: "You can only rate items you have previously ordered and received"
      });
    }

    // Check if customer already rated this item
    const existingRating = await db.query(
      `SELECT rating_id FROM ratings WHERE customer_id = $1 AND item_id = $2`,
      [customerId, item_id]
    );

    if (existingRating.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: "You have already rated this item"
      });
    }

    // Insert rating (all validations passed)
    const result = await db.query(
      `INSERT INTO ratings (customer_id, rating_value, review_text, item_id) 
       VALUES ($1, $2, $3, $4) 
       RETURNING rating_id, customer_id, rating_value, review_text, item_id, created_at`,
      [customerId, rating, review_text || null, item_id]
    );

    return res.json({
      success: true,
      message: `Thank you for rating ${itemExists.rows[0].item_name}!`,
      rating: result.rows[0]
    });
  } catch (error) {
    console.error("Submit item rating error:", error);
    
    // Handle unique constraint violation
    if (error.code === '23505') {
      return res.status(400).json({
        success: false,
        message: "You have already rated this item"
      });
    }
    
    return res.status(500).json({ 
      success: false, 
      message: "Failed to submit rating" 
    });
  }
});

// Submit ORDER rating (requires authentication)
// STRICT RULE: Customer can ONLY rate their own completed orders
router.post("/submit-order", requireAuth, async (req, res) => {
  try {
    const { rating, review_text, order_id } = req.body;
    const customerId = req.customer.customerId;

    // Validate rating value
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ 
        success: false, 
        message: "Rating must be between 1 and 5" 
      });
    }

    // STRICT VALIDATION: order_id is REQUIRED
    if (!order_id) {
      return res.status(400).json({
        success: false,
        message: "Order ID is required"
      });
    }

    // CRITICAL VALIDATION: Verify order belongs to customer and is completed
    const orderCheck = await db.query(
      `SELECT order_id, status FROM orders 
       WHERE order_id = $1 AND customer_id = $2`,
      [order_id, customerId]
    );

    if (orderCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    if (orderCheck.rows[0].status !== 'completed') {
      return res.status(403).json({
        success: false,
        message: "You can only rate completed orders"
      });
    }

    // Check if customer already rated this order
    const existingRating = await db.query(
      `SELECT rating_id FROM ratings 
       WHERE customer_id = $1 AND order_id = $2`,
      [customerId, order_id]
    );

    if (existingRating.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: "You have already rated this order"
      });
    }

    // Insert order rating (item_id is NULL for order ratings)
    const result = await db.query(
      `INSERT INTO ratings (customer_id, rating_value, review_text, order_id) 
       VALUES ($1, $2, $3, $4) 
       RETURNING rating_id, customer_id, rating_value, review_text, order_id, created_at`,
      [customerId, rating, review_text || null, order_id]
    );

    return res.json({
      success: true,
      message: `Thank you for rating your order!`,
      rating: result.rows[0]
    });
  } catch (error) {
    console.error("Submit order rating error:", error);
    
    // Handle unique constraint violation
    if (error.code === '23505') {
      return res.status(400).json({
        success: false,
        message: "You have already rated this order"
      });
    }
    
    return res.status(500).json({ 
      success: false, 
      message: "Failed to submit rating" 
    });
  }
});

// Get customer's own ratings - ALL REVIEWS (requires authentication)
router.get("/my-ratings", requireAuth, async (req, res) => {
  try {
    const customerId = req.customer.customerId;

    const result = await db.query(
      `SELECT 
        r.rating_id, 
        r.customer_id, 
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
      [customerId]
    );

    return res.json({
      success: true,
      ratings: result.rows,
      totalReviews: result.rows.length
    });
  } catch (error) {
    console.error("Get my ratings error:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Failed to fetch ratings" 
    });
  }
});

// 🍽️ Customer ke ordered items fetch karta hai (rating ke liye eligible items)
// Sirf completed orders ke items dikhte hain
// Har item ke saath ye info hoti hai: kitni baar order kiya, already rated hai ya nahi
router.get("/ordered-items", requireAuth, async (req, res) => {
  try {
    const customerId = req.customer.customerId;

    // Customer ke completed orders ke items fetch karo
    const result = await db.query(
      `SELECT DISTINCT
        oi.item_id,
        mi.item_name,
        mi.price,
        mi.image_url,
        mi.description,
        mc.category_name,
        COUNT(oi.order_item_id) as times_ordered,
        MAX(o.created_at) as last_ordered,
        EXISTS (
          SELECT 1 FROM ratings r 
          WHERE r.customer_id = $1 
          AND r.item_id = oi.item_id
        ) as already_rated
      FROM orders o
      INNER JOIN order_items oi ON o.order_id = oi.order_id
      INNER JOIN menu_items mi ON oi.item_id = mi.item_id
      LEFT JOIN menu_category mc ON mi.category_id = mc.category_id
      WHERE o.customer_id = $1
      AND o.status = 'completed'
      GROUP BY oi.item_id, mi.item_name, mi.price, mi.image_url, mi.description, mc.category_name
      ORDER BY last_ordered DESC`,
      [customerId]
    );

    return res.json({
      success: true,
      orderedItems: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    console.error("Get ordered items error:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Failed to fetch ordered items" 
    });
  }
});

// 📊 Average rating aur distribution fetch karta hai (PUBLIC - No auth)
// Restaurant ka overall rating dikhane ke liye
router.get("/average", async (req, res) => {
  try {
    const result = await db.query(
      `SELECT 
        COUNT(*) as total_ratings,
        AVG(rating_value) as average_rating,
        COUNT(CASE WHEN rating_value = 5 THEN 1 END) as five_star,
        COUNT(CASE WHEN rating_value = 4 THEN 1 END) as four_star,
        COUNT(CASE WHEN rating_value = 3 THEN 1 END) as three_star,
        COUNT(CASE WHEN rating_value = 2 THEN 1 END) as two_star,
        COUNT(CASE WHEN rating_value = 1 THEN 1 END) as one_star
       FROM ratings`
    );

    const stats = result.rows[0];

    return res.json({
      success: true,
      stats: {
        totalRatings: parseInt(stats.total_ratings),
        averageRating: parseFloat(stats.average_rating || 0).toFixed(2),
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
    console.error("Get average rating error:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Failed to fetch average rating" 
    });
  }
});

// Get recent ratings with customer info via JOIN (PUBLIC - No auth required, limited info)
router.get("/recent", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const offset = parseInt(req.query.offset) || 0;
    const item_id = req.query.item_id; // Optional: filter by specific item

    let query = `
      SELECT 
        r.rating_id,
        r.customer_id,
        r.rating_value,
        r.review_text,
        r.item_id,
        r.created_at,
        c.name as customer_name,
        SUBSTRING(c.phone, 1, 2) || 'XXXXXX' || SUBSTRING(c.phone, 9, 2) as masked_phone,
        mi.item_name,
        mi.image_url as item_image
       FROM ratings r
       INNER JOIN customers c ON r.customer_id = c.customer_id
       LEFT JOIN menu_items mi ON r.item_id = mi.item_id
       WHERE r.review_text IS NOT NULL AND r.review_text != ''
    `;

    const params = [];
    
    // Filter by item_id if provided
    if (item_id) {
      query += ` AND r.item_id = $${params.length + 1}`;
      params.push(item_id);
    }

    query += ` ORDER BY r.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await db.query(query, params);

    return res.json({
      success: true,
      ratings: result.rows
    });
  } catch (error) {
    console.error("Get recent ratings error:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Failed to fetch recent ratings" 
    });
  }
});

module.exports = router;
