const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, 'database', 'db.sqlite');
const db = new sqlite3.Database(dbPath);

db.run("ALTER TABLE users ADD COLUMN updated_at DATETIME", (err) => {
    if (err) {
        if (err.message.includes('duplicate column name')) {
            console.log("Column updated_at already exists");
            process.exit(0);
        }
        console.error(err);
        process.exit(1);
    }
    console.log("Column updated_at added successfully to users table");
    db.close();
});
