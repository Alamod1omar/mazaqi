const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../backend/database/db.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    // 1. Create delivery_zones table
    db.run(`CREATE TABLE IF NOT EXISTS delivery_zones (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        zone_name TEXT NOT NULL,
        delivery_fee REAL DEFAULT 0,
        free_delivery_minimum REAL DEFAULT 0,
        estimated_delivery_time TEXT,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // 2. Add example zones if table is empty
    db.get("SELECT COUNT(*) as count FROM delivery_zones", (err, row) => {
        if (row.count === 0) {
            const stmt = db.prepare("INSERT INTO delivery_zones (zone_name, delivery_fee, free_delivery_minimum, estimated_delivery_time) VALUES (?, ?, ?, ?)");
            stmt.run("الحي القريب", 5, 50, "15-25 دقيقة");
            stmt.run("الحي المتوسط", 10, 80, "25-35 دقيقة");
            stmt.run("الحي البعيد", 15, 120, "35-50 دقيقة");
            stmt.finalize();
            console.log("Example delivery zones added.");
        }
    });

    // 3. Update orders table with new fields
    // Note: SQLite doesn't support adding multiple columns in one ALTER TABLE, nor does it support IF NOT EXISTS for columns easily.
    // We'll check if columns exist first or just try to add them.
    const columnsToAdd = [
        { name: 'delivery_zone_id', type: 'INTEGER' },
        { name: 'delivery_zone_name', type: 'TEXT' },
        { name: 'free_delivery_applied', type: 'INTEGER DEFAULT 0' },
        { name: 'free_delivery_minimum', type: 'REAL' }
    ];

    columnsToAdd.forEach(col => {
        db.run(`ALTER TABLE orders ADD COLUMN ${col.name} ${col.type}`, (err) => {
            if (err) {
                if (err.message.includes("duplicate column name")) {
                    console.log(`Column ${col.name} already exists in orders table.`);
                } else {
                    console.error(`Error adding column ${col.name}:`, err.message);
                }
            } else {
                console.log(`Column ${col.name} added to orders table.`);
            }
        });
    });

    console.log("Migration completed.");
});

// Close connection after a delay to ensure all runs finished
setTimeout(() => db.close(), 2000);
