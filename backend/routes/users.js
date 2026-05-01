const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const adminMiddleware = require('../middleware/adminMiddleware');
const authMiddleware = require('../middleware/authMiddleware');

const dbPath = path.join(__dirname, '../database', 'db.sqlite');
const db = new sqlite3.Database(dbPath);

// Users Management (Admin)
router.get('/', adminMiddleware, (req, res) => {
    db.all(`SELECT u.id, u.full_name, u.phone, u.email, u.delivery_zone, u.created_at, u.status, 
            (SELECT COUNT(*) FROM orders WHERE user_id = u.id) as order_count,
            (SELECT MAX(created_at) FROM orders WHERE user_id = u.id) as last_order_date
            FROM users u`, (err, rows) => {
        if (err) return res.status(500).json({ message: 'Error' });
        res.json(rows);
    });
});

// Update Profile
router.put('/profile', authMiddleware, (req, res) => {
    const { full_name, email, delivery_zone, address_details } = req.body;
    db.run(`UPDATE users SET full_name = ?, email = ?, delivery_zone = ?, address_details = ? WHERE id = ?`,
        [full_name, email, delivery_zone, address_details, req.user.id], (err) => {
            if (err) return res.status(500).json({ message: 'Error updating profile' });
            res.json({ message: 'Profile updated' });
        });
});

// --- Multi-Address System ---

// Get all addresses for the logged-in user
router.get('/addresses', authMiddleware, (req, res) => {
    db.all(`SELECT * FROM user_addresses WHERE user_id = ? ORDER BY created_at DESC`, [req.user.id], (err, rows) => {
        if (err) return res.status(500).json({ message: 'Error fetching addresses' });
        res.json(rows);
    });
});

// Add a new address
router.post('/addresses', authMiddleware, (req, res) => {
    const { address_text } = req.body;
    if (!address_text) return res.status(400).json({ message: 'Address text is required' });

    db.run(`INSERT INTO user_addresses (user_id, address_text) VALUES (?, ?)`, [req.user.id, address_text], function(err) {
        if (err) return res.status(500).json({ message: 'Error adding address' });
        res.status(201).json({ id: this.lastID, message: 'Address added' });
    });
});

// Update an address
router.patch('/addresses/:id', authMiddleware, (req, res) => {
    const { address_text } = req.body;
    if (!address_text) return res.status(400).json({ message: 'Address text is required' });

    db.run(`UPDATE user_addresses SET address_text = ? WHERE id = ? AND user_id = ?`, 
        [address_text, req.params.id, req.user.id], function(err) {
        if (err) return res.status(500).json({ message: 'Error updating address' });
        if (this.changes === 0) return res.status(404).json({ message: 'العنوان غير موجود أو لا تملك صلاحية تعديله' });
        res.json({ message: 'Address updated' });
    });
});

// Delete an address
router.delete('/addresses/:id', authMiddleware, (req, res) => {
    db.run(`DELETE FROM user_addresses WHERE id = ? AND user_id = ?`, [req.params.id, req.user.id], function(err) {
        if (err) return res.status(500).json({ message: 'Error deleting address' });
        if (this.changes === 0) return res.status(404).json({ message: 'العنوان غير موجود أو لا تملك صلاحية تعديله' });
        res.json({ message: 'Address deleted' });
    });
});

const bcrypt = require('bcryptjs');

// Change Password
router.patch('/profile/change-password', authMiddleware, async (req, res) => {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
        return res.status(400).json({ message: 'يرجى ملء جميع الحقول' });
    }
    if (newPassword !== confirmPassword) {
        return res.status(400).json({ message: 'كلمة المرور الجديدة وتأكيدها غير متطابقين' });
    }
    if (newPassword.length < 8) {
        return res.status(400).json({ message: 'كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل' });
    }

    try {
        // Get user from DB to check current password
        db.get(`SELECT password_hash FROM users WHERE id = ?`, [req.user.id], async (err, user) => {
            if (err || !user) {
                console.error('DB Error or User not found:', err);
                return res.status(500).json({ message: 'حدث خطأ في النظام' });
            }

            const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
            if (!isMatch) {
                return res.status(400).json({ message: 'كلمة المرور الحالية غير صحيحة' });
            }

            // Hash new password
            const hashedPassword = await bcrypt.hash(newPassword, 10);

            // Update DB
            db.run(`UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, 
                [hashedPassword, req.user.id], function(err) {
                if (err) return res.status(500).json({ message: 'فشل تحديث كلمة المرور' });
                res.json({ message: 'تم تغيير كلمة المرور بنجاح' });
            });
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'خطأ داخلي في السيرفر' });
    }
});

module.exports = router;
