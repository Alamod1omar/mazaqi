const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const authMiddleware = require('../middleware/authMiddleware');

const dbPath = path.join(__dirname, '../database', 'db.sqlite');
const db = new sqlite3.Database(dbPath);

// Get user notifications
router.get('/', authMiddleware, (req, res) => {
    db.all(`SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 20`, [req.user.id], (err, rows) => {
        if (err) return res.status(500).json({ message: 'Error' });
        res.json(rows);
    });
});

// Mark all as read
router.patch('/read-all', authMiddleware, (req, res) => {
    db.run(`UPDATE notifications SET is_read = 1 WHERE user_id = ?`, [req.user.id], (err) => {
        if (err) return res.status(500).json({ message: 'Error' });
        res.json({ message: 'All notifications marked as read' });
    });
});

// Mark notification as read
router.patch('/:id/read', authMiddleware, (req, res) => {
    db.run(`UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?`, [req.params.id, req.user.id], (err) => {
        if (err) return res.status(500).json({ message: 'Error' });
        res.json({ message: 'Notification marked as read' });
    });
});

module.exports = router;
