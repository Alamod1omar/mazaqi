const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const authMiddleware = require('../middleware/authMiddleware');

const dbPath = path.join(__dirname, '../database', 'db.sqlite');
const db = new sqlite3.Database(dbPath);

// GET user favorites
router.get('/', authMiddleware, (req, res) => {
    const query = `
        SELECT p.* 
        FROM products p
        JOIN favorites f ON p.id = f.product_id
        WHERE f.user_id = ?
    `;
    db.all(query, [req.user.id], (err, rows) => {
        if (err) return res.status(500).json({ message: 'Error fetching favorites' });
        res.json(rows);
    });
});

// Add to favorites
router.post('/', authMiddleware, (req, res) => {
    const { product_id } = req.body;
    if (!product_id) return res.status(400).json({ message: 'Product ID is required' });

    db.run(`INSERT OR IGNORE INTO favorites (user_id, product_id) VALUES (?, ?)`, [req.user.id, product_id], (err) => {
        if (err) return res.status(500).json({ message: 'Error adding to favorites' });
        res.json({ success: true, message: 'Added to favorites' });
    });
});

// Remove from favorites
router.delete('/:product_id', authMiddleware, (req, res) => {
    db.run(`DELETE FROM favorites WHERE user_id = ? AND product_id = ?`, [req.user.id, req.params.product_id], (err) => {
        if (err) return res.status(500).json({ message: 'Error removing from favorites' });
        res.json({ success: true, message: 'Removed from favorites' });
    });
});

module.exports = router;
