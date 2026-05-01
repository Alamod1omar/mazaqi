const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');
const multer = require('multer');

// Configure multer for transfer proof uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../uploads/proofs'));
    },
    filename: (req, file, cb) => {
        cb(null, `proof-${Date.now()}-${file.originalname}`);
    }
});
const upload = multer({ storage });

const dbPath = path.join(__dirname, '../database', 'db.sqlite');
const db = new sqlite3.Database(dbPath);

const { sendOrderConfirmation } = require('../utils/mailer');

// Create Order
router.post('/', (req, res) => {
    const {
        user_id, customer_name, customer_email, customer_phone, order_type, address, notes, items,
        payment_method, transfer_reference, transfer_sender,
        subtotal, delivery_fee, total, discount_amount, coupon_code,
        delivery_zone_id, delivery_zone_name, estimated_delivery_time, free_delivery_applied, free_delivery_minimum
    } = req.body;

    if (!items || items.length === 0) {
        return res.status(400).json({ message: 'Order must have items' });
    }

    // Check if cafeteria is open
    db.get(`SELECT is_open FROM settings WHERE id = 1`, (err, settings) => {
        if (err || (settings && settings.is_open === 0)) {
            return res.status(403).json({
                success: false,
                message: 'نعتذر، البوفية مغلقة حالياً ولا تستقبل طلبات جديدة.'
            });
        }

        db.run(`INSERT INTO orders (
                    user_id, customer_name, customer_email, customer_phone, order_type, address, notes,
                    payment_method, transfer_reference, transfer_sender,
                    subtotal, delivery_fee, total, discount_amount, coupon_code,
                    delivery_zone_id, delivery_zone_name, estimated_delivery_time, free_delivery_applied, free_delivery_minimum
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                user_id || null, customer_name, customer_email || null, customer_phone, order_type, address, notes || null,
                payment_method || 'cod', transfer_reference || null, transfer_sender || null,
                subtotal, delivery_fee || 0, total,
                discount_amount || 0, coupon_code || null,
                delivery_zone_id || null, delivery_zone_name || null, estimated_delivery_time || null, free_delivery_applied ? 1 : 0, free_delivery_minimum || 0
            ],
            async function (err) {
                if (err) {
                    console.error('Order Insert Error:', err);
                    return res.status(500).json({ message: 'Error creating order' });
                }

                const orderId = this.lastID;
                const itemStmt = db.prepare(`INSERT INTO order_items (order_id, product_id, product_name, quantity, price, notes) VALUES (?, ?, ?, ?, ?, ?)`);

                items.forEach(item => {
                    itemStmt.run([orderId, item.product_id, item.product_name || 'Unknown Product', item.quantity, item.price, item.notes || '']);
                });

                itemStmt.finalize();

                // Send Email Confirmation if email exists
                if (customer_email) {
                    await sendOrderConfirmation(customer_email, {
                        orderId,
                        items,
                        subtotal,
                        delivery_fee,
                        total,
                        customer_name,
                        created_at: new Date()
                    });
                }

                res.status(201).json({
                    success: true,
                    orderId: orderId,
                    message: 'تم استلام طلبك بنجاح'
                });
            }
        );
    });
});

// GET user orders
router.get('/my-orders', authMiddleware, (req, res) => {
    db.all(`SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC`, [req.user.id], (err, rows) => {
        if (err) return res.status(500).json({ message: 'Error' });
        res.json(rows);
    });
});

// Upload transfer proof
router.post('/:id/proof', upload.single('proof'), (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    const proofUrl = `/uploads/proofs/${req.file.filename}`;
    db.run(`UPDATE orders SET transfer_proof = ? WHERE id = ?`, [proofUrl, req.params.id], (err) => {
        if (err) return res.status(500).json({ message: 'Error saving proof' });
        res.json({ success: true, proofUrl });
    });
});

// GET order details
router.get('/:id', (req, res) => {
    // Join with delivery_zones by ID or Name to ensure we get the time even for old/migrated orders
    db.get(`SELECT o.*, dz.estimated_delivery_time as zone_est_time 
            FROM orders o 
            LEFT JOIN delivery_zones dz ON (o.delivery_zone_id = dz.id OR o.delivery_zone_name = dz.zone_name)
            WHERE o.id = ?`, [req.params.id], (err, order) => {
        if (err || !order) return res.status(404).json({ message: 'Order not found' });

        // Use stored time if available, otherwise use zone time from join
        const finalEstTime = order.estimated_delivery_time || order.zone_est_time;

        db.all(`SELECT * FROM order_items WHERE order_id = ?`, [req.params.id], (err, items) => {
            res.json({ ...order, estimated_delivery_time: finalEstTime, items });
        });
    });
});

// Admin: GET all orders
router.get('/', adminMiddleware, (req, res) => {
    db.all(`SELECT * FROM orders WHERE is_archived = 0 ORDER BY created_at DESC`, (err, rows) => {
        if (err) return res.status(500).json({ message: 'Error' });
        res.json(rows);
    });
});

// Admin: Update order status
router.put('/:id/status', adminMiddleware, (req, res) => {
    const { status } = req.body;
    db.run(`UPDATE orders SET status = ? WHERE id = ?`, [status, req.params.id], (err) => {
        if (err) return res.status(500).json({ message: 'Error' });
        res.json({ message: 'Status updated' });
    });
});

// Admin: DELETE order
router.delete('/:id', adminMiddleware, (req, res) => {
    db.run(`DELETE FROM orders WHERE id = ?`, [req.params.id], (err) => {
        if (err) return res.status(500).json({ message: 'Error' });
        db.run(`DELETE FROM order_items WHERE order_id = ?`, [req.params.id], (err) => {
            res.json({ message: 'Order deleted' });
        });
    });
});

// Admin: Update order items
router.put('/:id/update-items', adminMiddleware, (req, res) => {
    const { items, subtotal, total } = req.body;
    const orderId = req.params.id;

    db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        // Update main order totals
        db.run(`UPDATE orders SET subtotal = ?, total = ? WHERE id = ?`, [subtotal, total, orderId]);

        // Clear existing items
        db.run(`DELETE FROM order_items WHERE order_id = ?`, [orderId], (err) => {
            if (err) {
                db.run('ROLLBACK');
                return res.status(500).json({ message: 'Error updating items' });
            }

            // Insert new items
            const itemStmt = db.prepare(`INSERT INTO order_items (order_id, product_id, product_name, quantity, price, notes) VALUES (?, ?, ?, ?, ?, ?)`);
            items.forEach(item => {
                itemStmt.run([orderId, item.product_id, item.product_name, item.quantity, item.price, item.notes || '']);
            });
            itemStmt.finalize();

            db.run('COMMIT', (err) => {
                if (err) return res.status(500).json({ message: 'Error' });
                res.json({ success: true, message: 'Order items updated' });
            });
        });
    });
});

module.exports = router;
