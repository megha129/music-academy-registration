require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const nodemailer = require('nodemailer');
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
    // Render provides a DATABASE_URL for Postgres connections
    pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false } // Required for Render Postgres
    });
    console.log('PostgreSQL pool created.');
} catch (error) {
    console.error('Failed to create PostgreSQL pool:', error);
}

// Nodemailer Transporter
const transporter = nodemailer.createTransport({
    service: 'gmail', // or another service depending on config
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Create tables if not exists
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
        console.log('Database table verified/created.');
    } catch (err) {
        console.error('Error verifying database:', err);
    }
}

// Routes
app.post('/api/register', async (req, res) => {
    const { name, email, phone, instrument } = req.body;

    if (!name || !email || !phone || !instrument) {
        return res.status(400).json({ message: 'All fields are required.' });
    }

    try {
        // 1. Save to Database
        if (pool) {
            await pool.query(
                'INSERT INTO registrations (name, email, phone, instrument) VALUES ($1, $2, $3, $4)',
                [name, email, phone, instrument]
            );
        } else {
            console.warn('Database not connected. Skipping DB insert.');
        }

        // 2. Send Email
        if (process.env.EMAIL_USER && process.env.EMAIL_PASS && process.env.DESTINATION_EMAIL) {
            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: process.env.DESTINATION_EMAIL,
                subject: `New Music Academy Registration: ${name}`,
                html: `
                    <h2>New Registration Received!</h2>
                    <p><strong>Name:</strong> ${name}</p>
                    <p><strong>Email:</strong> ${email}</p>
                    <p><strong>Phone:</strong> ${phone}</p>
                    <p><strong>Instrument:</strong> ${instrument}</p>
                `
            };
            
            await transporter.sendMail(mailOptions);
        } else {
            console.warn('Email credentials not fully configured. Skipping email.');
        }

        res.status(200).json({ message: 'Registration successful!' });
    } catch (error) {
        console.error('Registration Error:', error);
        res.status(500).json({ message: 'Internal server error during registration.' });
    }
});

// Fallback to index.html for any other route
app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    await initDB();
});
