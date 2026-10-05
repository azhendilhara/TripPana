const bcrypt = require('bcrypt');
const db = require('./config/db');

const username = 'admin';
const password = 'Admin@123';

async function createAdmin() {

    try {

        const hashedPassword = await bcrypt.hash(password, 10);

        const sql = `
            INSERT INTO admins (username, password)
            VALUES (?, ?)
        `;

        db.query(sql, [username, hashedPassword], (err, result) => {

            if (err) {

                if (err.code === 'ER_DUP_ENTRY') {
                    console.log('Admin account already exists.');
                } else {
                    console.error('Error creating admin:', err);
                }

                process.exit();
                return;
            }

            console.log('Admin created successfully!');
            console.log('Username:', username);

            process.exit();
        });

    } catch (error) {

        console.error(error);
        process.exit();

    }
}

createAdmin();