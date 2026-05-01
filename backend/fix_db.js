const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, 'database', 'db.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    console.log('Checking users table...');
    db.all("PRAGMA table_info(users);", (err, rows) => {
        if (err) {
            console.error(err);
            return;
        }
        const columns = rows.map(r => r.name);
        console.log('Current columns:', columns);

        if (!columns.includes('email')) {
            console.log('Adding email column...');
            db.run("ALTER TABLE users ADD COLUMN email TEXT;", (err) => {
                if (err) console.error(err);
                else console.log('Email column added.');
            });
        }
        if (!columns.includes('delivery_zone')) {
            console.log('Adding delivery_zone column...');
            db.run("ALTER TABLE users ADD COLUMN delivery_zone TEXT;", (err) => {
                if (err) console.error(err);
                else console.log('Delivery_zone column added.');
            });
        }
        
        console.log('Database check complete.');
    });
});
