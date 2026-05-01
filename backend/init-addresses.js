const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database', 'db.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    // 1. Create user_addresses table
    db.run(`CREATE TABLE IF NOT EXISTS user_addresses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        address_text TEXT NOT NULL,
        is_default INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )`, (err) => {
        if (err) console.error('Error creating user_addresses table:', err);
        else console.log('user_addresses table ready');
    });

    // 2. Also ensure address_details column exists in users (for backward compatibility or fallback)
    db.run(`ALTER TABLE users ADD COLUMN address_details TEXT`, (err) => {
        if (err) {
            if (err.message.includes('duplicate column name')) {
                console.log('address_details column already exists in users table');
            } else {
                console.error('Error adding address_details column:', err);
            }
        } else {
            console.log('address_details column added to users table');
        }
    });
});

db.close();
