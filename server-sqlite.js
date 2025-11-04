require('dotenv').config();
const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');
const bodyParser = require('body-parser');
const validator = require('validator');
const nodemailer = require('nodemailer');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(__dirname));

// SQLite database connection - supports production environment variable
const dbPath = process.env.DB_PATH || path.join(__dirname, 'lumina_waitlist.db');
const db = new Database(dbPath);

// Enable WAL mode for better concurrent access
db.pragma('journal_mode = WAL');

console.log(`✅ Connected to SQLite database: ${dbPath}`);

// Email transporter setup (optional for testing)
let transporter = null;
const emailConfigured = process.env.SMTP_USER && process.env.SMTP_PASS;

if (emailConfigured) {
    transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: process.env.SMTP_PORT || 587,
        secure: false,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });

    // Verify email configuration
    transporter.verify((error, success) => {
        if (error) {
            console.log('⚠️  Email configuration error:', error.message);
            console.log('Email notifications will be disabled');
            transporter = null;
        } else {
            console.log('✅ Email server ready');
        }
    });
} else {
    console.log('⚠️  Email not configured - running without email notifications');
    console.log('To enable emails, set SMTP_USER and SMTP_PASS in .env file');
}

// API Routes

// Join waitlist
app.post('/api/waitlist/join', async (req, res) => {
    try {
        const { name, email, company, useCase } = req.body;

        // Validation
        if (!name || !email || !useCase) {
            return res.status(400).json({
                success: false,
                message: 'Name, email, and use case are required'
            });
        }

        if (!validator.isEmail(email)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email address'
            });
        }

        // Check if email already exists
        const existing = db.prepare('SELECT id FROM waitlist WHERE email = ?').get(email);

        if (existing) {
            return res.status(409).json({
                success: false,
                message: 'This email is already on the waitlist'
            });
        }

        // Insert into database
        const insert = db.prepare('INSERT INTO waitlist (name, email, company, use_case) VALUES (?, ?, ?, ?)');
        const result = insert.run(name, email, company || null, useCase);

        // Get total count
        const countResult = db.prepare('SELECT COUNT(*) as total FROM waitlist').get();
        const position = countResult.total;

        // Send confirmation email
        try {
            await sendConfirmationEmail(email, name, position);
        } catch (emailError) {
            console.error('Email send error:', emailError);
            // Don't fail the request if email fails
        }

        // Send notification to admin
        try {
            await sendAdminNotification(name, email, company, useCase, position);
        } catch (adminEmailError) {
            console.error('Admin notification error:', adminEmailError);
        }

        res.json({
            success: true,
            message: 'Successfully joined the waitlist',
            position: position,
            totalCount: position
        });

    } catch (error) {
        console.error('Waitlist join error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to join waitlist. Please try again.'
        });
    }
});

// Get waitlist count
app.get('/api/waitlist/count', async (req, res) => {
    try {
        const result = db.prepare('SELECT COUNT(*) as total FROM waitlist').get();
        res.json({
            success: true,
            count: result.total
        });
    } catch (error) {
        console.error('Count error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get count'
        });
    }
});

// Email Templates

async function sendConfirmationEmail(email, name, position) {
    if (!transporter) {
        console.log(`📧 [Mock] Would send confirmation email to ${email} (position ${position})`);
        return;
    }
    
    const mailOptions = {
        from: `"Nelieo" <${process.env.SMTP_USER}>`,
        to: email,
        subject: "Welcome to Nelieo — You're In! 🚀",
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    * {
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                    }
                    body {
                        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                        line-height: 1.6;
                        color: #1a1a1a;
                        background-color: #ffffff;
                        padding: 0;
                        margin: 0;
                    }
                    .email-wrapper {
                        max-width: 600px;
                        margin: 0 auto;
                        background-color: #ffffff;
                    }
                    .header {
                        padding: 48px 40px 32px;
                        text-align: center;
                        background-color: #000000;
                        border-bottom: 1px solid #e5e5e5;
                    }
                    .logo {
                        font-size: 28px;
                        font-weight: 700;
                        color: #ffffff;
                        letter-spacing: -0.5px;
                        margin-bottom: 16px;
                    }
                    .header-subtitle {
                        font-size: 15px;
                        color: #a3a3a3;
                        font-weight: 400;
                    }
                    .hero {
                        padding: 48px 40px;
                        text-align: center;
                        background-color: #fafafa;
                    }
                    .hero-title {
                        font-size: 32px;
                        font-weight: 700;
                        color: #000000;
                        margin-bottom: 12px;
                        letter-spacing: -0.8px;
                        line-height: 1.2;
                    }
                    .hero-subtitle {
                        font-size: 16px;
                        color: #737373;
                        margin-bottom: 32px;
                    }
                    .position-badge {
                        display: inline-block;
                        padding: 16px 32px;
                        background-color: #000000;
                        color: #ffffff;
                        font-size: 24px;
                        font-weight: 700;
                        border-radius: 8px;
                        letter-spacing: -0.5px;
                        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
                    }
                    .content {
                        padding: 48px 40px;
                        background-color: #ffffff;
                    }
                    .content-title {
                        font-size: 20px;
                        font-weight: 700;
                        color: #000000;
                        margin-bottom: 24px;
                        letter-spacing: -0.4px;
                    }
                    .feature-list {
                        margin: 0 0 32px 0;
                        padding: 0;
                    }
                    .feature-item {
                        display: flex;
                        align-items: flex-start;
                        margin-bottom: 20px;
                        padding: 20px;
                        background-color: #fafafa;
                        border-radius: 8px;
                        border: 1px solid #e5e5e5;
                    }
                    .feature-icon {
                        flex-shrink: 0;
                        width: 24px;
                        height: 24px;
                        margin-right: 16px;
                        font-size: 20px;
                        line-height: 24px;
                    }
                    .feature-content {
                        flex: 1;
                    }
                    .feature-title {
                        font-size: 15px;
                        font-weight: 600;
                        color: #000000;
                        margin-bottom: 4px;
                    }
                    .feature-text {
                        font-size: 14px;
                        color: #737373;
                        line-height: 1.5;
                    }
                    .cta-section {
                        text-align: center;
                        padding: 32px 40px;
                        background-color: #fafafa;
                        border-top: 1px solid #e5e5e5;
                        border-bottom: 1px solid #e5e5e5;
                    }
                    .cta-text {
                        font-size: 15px;
                        color: #525252;
                        margin-bottom: 20px;
                        line-height: 1.6;
                    }
                    .button {
                        display: inline-block;
                        padding: 14px 28px;
                        background-color: #000000;
                        color: #ffffff;
                        text-decoration: none;
                        border-radius: 6px;
                        font-weight: 600;
                        font-size: 15px;
                        transition: all 0.2s ease;
                        box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
                    }
                    .button:hover {
                        background-color: #1a1a1a;
                        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
                    }
                    .footer {
                        padding: 40px 40px 48px;
                        text-align: center;
                        background-color: #ffffff;
                    }
                    .footer-text {
                        font-size: 13px;
                        color: #a3a3a3;
                        margin-bottom: 8px;
                        line-height: 1.5;
                    }
                    .footer-link {
                        color: #737373;
                        text-decoration: none;
                    }
                    .footer-link:hover {
                        color: #000000;
                    }
                    .divider {
                        height: 1px;
                        background-color: #e5e5e5;
                        margin: 32px 0;
                    }
                    @media only screen and (max-width: 600px) {
                        .header, .hero, .content, .cta-section, .footer {
                            padding-left: 24px;
                            padding-right: 24px;
                        }
                        .hero-title {
                            font-size: 28px;
                        }
                        .position-badge {
                            font-size: 20px;
                            padding: 12px 24px;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="email-wrapper">
                    <!-- Header -->
                    <div class="header">
                        <div class="logo">nelieo</div>
                        <div class="header-subtitle">Autonomous Cloud Employees</div>
                    </div>
                    
                    <!-- Hero Section -->
                    <div class="hero">
                        <h1 class="hero-title">You're on the Waitlist!</h1>
                        <p class="hero-subtitle">Hi ${name}, welcome to the future of work</p>
                        <div class="position-badge">Position #${position}</div>
                    </div>
                    
                    <!-- Main Content -->
                    <div class="content">
                        <h2 class="content-title">What Happens Next?</h2>
                        
                        <div class="feature-list">
                            <div class="feature-item">
                                <div class="feature-icon">🚀</div>
                                <div class="feature-content">
                                    <div class="feature-title">Early Access</div>
                                    <div class="feature-text">You'll be among the first to experience Nelieo when we launch. Get priority access to all features.</div>
                                </div>
                            </div>
                            
                            <div class="feature-item">
                                <div class="feature-icon">�</div>
                                <div class="feature-content">
                                    <div class="feature-title">Product Updates</div>
                                    <div class="feature-text">We'll keep you in the loop with development progress, new features, and launch dates.</div>
                                </div>
                            </div>
                            
                            <div class="feature-item">
                                <div class="feature-icon">💡</div>
                                <div class="feature-content">
                                    <div class="feature-title">Exclusive Insights</div>
                                    <div class="feature-text">Get insider tips and best practices on how to maximize Nelieo for your specific use case.</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- CTA Section -->
                    <div class="cta-section">
                        <p class="cta-text">We're building something incredible. Get ready to transform your workflow with AI-powered autonomous employees.</p>
                        <a href="${process.env.APP_URL || 'http://localhost:3001'}" class="button">Learn More About Nelieo</a>
                    </div>
                    
                    <!-- Footer -->
                    <div class="footer">
                        <p class="footer-text">© 2025 Nelieo. All rights reserved.</p>
                        <p class="footer-text">You're receiving this because you joined our waitlist.</p>
                    </div>
                </div>
            </body>
            </html>
        `
    };

    return transporter.sendMail(mailOptions);
}

async function sendAdminNotification(name, email, company, useCase, position) {
    if (!process.env.ADMIN_EMAIL) return;
    
    if (!transporter) {
        console.log(`📧 [Mock] Would send admin notification for ${name} (${email})`);
        return;
    }

    const mailOptions = {
        from: `"Nelieo Waitlist" <${process.env.SMTP_USER}>`,
        to: process.env.ADMIN_EMAIL,
        subject: `🎉 New Signup: ${name} (#${position})`,
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        line-height: 1.6;
                        color: #1a1a1a;
                        max-width: 600px;
                        margin: 0 auto;
                        padding: 20px;
                        background-color: #fafafa;
                    }
                    .container {
                        background: #ffffff;
                        border-radius: 8px;
                        padding: 32px;
                        border: 1px solid #e5e5e5;
                        box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
                    }
                    .header {
                        padding-bottom: 24px;
                        border-bottom: 2px solid #000000;
                        margin-bottom: 24px;
                    }
                    .title {
                        font-size: 24px;
                        font-weight: 700;
                        color: #000000;
                        margin: 0 0 8px 0;
                        letter-spacing: -0.5px;
                    }
                    .badge {
                        display: inline-block;
                        padding: 6px 12px;
                        background-color: #000000;
                        color: #ffffff;
                        font-size: 13px;
                        font-weight: 600;
                        border-radius: 4px;
                        letter-spacing: 0.5px;
                    }
                    .info-grid {
                        display: table;
                        width: 100%;
                        margin-top: 24px;
                    }
                    .info-row {
                        display: table-row;
                    }
                    .info-label {
                        display: table-cell;
                        padding: 12px 16px 12px 0;
                        font-weight: 600;
                        color: #525252;
                        font-size: 14px;
                        width: 120px;
                    }
                    .info-value {
                        display: table-cell;
                        padding: 12px 0;
                        color: #000000;
                        font-size: 14px;
                    }
                    .timestamp {
                        margin-top: 24px;
                        padding-top: 24px;
                        border-top: 1px solid #e5e5e5;
                        font-size: 13px;
                        color: #737373;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1 class="title">New Waitlist Signup</h1>
                        <span class="badge">POSITION #${position}</span>
                    </div>
                    
                    <div class="info-grid">
                        <div class="info-row">
                            <div class="info-label">Name:</div>
                            <div class="info-value">${name}</div>
                        </div>
                        <div class="info-row">
                            <div class="info-label">Email:</div>
                            <div class="info-value"><a href="mailto:${email}" style="color: #000000; text-decoration: none;">${email}</a></div>
                        </div>
                        <div class="info-row">
                            <div class="info-label">Company:</div>
                            <div class="info-value">${company || 'Not specified'}</div>
                        </div>
                        <div class="info-row">
                            <div class="info-label">Use Case:</div>
                            <div class="info-value" style="text-transform: capitalize;">${useCase.replace('-', ' ')}</div>
                        </div>
                    </div>
                    
                    <div class="timestamp">
                        Joined: ${new Date().toLocaleString('en-US', { 
                            weekday: 'long', 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                        })}
                    </div>
                </div>
            </body>
            </html>
        `
    };

    return transporter.sendMail(mailOptions);
}

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve index.html for root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════╗
║   Nelieo Waitlist Server Running      ║
║   Port: ${PORT}                           ║
║   Environment: ${process.env.NODE_ENV || 'development'}              ║
╚════════════════════════════════════════╝
    `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, closing server...');
    db.close();
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT received, closing server...');
    db.close();
    process.exit(0);
});
