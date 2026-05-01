const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const adminMiddleware = require('../middleware/adminMiddleware');

const dbPath = path.join(__dirname, '../database', 'db.sqlite');
const db = new sqlite3.Database(dbPath);

router.get('/', (req, res) => {
    db.get(`SELECT * FROM settings WHERE id = 1`, (err, row) => {
        if (err) return res.status(500).json({ message: 'Error' });
        res.json(row);
    });
});

router.put('/', adminMiddleware, (req, res) => {
    const { cafeteria_name, phone, whatsapp, address, is_open } = req.body;
    db.run(`UPDATE settings SET cafeteria_name=?, phone=?, whatsapp=?, address=?, is_open=? WHERE id=1`,
        [cafeteria_name, phone, whatsapp, address, is_open], (err) => {
            if (err) return res.status(500).json({ message: 'Error' });
            res.json({ message: 'Settings updated' });
        });
});

module.exports = router;
