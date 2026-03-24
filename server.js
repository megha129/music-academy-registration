console.log(`[${new Date().toISOString()}] --- SERVER STARTING v3.0 (Rich Dark Theme) ---`);
require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const nodemailer = require('nodemailer');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// LOG ENV CHECK
console.log(`[${new Date().toISOString()}] EMAIL_USER is ${process.env.EMAIL_USER ? 'PRESENT' : 'MISSING'}`);
console.log(`[${new Date().toISOString()}] EMAIL_PASS is ${process.env.EMAIL_PASS ? 'PRESENT' : 'MISSING'}`);
console.log(`[${new Date().toISOString()}] DATABASE_URL is ${process.env.DATABASE_URL ? 'PRESENT' : 'MISSING'}`);

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
        console.log(`[${new Date().toISOString()}] PostgreSQL pool created.`);
    } else {
        console.warn(`[${new Date().toISOString()}] DATABASE_URL is missing. DB operations will be skipped.`);
    }
} catch (error) {
    console.error(`[${new Date().toISOString()}] Failed to create PostgreSQL pool:`, error);
}

// Nodemailer Transporter
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true, 
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Verify SMTP connection
console.log(`[${new Date().toISOString()}] Starting Nodemailer verification...`);
transporter.verify((error, success) => {
    if (error) {
        console.error(`[${new Date().toISOString()}] --- NODEMAILER SMTP ERROR ---`);
        console.error(error);
    } else {
        console.log(`[${new Date().toISOString()}] --- NODEMAILER READY TO SEND EMAILS ---`);
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
        console.log(`[${new Date().toISOString()}] Database table verified/created.`);
    } catch (err) {
        console.error(`[${new Date().toISOString()}] Error verifying database:`, err);
    }
}

console.log(`[${new Date().toISOString()}] Initializing API Routes...`);
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
    console.log(`[${new Date().toISOString()}] --- NEW REGISTRATION REQUEST RECEIVED ---`);
    console.log('Payload:', req.body);
    const { name, email, phone, instrument } = req.body;

    if (!name || !email || !phone || !instrument) {
        return res.status(400).json({ message: 'All fields are required.' });
    }

    try {
        console.time('Registration Process');
        
        // 1. Save to Database with a 7-second timeout
        if (pool) {
            console.log(`[${new Date().toISOString()}] Inserting into database...`);
            const dbPromise = pool.query(
                'INSERT INTO registrations (name, email, phone, instrument) VALUES ($1, $2, $3, $4)',
                [name, email, phone, instrument]
            );
            
            await Promise.race([
                dbPromise,
                new Promise((_, reject) => setTimeout(() => reject(new Error('Database Timeout')), 7000))
            ]).then(() => console.log(`[${new Date().toISOString()}] Database insert complete.`))
              .catch(err => console.error(`[${new Date().toISOString()}] Database Error/Timeout:`, err.message));
        }

        // 2. Send Email with a 7-second timeout
        if (process.env.EMAIL_USER && process.env.EMAIL_PASS && process.env.DESTINATION_EMAIL) {
            console.log(`[${new Date().toISOString()}] Sending email FROM: ${process.env.EMAIL_USER} TO: ${process.env.DESTINATION_EMAIL}`);
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
            
            await Promise.race([
                transporter.sendMail(mailOptions),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Email Timeout')), 7000))
            ]).then(() => console.log(`[${new Date().toISOString()}] Email sent complete.`))
              .catch(err => console.error(`[${new Date().toISOString()}] Email Error/Timeout:`, err.message));
        }

        console.timeEnd('Registration Process');
        res.status(200).json({ message: 'Registration successful!' });
    } catch (error) {
        console.timeEnd('Registration Process');
        console.error(`[${new Date().toISOString()}] Final Route Error:`, error);
        res.status(500).json({ message: 'Internal server error during registration.' });
    }
});

// Fallback to index.html for any other route
app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
app.listen(PORT, () => {
    console.log(`[${new Date().toISOString()}] Server is UP on port ${PORT}`);
    initDB().catch(err => console.error(`[${new Date().toISOString()}] Background DB Init Error:`, err));
});
