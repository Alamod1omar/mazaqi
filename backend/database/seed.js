const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'db.sqlite');
const schemaPath = path.join(__dirname, 'schema.sql');

const db = new sqlite3.Database(dbPath);

async function seed() {
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    db.serialize(async () => {
        // Execute schema
        db.exec(schema, async (err) => {
            if (err) {
                console.error('Error creating schema:', err);
                return;
            }
            console.log('Schema created successfully.');

            // Seed Admin
            const adminPass = await bcrypt.hash('admin123', 10);
            db.run(`INSERT OR IGNORE INTO admins (username, password_hash) VALUES (?, ?)`, ['admin', adminPass]);
            
            // Seed Admin User in Users table
            db.run(`INSERT OR IGNORE INTO users (full_name, phone, password_hash) VALUES (?, ?, ?)`, 
                ['أحمد العميل', '0500000000', adminPass]);

            // Seed Settings
            db.run(`INSERT OR IGNORE INTO settings (id, cafeteria_name, phone, whatsapp, address, working_hours, delivery_fee, minimum_order_amount) 
                    VALUES (1, 'بوفية مذاقي', '0500000000', '966500000000', 'الرياض، المملكة العربية السعودية', '7:00 AM - 11:00 PM', 15, 20)`);

            // Seed Categories
            const categories = [
                ['وجبات', 'https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?w=500', 1],
                ['سندويتشات', 'https://images.unsplash.com/photo-1509722747041-619f382b83bc?w=500', 2],
                ['بطاطس ومقبلات', 'https://images.unsplash.com/photo-1573016608438-349f47184131?w=500', 3],
                ['عصائر', 'https://images.unsplash.com/photo-1536935338218-841273f2a652?w=500', 4],
                ['مشروبات', 'https://images.unsplash.com/photo-1544145945-f904253d0c71?w=500', 5],
                ['عروض', 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=500', 6]
            ];

            const catStmt = db.prepare(`INSERT OR IGNORE INTO categories (name, image_url, sort_order) VALUES (?, ?, ?)`);
            categories.forEach(cat => catStmt.run(cat));
            catStmt.finalize();

            // Seed Products
            // We need category IDs, since they are autoincremented, we'll assume 1-6 for now
            const products = [
                ['برجر دجاج', 'شريحة دجاج مقرمشة مع الخس والجبن', 15, 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500', 1, 1],
                ['برجر لحم', 'شريحة لحم بقري مشوية مع البصل والجبن', 18, 'https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=500', 1, 1],
                ['شاورما دجاج', 'شاورما دجاج مع الثوم والبطاطس', 7, 'https://images.unsplash.com/photo-1561651823-34feb02250e4?w=500', 2, 0],
                ['سندويتش فلافل', 'فلافل طازجة مع الطحينة والسلطة', 5, 'https://images.unsplash.com/photo-1547050605-2f2238059082?w=500', 2, 0],
                ['بطاطس', 'أصابع بطاطس مقلية مقرمشة', 5, 'https://images.unsplash.com/photo-1573016608438-349f47184131?w=500', 3, 0],
                ['عصير مانجو', 'عصير مانجو طازج ومبرد', 10, 'https://images.unsplash.com/photo-1589733955941-5eeaf752f6dd?w=500', 4, 0],
                ['عصير برتقال', 'عصير برتقال طبيعي 100%', 10, 'https://images.unsplash.com/photo-1613478223719-2ab802602423?w=500', 4, 0],
                ['عصير فراولة', 'عصير فراولة طازج ولذيذ', 10, 'https://images.unsplash.com/photo-1587334274328-64186a80aeee?w=500', 4, 0],
                ['مشروب غازي', 'مشروبات غازية متنوعة', 3, 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=500', 5, 0],
                ['عرض وجبة كومبو', 'برجر + بطاطس + مشروب غازي', 25, 'https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?w=500', 6, 1]
            ];

            const prodStmt = db.prepare(`INSERT OR IGNORE INTO products (name, description, price, image_url, category_id, is_popular) VALUES (?, ?, ?, ?, ?, ?)`);
            products.forEach(prod => prodStmt.run(prod));
            prodStmt.finalize();

            console.log('Database seeded successfully.');
            db.close();
        });
    });
}

seed();
