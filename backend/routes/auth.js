const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../database', 'db.sqlite');
const db = new sqlite3.Database(dbPath);
const SECRET_KEY = process.env.JWT_SECRET || 'mazaki_secret_key';

const { sendOTP, sendWelcomeEmail } = require('../utils/mailer');

// Customer Registration
router.post('/register', async (req, res) => {
    const { full_name, phone, email, password, delivery_zone } = req.body;

    if (!full_name || !phone || !password) {
        return res.status(400).json({ message: 'جميع الحقول المطلوبة' });
    }

    if (phone.length !== 9) {
        return res.status(400).json({ message: 'رقم الجوال يجب أن يتكون من 9 أرقام' });
    }

    try {
        const password_hash = await bcrypt.hash(password, 10);
        const status = email ? 'pending' : 'active';
        const query = `INSERT INTO users (full_name, phone, email, delivery_zone, password_hash, status) VALUES (?, ?, ?, ?, ?, ?)`;

        db.run(query, [full_name, phone, email || null, delivery_zone || null, password_hash, status], async function (err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    if (err.message.includes('users.phone')) {
                        return res.status(400).json({ message: 'رقم الجوال مسجل مسبقاً' });
                    }
                    if (err.message.includes('users.email') || err.message.includes('idx_users_email')) {
                        return res.status(400).json({ message: 'البريد الإلكتروني مسجل مسبقاً' });
                    }
                    return res.status(400).json({ message: 'البيانات المدخلة مسجلة مسبقاً' });
                }
                return res.status(500).json({ message: 'خطأ في التسجيل' });
            }

            const userId = this.lastID;
            const user = { id: userId, full_name, phone, email, delivery_zone, status };

            if (email) {
                // Generate 6-digit OTP
                const otp = Math.floor(100000 + Math.random() * 900000).toString();
                
                // Save OTP to database
                db.run(`INSERT INTO user_otps (user_id, otp) VALUES (?, ?)`, [userId, otp], async (otpErr) => {
                    if (otpErr) {
                        console.error('Error saving OTP:', otpErr);
                        return res.status(201).json({ user, message: 'تم التسجيل ولكن فشل إرسال رمز التحقق' });
                    }
                    
                    // Send OTP email
                    await sendOTP(email, otp);
                    res.status(201).json({ user, require_otp: true, message: 'تم التسجيل بنجاح، يرجى التحقق من بريدك الإلكتروني' });
                });
            } else {
                const token = jwt.sign(user, SECRET_KEY);
                res.status(201).json({ token, user });
            }
        });
    } catch (error) {
        res.status(500).json({ message: 'خطأ داخلي' });
    }
});

// Verify OTP
router.post('/verify-otp', (req, res) => {
    const { email, otp } = req.body;

    if (!email || !otp) {
        return res.status(400).json({ message: 'البريد الإلكتروني والرمز مطلوبان' });
    }

    db.get(`SELECT u.id, u.full_name, u.phone FROM users u 
            JOIN user_otps o ON u.id = o.user_id 
            WHERE u.email = ? AND o.otp = ? 
            ORDER BY o.created_at DESC LIMIT 1`, [email, otp], async (err, result) => {
        if (err || !result) {
            return res.status(400).json({ message: 'رمز التحقق غير صحيح' });
        }

        const userId = result.id;

        // Update user status to active
        db.run(`UPDATE users SET status = 'active' WHERE id = ?`, [userId], async (updateErr) => {
            if (updateErr) {
                return res.status(500).json({ message: 'خطأ في تفعيل الحساب' });
            }

            // Delete used OTP
            db.run(`DELETE FROM user_otps WHERE user_id = ?`, [userId]);

            // Send Welcome Email
            await sendWelcomeEmail(email, result.full_name);

            const token = jwt.sign({ id: result.id, full_name: result.full_name, phone: result.phone }, SECRET_KEY);
            res.json({ token, user: result, message: 'تم تفعيل حسابك بنجاح' });
        });
    });
});

// Resend OTP
router.post('/resend-otp', (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ message: 'البريد الإلكتروني مطلوب' });
    }

    db.get(`SELECT id, status FROM users WHERE email = ?`, [email], async (err, user) => {
        if (err || !user) {
            return res.status(404).json({ message: 'المستخدم غير موجود' });
        }

        if (user.status === 'active') {
            return res.status(400).json({ message: 'الحساب مفعل بالفعل' });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        
        db.run(`INSERT INTO user_otps (user_id, otp) VALUES (?, ?)`, [user.id, otp], async (otpErr) => {
            if (otpErr) {
                return res.status(500).json({ message: 'خطأ في إنشاء رمز جديد' });
            }
            
            const sent = await sendOTP(email, otp);
            if (sent) {
                res.json({ message: 'تم إعادة إرسال رمز التحقق بنجاح' });
            } else {
                res.status(500).json({ message: 'فشل إرسال البريد الإلكتروني، يرجى المحاولة لاحقاً' });
            }
        });
    });
});

// Customer Login
router.post('/login', (req, res) => {
    const { phone, password } = req.body;

    if (!phone || !password) {
        return res.status(400).json({ message: 'رقم الجوال وكلمة المرور مطلوبة' });
    }

    db.get(`SELECT * FROM users WHERE phone = ?`, [phone], async (err, user) => {
        if (err || !user) {
            return res.status(401).json({ message: 'بيانات الدخول غير صحيحة' });
        }

        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ message: 'بيانات الدخول غير صحيحة' });
        }

        if (user.status === 'pending') {
            return res.status(403).json({ message: 'يرجى تفعيل حسابك من خلال البريد الإلكتروني أولاً', require_verification: true, email: user.email });
        }

        const token = jwt.sign({ id: user.id, full_name: user.full_name, phone: user.phone }, SECRET_KEY);
        res.json({ token, user: { id: user.id, full_name: user.full_name, phone: user.phone } });
    });
});

// Admin Login
router.post('/admin/login', (req, res) => {
    const { username, password } = req.body;

    db.get(`SELECT * FROM admins WHERE username = ?`, [username], async (err, admin) => {
        if (err || !admin) {
            return res.status(401).json({ message: 'بيانات الدخول غير صحيحة' });
        }

        const validPassword = await bcrypt.compare(password, admin.password_hash);
        if (!validPassword) {
            return res.status(401).json({ message: 'بيانات الدخول غير صحيحة' });
        }

        const token = jwt.sign({ id: admin.id, username: admin.username, isAdmin: true }, SECRET_KEY);
        res.json({ token, admin: { id: admin.id, username: admin.username } });
    });
});

// Get Current User
const authMiddleware = require('../middleware/authMiddleware');
router.get('/me', authMiddleware, (req, res) => {
    db.get(`SELECT id, full_name, phone, email, delivery_zone, status FROM users WHERE id = ?`, [req.user.id], (err, user) => {
        if (err || !user) return res.status(404).json({ message: 'User not found' });
        res.json({ user });
    });
});

module.exports = router;
