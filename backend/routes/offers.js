const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const adminMiddleware = require('../middleware/adminMiddleware');

const dbPath = path.join(__dirname, '../database', 'db.sqlite');
const db = new sqlite3.Database(dbPath);

// Get all offers (including inactive for admin)
router.get('/', (req, res) => {
    db.all(`SELECT * FROM offers ORDER BY created_at DESC`, (err, rows) => {
        if (err) return res.status(500).json({ message: 'Error' });
        res.json(rows);
    });
});

// Create new offer
router.post('/', adminMiddleware, (req, res) => {
    const { title, description, code, discount_percent, min_order_amount, start_date, end_date, product_id } = req.body;
    
    const query = `INSERT INTO offers (title, description, code, discount_percent, min_order_amount, start_date, end_date, product_id, is_active) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`;
    const params = [title, description, code, discount_percent, min_order_amount, start_date, end_date, product_id];

    db.run(query, params, function (err) {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: 'Error saving offer' });
        }
        
        const offerId = this.lastID;
        
        // Fetch product name if it's a product offer for notification
        let productName = '';
        if (product_id) {
            db.get(`SELECT name FROM products WHERE id = ?`, [product_id], (err, product) => {
                if (product) productName = product.name;
                createNotifications(offerId, title, description, code, discount_percent, min_order_amount, start_date, end_date, product_id, productName);
            });
        } else {
            createNotifications(offerId, title, description, code, discount_percent, min_order_amount, start_date, end_date, product_id, productName);
        }

        res.status(201).json({ id: offerId });
    });
});

function createNotifications(offerId, title, description, code, discount_percent, min_order_amount, start_date, end_date, product_id, productName) {
    db.all(`SELECT id FROM users`, [], (err, users) => {
        if (!err && users) {
            const stmt = db.prepare(`INSERT INTO notifications (title, message, type, data, related_id, user_id, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)`);
            
            const type = product_id ? 'product_offer' : 'coupon_offer';
            const notificationData = JSON.stringify({
                title,
                code,
                discount_percent,
                min_order_amount,
                start_date: start_date || new Date().toISOString().split('T')[0],
                end_date,
                product_id,
                productName
            });

            const displayTitle = product_id ? `خصم جديد على ${productName}` : `كود خصم جديد: ${title}`;
            const displayMessage = product_id 
                ? `احصل على خصم ${discount_percent}% على ${productName} لفترة محدودة!` 
                : `استخدم الكود ${code} للحصول على خصم ${discount_percent}% عند طلبك بقيمة ${min_order_amount} ر.س أو أكثر.`;

            users.forEach(user => {
                stmt.run(displayTitle, displayMessage, type, notificationData, offerId, user.id, end_date);
            });
            stmt.finalize();
        }
    });
}

// Update offer
router.put('/:id', adminMiddleware, (req, res) => {
    const { title, description, code, discount_percent, min_order_amount, start_date, end_date, product_id, is_active } = req.body;
    
    const query = `UPDATE offers SET title=?, description=?, code=?, discount_percent=?, min_order_amount=?, start_date=?, end_date=?, product_id=?, is_active=? WHERE id=?`;
    const params = [title, description, code, discount_percent, min_order_amount, start_date, end_date, product_id, is_active ? 1 : 0, req.params.id];

    db.run(query, params, (err) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: 'Error updating offer' });
        }
        res.json({ message: 'Offer updated' });
    });
});

// Delete offer
router.delete('/:id', adminMiddleware, (req, res) => {
    const offerId = req.params.id;
    db.run(`DELETE FROM offers WHERE id = ?`, [offerId], (err) => {
        if (err) return res.status(500).json({ message: 'Error deleting offer' });
        
        // Robust deletion of notifications: 
        // We delete by related_id regardless of type to ensure no phantom notifications remain.
        db.run(`DELETE FROM notifications WHERE related_id = ?`, [offerId], (err) => {
            if (err) console.error('Error deleting related notifications:', err);
        });
        
        res.json({ message: 'Offer deleted and notifications synced' });
    });
});

module.exports = router;
