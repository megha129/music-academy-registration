console.log('--- SERVER STARTING v3.0 (Rich Dark Theme + SMTP Verify) ---');
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
    pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }, // Required for Render Postgres
        connectionTimeoutMillis: 5000 // 5 seconds timeout so it doesn't hang!
    });
    console.log('PostgreSQL pool created.');
} catch (error) {
    console.error('Failed to create PostgreSQL pool:', error);
}

// Nodemailer Transporter
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true, // use SSL
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Verify SMTP connection at startup
transporter.verify((error, success) => {
    if (error) {
        console.error('--- NODEMAILER SMTP ERROR ---');
        console.error(error);
    } else {
        console.log('--- NODEMAILER READY TO SEND EMAILS ---');
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

console.log('Initializing API Routes...');
// Routes
app.get('/api/debug', (req, res) => {
    res.status(200).json({
        db_configured: !!process.env.DATABASE_URL,
        email_user: process.env.EMAIL_USER ? 'Set' : 'Not Set',
        email_pass: process.env.EMAIL_PASS ? 'Set' : 'Not Set',
        port: PORT
    });
});

app.get('/api/register', (req, res) => {
    res.status(200).json({ message: 'Register API is active and ready for POST requests.' });
});

app.post('/api/register', async (req, res) => {
    console.log('--- NEW REGISTRATION REQUEST RECEIVED ---');
    console.log('Payload:', req.body);
    const { name, email, phone, instrument } = req.body;

    if (!name || !email || !phone || !instrument) {
        return res.status(400).json({ message: 'All fields are required.' });
    }

    try {
        console.time('Registration Process');
        
        // 1. Save to Database with a 7-second timeout
        if (pool) {
            console.log('Inserting into database...');
            const dbPromise = pool.query(
                'INSERT INTO registrations (name, email, phone, instrument) VALUES ($1, $2, $3, $4)',
                [name, email, phone, instrument]
            );
            
            // Wait for DB but don't hang for more than 7s
            await Promise.race([
                dbPromise,
                new Promise((_, reject) => setTimeout(() => reject(new Error('Database Timeout')), 7000))
            ]).then(() => console.log('Database insert complete.'))
              .catch(err => console.error('Database Error/Timeout:', err.message));
        }

        // 2. Send Email with a 7-second timeout
        if (process.env.EMAIL_USER && process.env.EMAIL_PASS && process.env.DESTINATION_EMAIL) {
            console.log(`Sending email FROM: ${process.env.EMAIL_USER} TO: ${process.env.DESTINATION_EMAIL}`);
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
            
            // Wait for Email but don't hang for more than 7s
            await Promise.race([
                transporter.sendMail(mailOptions),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Email Timeout')), 7000))
            ]).then(() => console.log('Email sent complete.'))
              .catch(err => console.error('Email Error/Timeout:', err.message));
        }

        console.timeEnd('Registration Process');
        res.status(200).json({ message: 'Registration successful!' });
    } catch (error) {
        console.timeEnd('Registration Process');
        console.error('Final Route Error:', error);
        res.status(500).json({ message: 'Internal server error during registration.' });
    }
});

// Fallback to index.html for any other route
app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server is UP on port ${PORT}`);
    // Run DB init in background so it doesn't block startup
    initDB().catch(err => console.error('Background DB Init Error:', err));
});
