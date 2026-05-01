const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, '../backend/database/db.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    db.all("SELECT sql FROM sqlite_master WHERE type='table' AND name IN ('offers', 'notifications')", (err, rows) => {
        if (err) {
            console.error(err);
            return;
        }
        rows.forEach(row => console.log(row.sql));
        db.close();
    });
});
