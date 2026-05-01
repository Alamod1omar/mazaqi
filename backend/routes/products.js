const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const adminMiddleware = require('../middleware/adminMiddleware');

const dbPath = path.join(__dirname, '../database', 'db.sqlite');
const db = new sqlite3.Database(dbPath);

// Helper to delete local files
function deleteLocalFile(filePath) {
    if (!filePath || !filePath.startsWith('/uploads')) return;
    const absolutePath = path.join(__dirname, '..', filePath);
    if (fs.existsSync(absolutePath)) {
        fs.unlink(absolutePath, (err) => {
            if (err) console.error('Error deleting file:', absolutePath, err);
            else console.log('Deleted old image:', absolutePath);
        });
    }
}

// Multer Setup
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, '../uploads/products');
        if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'product-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// GET routes
router.get('/popular', (req, res) => {
    const query = `
        SELECT p.*, c.name as category_name, COUNT(oi.id) as sales_count
        FROM products p
        LEFT JOIN order_items oi ON p.id = oi.product_id
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.is_available = 1
        GROUP BY p.id
        ORDER BY sales_count DESC
        LIMIT 4
    `;
    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ message: 'Error fetching products' });
        res.json(rows);
    });
});

router.get('/', (req, res) => {
    const categoryId = req.query.category_id;
    let query = `SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id`;
    let params = [];
    if (categoryId) {
        query += ` WHERE p.category_id = ?`;
        params.push(categoryId);
    }
    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ message: 'Error' });
        res.json(rows);
    });
});

// Admin: Create product
router.post('/', adminMiddleware, upload.single('image'), (req, res) => {
    const { name, description, price, category_id, is_available, is_popular } = req.body;
    let imageUrl = req.body.image_url || '';
    if (req.file) imageUrl = `/uploads/products/${req.file.filename}`;

    if (!name || !price) return res.status(400).json({ message: 'Name and Price required' });

    db.run(`INSERT INTO products (name, description, price, image_url, category_id, is_available, is_popular) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [name, description || '', price, imageUrl, category_id || null, 
         is_available === 'true' || is_available == 1 ? 1 : 0, 
         is_popular === 'true' || is_popular == 1 ? 1 : 0], function(err) {
            if (err) return res.status(500).json({ message: 'Error' });
            res.status(201).json({ id: this.lastID, image_url: imageUrl });
        });
});

// Admin: Update product (with old file cleanup)
router.put('/:id', adminMiddleware, upload.single('image'), (req, res) => {
    const { name, description, price, category_id, is_available, is_popular } = req.body;
    let newImageUrl = req.body.image_url;

    // Get current image to check if it needs deletion
    db.get(`SELECT image_url FROM products WHERE id = ?`, [req.params.id], (err, row) => {
        if (err || !row) return res.status(404).json({ message: 'Product not found' });
        const oldImageUrl = row.image_url;

        if (req.file) {
            newImageUrl = `/uploads/products/${req.file.filename}`;
            // If we have a new file, delete the old local one
            if (oldImageUrl && oldImageUrl !== newImageUrl) deleteLocalFile(oldImageUrl);
        }

        db.run(`UPDATE products SET name=?, description=?, price=?, image_url=?, category_id=?, is_available=?, is_popular=? WHERE id=?`,
            [name, description || '', price, newImageUrl, category_id || null, 
             is_available === 'true' || is_available == 1 ? 1 : 0, 
             is_popular === 'true' || is_popular == 1 ? 1 : 0, req.params.id], (err) => {
                if (err) return res.status(500).json({ message: 'Error updating product' });
                res.json({ message: 'Product updated', image_url: newImageUrl });
            });
    });
});

// Admin: Delete product (with file cleanup)
router.delete('/:id', adminMiddleware, (req, res) => {
    db.get(`SELECT image_url FROM products WHERE id = ?`, [req.params.id], (err, row) => {
        if (err || !row) return res.status(404).json({ message: 'Product not found' });
        const imageUrl = row.image_url;

        db.run(`DELETE FROM products WHERE id = ?`, [req.params.id], (err) => {
            if (err) return res.status(500).json({ message: 'Error' });
            // Delete file after successful DB deletion
            deleteLocalFile(imageUrl);
            res.json({ message: 'Product and image deleted' });
        });
    });
});

module.exports = router;
