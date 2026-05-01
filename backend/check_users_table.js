const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, '../backend/database/db.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    db.all("PRAGMA table_info(users)", (err, rows) => {
        if (err) {
            console.error(err);
            return;
        }
        console.log(JSON.stringify(rows, null, 2));
        db.close();
    });
});
