require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
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
    if (process.env.DATABASE_URL) {
        pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: { rejectUnauthorized: false }, 
            connectionTimeoutMillis: 5000 
        });
    }
} catch (error) {
    console.error(`PostgreSQL Error:`, error);
}

// Create table if not exists
async function initDB() {
    if (!pool) return;
    try {
        const client = await pool.connect();
        await client.query(`
            CREATE TABLE IF NOT EXISTS registrations (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL,
                phone VARCHAR(50) NOT NULL,
                instrument VARCHAR(100) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        client.release();
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
                'INSERT INTO registrations (name, email, phone, instrument) VALUES ($1, $2, $3, $4)',
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
        const result = await pool.query('SELECT * FROM registrations ORDER BY created_at DESC');
        res.status(200).json(result.rows);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching registrations' });
    }
});

// Fallback to index.html (matches everything else)
app.get('/*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    initDB();
});
