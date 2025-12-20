// Public menu routes for customers

const express = require("express");
const router = express.Router();
const db = require("./database");

router.get("/categories", async (req, res) => {
  try {
    const result = await db.query("SELECT category_id, category_name FROM menu_category ORDER BY category_name");
    return res.json({
      success: true,
      categories: result.rows,
    });
  } catch (error) {
    console.error("Get categories error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch categories" });
  }
});

router.get("/items", async (req, res) => {
  try {
    const categoryId = req.query.category_id;
    
    let query = `
      SELECT 
        mi.item_id,
        mi.item_name,
        mi.category_id,
        mc.category_name,
        mi.price,
        mi.image_url,
        mi.description,
        mi.is_available,
        COALESCE(ROUND(AVG(r.rating_value)::numeric, 1), 0) as avg_rating,
        COUNT(r.rating_id) as rating_count
      FROM menu_items mi
      INNER JOIN menu_category mc ON mi.category_id = mc.category_id
      LEFT JOIN ratings r ON mi.item_id = r.item_id
      WHERE mi.is_available = true
    `;
    
    const params = [];
    if (categoryId && categoryId !== "all") {
      query += " AND mi.category_id = $1";
      params.push(categoryId);
    }
    
    query += `
      GROUP BY mi.item_id, mi.item_name, mi.category_id, mc.category_name, 
               mi.price, mi.image_url, mi.description, mi.is_available
      ORDER BY mc.category_name, mi.item_name
    `;
    
    const result = await db.query(query, params);
    
    return res.json({
      success: true,
      items: result.rows,
    });
  } catch (error) {
    console.error("Get menu items error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch menu items" });
  }
});

module.exports = router;

