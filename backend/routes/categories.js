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
            else console.log('Deleted old category image:', absolutePath);
        });
    }
}

// Multer Setup
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, '../uploads/categories');
        if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'cat-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

router.get('/', (req, res) => {
    db.all(`SELECT * FROM categories WHERE is_active = 1 ORDER BY sort_order ASC`, (err, rows) => {
        if (err) return res.status(500).json({ message: 'Error' });
        res.json(rows);
    });
});

router.post('/', adminMiddleware, upload.single('image'), (req, res) => {
    const { name, sort_order } = req.body;
    let imageUrl = req.body.image_url || '';
    if (req.file) imageUrl = `/uploads/categories/${req.file.filename}`;

    if (!name) return res.status(400).json({ message: 'Name is required' });

    db.run(`INSERT INTO categories (name, image_url, sort_order) VALUES (?, ?, ?)`, 
        [name, imageUrl, sort_order || 0], function(err) {
        if (err) return res.status(500).json({ message: 'Error' });
        res.status(201).json({ id: this.lastID, image_url: imageUrl });
    });
});

router.put('/:id', adminMiddleware, upload.single('image'), (req, res) => {
    const { name, sort_order, is_active } = req.body;
    let newImageUrl = req.body.image_url;

    db.get(`SELECT image_url FROM categories WHERE id = ?`, [req.params.id], (err, row) => {
        if (err || !row) return res.status(404).json({ message: 'Not found' });
        const oldImageUrl = row.image_url;

        if (req.file) {
            newImageUrl = `/uploads/categories/${req.file.filename}`;
            if (oldImageUrl && oldImageUrl !== newImageUrl) deleteLocalFile(oldImageUrl);
        }

        db.run(`UPDATE categories SET name=?, image_url=?, sort_order=?, is_active=? WHERE id=?`, 
            [name, newImageUrl, sort_order || 0, is_active === 'true' || is_active == 1 ? 1 : 0, req.params.id], (err) => {
            if (err) return res.status(500).json({ message: 'Error' });
            res.json({ message: 'Category updated', image_url: newImageUrl });
        });
    });
});

router.delete('/:id', adminMiddleware, (req, res) => {
    db.get(`SELECT image_url FROM categories WHERE id = ?`, [req.params.id], (err, row) => {
        if (err || !row) return res.status(404).json({ message: 'Not found' });
        const imageUrl = row.image_url;

        db.run(`DELETE FROM categories WHERE id = ?`, [req.params.id], (err) => {
            if (err) return res.status(500).json({ message: 'Error' });
            deleteLocalFile(imageUrl);
            res.json({ message: 'Category and image deleted' });
        });
    });
});

module.exports = router;
