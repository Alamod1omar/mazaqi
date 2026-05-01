const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const adminMiddleware = require('../middleware/adminMiddleware');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, '../database', 'db.sqlite');
const db = new sqlite3.Database(dbPath);

router.get('/stats', adminMiddleware, (req, res) => {
    const stats = {};
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    // Helper to get stats for a specific day
    const getDayStats = (date) => {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT 
                    COUNT(*) as totalOrders,
                    COUNT(CASE WHEN status = 'جديد' THEN 1 END) as newOrders,
                    SUM(CASE WHEN status = 'مكتمل' THEN total ELSE 0 END) as revenue
                FROM orders 
                WHERE date(created_at) = ? AND is_archived = 0
            `;
            db.get(query, [date], (err, row) => {
                if (err) reject(err);
                else resolve(row || { totalOrders: 0, newOrders: 0, revenue: 0 });
            });
        });
    };

    Promise.all([
        getDayStats(today),
        getDayStats(yesterday),
        // Additional global stats
        new Promise((resolve) => {
            db.get(`SELECT COUNT(*) as outOfStock FROM products WHERE is_available = 0`, (err, row) => resolve(row ? row.outOfStock : 0));
        }),
        new Promise((resolve) => {
            db.get(`SELECT COUNT(*) as totalUsers FROM users`, (err, row) => resolve(row ? row.totalUsers : 0));
        }),
        // Overall totals for dashboard fallback
        new Promise((resolve) => {
            db.get(`SELECT SUM(total) as totalRevenue FROM orders WHERE status = 'مكتمل' AND is_archived = 0`, (err, row) => resolve(row ? (row.totalRevenue || 0) : 0));
        })
    ]).then(([todayStats, yesterdayStats, outOfStock, totalUsers, totalRevenue]) => {
        
        // Calculate Trends
        const calculateTrend = (current, previous) => {
            if (previous === 0) return current > 0 ? 100 : 0;
            return Math.round(((current - previous) / previous) * 100);
        };

        stats.newOrders = todayStats.newOrders;
        stats.newOrdersTrend = calculateTrend(todayStats.newOrders, yesterdayStats.newOrders);
        
        stats.todayOrders = todayStats.totalOrders;
        stats.ordersTrend = calculateTrend(todayStats.totalOrders, yesterdayStats.totalOrders);
        
        stats.revenue = todayStats.revenue; // Today's revenue
        stats.totalRevenue = totalRevenue; // Overall revenue
        stats.revenueTrend = calculateTrend(todayStats.revenue, yesterdayStats.revenue);
        
        stats.outOfStock = outOfStock;
        stats.totalUsers = totalUsers;

        res.json(stats);
    }).catch(err => {
        console.error(err);
        res.status(500).json({ message: 'Error fetching stats' });
    });
});

// Admin Users (Customers) Management
router.get('/users', adminMiddleware, (req, res) => {
    const query = `
        SELECT u.id, u.full_name, u.phone, u.email, u.delivery_zone, u.created_at, COUNT(o.id) as total_orders
        FROM users u
        LEFT JOIN orders o ON u.id = o.user_id
        GROUP BY u.id
        ORDER BY u.created_at DESC
    `;
    db.all(query, (err, rows) => {
        if (err) {
            console.error('Database Error:', err);
            return res.status(500).json({ message: 'Error fetching customers' });
        }
        res.json(rows);
    });
});

router.delete('/users/:id', adminMiddleware, (req, res) => {
    db.run(`DELETE FROM users WHERE id = ?`, [req.params.id], (err) => {
        if (err) return res.status(500).json({ message: 'Error deleting customer' });
        res.json({ message: 'Customer deleted' });
    });
});

router.put('/users/:id', adminMiddleware, async (req, res) => {
    const { full_name, phone, email, delivery_zone, password } = req.body;
    const userId = req.params.id;

    try {
        if (password) {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);
            db.run(`UPDATE users SET full_name = ?, phone = ?, email = ?, delivery_zone = ?, password_hash = ? WHERE id = ?`,
                [full_name, phone, email, delivery_zone, hashedPassword, userId], (err) => {
                    if (err) return res.status(500).json({ message: 'Error updating customer' });
                    res.json({ success: true, message: 'Customer updated with new password' });
                });
        } else {
            db.run(`UPDATE users SET full_name = ?, phone = ?, email = ?, delivery_zone = ? WHERE id = ?`,
                [full_name, phone, email, delivery_zone, userId], (err) => {
                    if (err) return res.status(500).json({ message: 'Error updating customer' });
                    res.json({ success: true, message: 'Customer updated successfully' });
                });
        }
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

router.put('/update-password', adminMiddleware, async (req, res) => {
    const { newPassword } = req.body;
    try {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);
        db.run(`UPDATE admins SET password_hash = ? WHERE id = 1`, [hashedPassword], (err) => {
            if (err) return res.status(500).json({ message: 'Error updating password' });
            res.json({ success: true, message: 'Password updated successfully' });
        });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// --- Archive Management ---

router.post('/archive/completed-cancelled', adminMiddleware, (req, res) => {
    const adminId = req.admin.id;
    const query = `
        UPDATE orders 
        SET is_archived = 1, 
            archived_at = CURRENT_TIMESTAMP, 
            archived_by = ? 
        WHERE is_archived = 0 
        AND status IN ('مكتمل', 'ملغي', 'Delivered')
    `;
    
    db.run(query, [adminId], function(err) {
        if (err) {
            console.error('Archive Error:', err);
            return res.status(500).json({ success: false, message: 'خطأ أثناء الأرشفة' });
        }
        
        res.json({
            success: true,
            archived_count: this.changes,
            message: this.changes > 0 
                ? `تم أرشفة ${this.changes} طلب بنجاح.` 
                : 'لا توجد طلبات مكتملة أو ملغية للأرشفة.'
        });
    });
});

router.get('/archive/search', adminMiddleware, (req, res) => {
    const { order_no, name, phone, district, date_from, date_to, status, payment_method } = req.query;
    let query = `SELECT * FROM orders WHERE is_archived = 1`;
    const params = [];
    if (order_no) { query += ` AND id LIKE ?`; params.push(`%${order_no}%`); }
    if (name) { query += ` AND customer_name LIKE ?`; params.push(`%${name}%`); }
    if (phone) { query += ` AND customer_phone LIKE ?`; params.push(`%${phone}%`); }
    if (district) { query += ` AND address LIKE ?`; params.push(`%${district}%`); }
    if (date_from) { query += ` AND created_at >= ?`; params.push(date_from); }
    if (date_to) { query += ` AND created_at <= ?`; params.push(date_to + ' 23:59:59'); }
    if (status) { query += ` AND status = ?`; params.push(status); }
    if (payment_method) { query += ` AND payment_method = ?`; params.push(payment_method); }

    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const offset = (page - 1) * limit;

    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
    db.get(countQuery, params, (err, countRow) => {
        if (err) return res.status(500).json({ message: 'Error counting archive' });
        const total = countRow ? countRow.total : 0;
        query += ` ORDER BY archived_at DESC LIMIT ? OFFSET ?`;
        params.push(limit, offset);
        db.all(query, params, (err, rows) => {
            if (err) return res.status(500).json({ message: 'Error searching archive' });
            res.json({ orders: rows, total: total, page: page, totalPages: Math.ceil(total / limit) });
        });
    });
});

router.get('/archive/analytics', adminMiddleware, (req, res) => {
    const { month, year } = req.query;
    let dateFilter = '';
    const params = [];
    if (month && year) {
        dateFilter = ` AND strftime('%m', created_at) = ? AND strftime('%Y', created_at) = ?`;
        params.push(month, year);
    }
    const analytics = {};
    db.get(`
        SELECT 
            COUNT(*) as total_archived,
            COUNT(CASE WHEN status = 'مكتمل' THEN 1 END) as completed_count,
            COUNT(CASE WHEN status = 'ملغي' THEN 1 END) as cancelled_count,
            SUM(CASE WHEN status = 'مكتمل' THEN total ELSE 0 END) as total_sales,
            AVG(CASE WHEN status = 'مكتمل' THEN total END) as avg_order_value,
            SUM(CASE WHEN status = 'مكتمل' THEN delivery_fee ELSE 0 END) as total_delivery_fees
        FROM orders 
        WHERE is_archived = 1 ${dateFilter}
    `, params, (err, row) => {
        if (err) return res.status(500).json({ message: 'Error' });
        Object.assign(analytics, row || {});
        db.get(`
            SELECT delivery_zone_name as zone, COUNT(*) as count 
            FROM orders 
            WHERE is_archived = 1 ${dateFilter} AND delivery_zone_name IS NOT NULL
            GROUP BY delivery_zone_name ORDER BY count DESC LIMIT 1
        `, params, (err, zoneRow) => {
            analytics.top_zone = zoneRow ? zoneRow.zone : 'غير محدد';
            db.get(`
                SELECT payment_method, COUNT(*) as count FROM orders 
                WHERE is_archived = 1 ${dateFilter}
                GROUP BY payment_method ORDER BY count DESC LIMIT 1
            `, params, (err, payRow) => {
                analytics.top_payment_method = payRow ? (payRow.payment_method === 'cash_on_delivery' ? 'كاش' : payRow.payment_method) : 'N/A';
                const bestProductsQuery = `
                    SELECT oi.product_name, SUM(oi.quantity) as total_quantity, COUNT(DISTINCT oi.order_id) as order_count, SUM(oi.quantity * oi.price) as revenue
                    FROM order_items oi JOIN orders o ON oi.order_id = o.id
                    WHERE o.is_archived = 1 AND o.status = 'مكتمل' ${dateFilter.replace('created_at', 'o.created_at')}
                    GROUP BY oi.product_name ORDER BY total_quantity DESC
                `;
                db.all(bestProductsQuery, params, (err, productRows) => {
                    analytics.best_products = productRows || [];
                    res.json(analytics);
                });
            });
        });
    });
});

router.get('/archive/report-data', adminMiddleware, (req, res) => {
    const { start_date, end_date } = req.query;
    if (!start_date || !end_date) return res.status(400).json({ message: 'Required' });
    const report = { period: { start: start_date, end: end_date }, generated_at: new Date().toLocaleString('ar-SA'), admin_name: req.admin.username };
    const dateFilter = `AND created_at >= ? AND created_at <= ?`;
    const params = [start_date, end_date + ' 23:59:59'];
    const summaryQuery = `
        SELECT COUNT(*) as total_orders, COUNT(CASE WHEN status = 'مكتمل' THEN 1 END) as completed_count, COUNT(CASE WHEN status = 'ملغي' THEN 1 END) as cancelled_count,
        SUM(CASE WHEN status = 'مكتمل' THEN total ELSE 0 END) as total_sales, AVG(CASE WHEN status = 'مكتمل' THEN total END) as avg_order_value, SUM(CASE WHEN status = 'مكتمل' THEN delivery_fee ELSE 0 END) as total_delivery_fees
        FROM orders WHERE 1=1 ${dateFilter}
    `;
    db.get(summaryQuery, params, (err, summary) => {
        if (err) return res.status(500).json({ message: 'Error' });
        const safeSummary = summary || { total_orders: 0, completed_count: 0, cancelled_count: 0, total_sales: 0, avg_order_value: 0, total_delivery_fees: 0 };
        report.summary = safeSummary;
        report.summary.net_sales = (safeSummary.total_sales || 0) - (safeSummary.total_delivery_fees || 0);
        const productsQuery = `
            SELECT oi.product_name, SUM(oi.quantity) as total_quantity, COUNT(DISTINCT oi.order_id) as order_count, SUM(oi.quantity * oi.price) as revenue
            FROM order_items oi JOIN orders o ON oi.order_id = o.id
            WHERE o.status = 'مكتمل' ${dateFilter.replace('created_at', 'o.created_at')}
            GROUP BY oi.product_name ORDER BY total_quantity DESC
        `;
        db.all(productsQuery, params, (err, products) => {
            report.best_products = products || [];
            const areaQuery = `SELECT address as district, COUNT(*) as order_count, SUM(total) as total_sales, SUM(delivery_fee) as total_delivery_fees FROM orders WHERE status = 'مكتمل' ${dateFilter} GROUP BY address ORDER BY total_sales DESC`;
            db.all(areaQuery, params, (err, areas) => {
                report.sales_by_area = areas || [];
                const payQuery = `SELECT payment_method, COUNT(*) as order_count, SUM(total) as total_amount FROM orders WHERE status = 'مكتمل' ${dateFilter} GROUP BY payment_method`;
                db.all(payQuery, params, (err, payments) => {
                    report.payment_methods = payments || [];
                    const ordersQuery = `SELECT id, customer_name, customer_phone, status, total, created_at FROM orders WHERE 1=1 ${dateFilter} ORDER BY created_at DESC`;
                    db.all(ordersQuery, params, (err, ordersList) => {
                        report.orders_list = ordersList || [];
                        res.json(report);
                    });
                });
            });
        });
    });
});

module.exports = router;
