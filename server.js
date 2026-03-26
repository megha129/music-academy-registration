require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Database Connection
let pool;
try {
    pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT || 3306,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });
} catch (error) {
    console.error(`MySQL Error:`, error);
}

// Create table if not exists
async function initDB() {
    if (!pool) return;
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS registrations (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL,
                phone VARCHAR(50) NOT NULL,
                instrument VARCHAR(100) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log("Database initialized.");
    } catch (err) {
        console.error(`DB Init Error:`, err);
    }
}

// --- API ROUTES ---

// Registration Route (Database Only)
app.post('/api/register', async (req, res) => {
    const { name, email, phone, instrument } = req.body;

    if (!name || !email || !phone || !instrument) {
        return res.status(400).json({ message: 'All fields are required.' });
    }

    try {
        if (pool) {
            await pool.query(
                'INSERT INTO registrations (name, email, phone, instrument) VALUES (?, ?, ?, ?)',
                [name, email, phone, instrument]
            );
        }
        res.status(200).json({ message: 'Registration saved to database!' });
    } catch (error) {
        console.error(`Final Route Error:`, error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

// Admin Dashboard Route
app.get('/api/admin/registrations', async (req, res) => {
    const { password } = req.query;
    if (password !== 'admin123') return res.status(401).json({ message: 'Unauthorized' });

    try {
        if (!pool) return res.status(500).json({ message: 'DB not connected' });
        const [rows] = await pool.query('SELECT * FROM registrations ORDER BY created_at DESC');
        res.status(200).json(rows);
    } catch (err) {
        console.error(`Admin Route Error:`, err);
        res.status(500).json({ message: 'Error fetching registrations' });
    }
});

// Fallback to index.html (matches everything else)
app.get('/*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


// Export for Vercel
module.exports = app;

// Start Server (Only locally)
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
        initDB();
    });
} else {
    // Initializing DB on cold start for Vercel
    initDB();
}
