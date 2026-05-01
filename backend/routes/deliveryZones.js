const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const adminMiddleware = require('../middleware/adminMiddleware');

const dbPath = path.join(__dirname, '../database', 'db.sqlite');
const db = new sqlite3.Database(dbPath);

// Public: Get active delivery zones for checkout
router.get('/', (req, res) => {
    db.all(`SELECT id, zone_name, delivery_fee, free_delivery_minimum, estimated_delivery_time 
            FROM delivery_zones WHERE is_active = 1`, (err, rows) => {
        if (err) return res.status(500).json({ message: 'Error fetching zones' });
        res.json(rows);
    });
});

// Admin: Get all delivery zones
router.get('/admin', adminMiddleware, (req, res) => {
    db.all(`SELECT * FROM delivery_zones ORDER BY created_at DESC`, (err, rows) => {
        if (err) return res.status(500).json({ message: 'Error' });
        res.json(rows);
    });
});

// Admin: Create zone
router.post('/admin', adminMiddleware, (req, res) => {
    const { zone_name, delivery_fee, free_delivery_minimum, estimated_delivery_time } = req.body;
    db.run(`INSERT INTO delivery_zones (zone_name, delivery_fee, free_delivery_minimum, estimated_delivery_time) VALUES (?, ?, ?, ?)`,
        [zone_name, delivery_fee, free_delivery_minimum, estimated_delivery_time],
        function(err) {
            if (err) return res.status(500).json({ message: 'Error' });
            res.status(201).json({ id: this.lastID });
        }
    );
});

// Admin: Update zone
router.put('/admin/:id', adminMiddleware, (req, res) => {
    const { zone_name, delivery_fee, free_delivery_minimum, estimated_delivery_time, is_active } = req.body;
    db.run(`UPDATE delivery_zones SET zone_name = ?, delivery_fee = ?, free_delivery_minimum = ?, estimated_delivery_time = ?, is_active = ? WHERE id = ?`,
        [zone_name, delivery_fee, free_delivery_minimum, estimated_delivery_time, is_active, req.params.id],
        (err) => {
            if (err) return res.status(500).json({ message: 'Error' });
            res.json({ message: 'Zone updated' });
        }
    );
});

// Admin: Delete zone
router.delete('/admin/:id', adminMiddleware, (req, res) => {
    db.run(`DELETE FROM delivery_zones WHERE id = ?`, [req.params.id], (err) => {
        if (err) return res.status(500).json({ message: 'Error' });
        res.json({ message: 'Zone deleted' });
    });
});

// Admin: Patch status
router.patch('/admin/:id/status', adminMiddleware, (req, res) => {
    const { is_active } = req.body;
    db.run(`UPDATE delivery_zones SET is_active = ? WHERE id = ?`, [is_active, req.params.id], (err) => {
        if (err) return res.status(500).json({ message: 'Error' });
        res.json({ message: 'Status updated' });
    });
});

module.exports = router;
