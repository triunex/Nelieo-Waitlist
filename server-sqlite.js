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
db.pragma('journal_mode = WAL');
const db = new Database(dbPath);

// Enable WAL mode for better concurrent access
db.pragma('journal_mode = WAL');

function initializeDatabase() {
    try {
        db.exec(`
            CREATE TABLE IF NOT EXISTS waitlist (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                company TEXT,
                use_case TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        db.exec('CREATE INDEX IF NOT EXISTS idx_waitlist_email ON waitlist(email)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_waitlist_created_at ON waitlist(created_at)');

        db.exec(`
            CREATE TABLE IF NOT EXISTS waitlist_analytics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_type TEXT NOT NULL,
                email TEXT,
                metadata TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        db.exec('CREATE INDEX IF NOT EXISTS idx_waitlist_analytics_event ON waitlist_analytics(event_type)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_waitlist_analytics_created ON waitlist_analytics(created_at)');

        const recordCount = db.prepare('SELECT COUNT(*) as count FROM waitlist').get().count;
        console.log(`✅ SQLite schema ready (${recordCount} records)`);
    } catch (error) {
        console.error('❌ Database initialization error:', error);
        process.exit(1);
    }
}

console.log(`✅ Connected to SQLite database: ${dbPath}`);
initializeDatabase();

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
                                <div class="feature-icon">📣</div>
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

// ============================================
// ADMIN API ENDPOINTS
// ============================================

// Admin Overview Stats
app.get('/api/admin/stats', (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const lastWeek = new Date(today);
        lastWeek.setDate(lastWeek.getDate() - 7);

        // Total signups
        const totalSignups = db.prepare('SELECT COUNT(*) as count FROM waitlist').get().count;
        
        // Today's signups
        const todaySignups = db.prepare(
            'SELECT COUNT(*) as count FROM waitlist WHERE created_at >= ?'
        ).get(today.toISOString()).count;

        // Last week's signups
        const lastWeekSignups = db.prepare(
            'SELECT COUNT(*) as count FROM waitlist WHERE created_at >= ? AND created_at < ?'
        ).get(lastWeek.toISOString(), today.toISOString()).count;

        // This week's signups
        const thisWeekStart = new Date(today);
        thisWeekStart.setDate(thisWeekStart.getDate() - 7);
        const thisWeekSignups = db.prepare(
            'SELECT COUNT(*) as count FROM waitlist WHERE created_at >= ?'
        ).get(thisWeekStart.toISOString()).count;

        // Weekly growth percentage
        const weeklyGrowth = lastWeekSignups > 0 
            ? (((thisWeekSignups - lastWeekSignups) / lastWeekSignups) * 100).toFixed(1)
            : 0;

        // Signups per hour (today)
        const hoursElapsed = Math.max(1, Math.floor((Date.now() - today.getTime()) / (1000 * 60 * 60)));
        const signupsPerHour = (todaySignups / hoursElapsed).toFixed(1);

        // Mock conversion rate (replace with real analytics data)
        const totalVisitors = totalSignups * 3; // Rough estimate: 33% conversion
        const conversionRate = ((totalSignups / totalVisitors) * 100).toFixed(1);

        res.json({
            success: true,
            totalSignups,
            todaySignups,
            weeklyGrowth: parseFloat(weeklyGrowth),
            signupsPerHour: parseFloat(signupsPerHour),
            conversionRate: parseFloat(conversionRate),
            totalVisitors
        });
    } catch (error) {
        console.error('Admin stats error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Admin Users List
app.get('/api/admin/users', (req, res) => {
    try {
        const { search = '', page = 1, limit = 50 } = req.query;
        const offset = (page - 1) * limit;

        let query = 'SELECT * FROM waitlist';
        let countQuery = 'SELECT COUNT(*) as total FROM waitlist';
        const params = [];

        if (search) {
            query += ' WHERE name LIKE ? OR email LIKE ?';
            countQuery += ' WHERE name LIKE ? OR email LIKE ?';
            params.push(`%${search}%`, `%${search}%`);
        }

        query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const users = db.prepare(query).all(...params);
        const total = db.prepare(countQuery).get(...(search ? [`%${search}%`, `%${search}%`] : [])).total;

        res.json({
            success: true,
            data: users,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Admin users error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Admin Analytics
app.get('/api/admin/analytics', (req, res) => {
    try {
        // Use case distribution
        const useCases = db.prepare(`
            SELECT use_case, COUNT(*) as count 
            FROM waitlist 
            WHERE use_case IS NOT NULL 
            GROUP BY use_case
        `).all();

        const useCaseData = {};
        useCases.forEach(row => {
            useCaseData[row.use_case] = row.count;
        });

        // Mock funnel data (replace with real analytics)
        const totalSignups = db.prepare('SELECT COUNT(*) as count FROM waitlist').get().count;
        const funnel = [
            totalSignups * 6, // Visitors (estimate)
            totalSignups * 4, // Page views
            totalSignups * 2, // Form starts
            totalSignups       // Submissions
        ];

        // Mock traffic sources
        const sources = {
            'Direct': Math.floor(totalSignups * 0.4),
            'Twitter': Math.floor(totalSignups * 0.3),
            'LinkedIn': Math.floor(totalSignups * 0.2),
            'Other': Math.floor(totalSignups * 0.1)
        };

        res.json({
            success: true,
            useCases: useCaseData,
            funnel,
            sources
        });
    } catch (error) {
        console.error('Admin analytics error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Admin Database Stats
app.get('/api/admin/database', (req, res) => {
    try {
        const fs = require('fs');
        const stats = fs.statSync(dbPath);
        const totalRecords = db.prepare('SELECT COUNT(*) as count FROM waitlist').get().count;

        // Measure query performance
        const startTime = Date.now();
        db.prepare('SELECT * FROM waitlist LIMIT 100').all();
        const queryTime = Date.now() - startTime;

        res.json({
            success: true,
            size: stats.size,
            totalRecords,
            avgQueryTime: queryTime,
            lastBackup: 'Not configured', // Update with real backup system
            health: 'Excellent'
        });
    } catch (error) {
        console.error('Admin database error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Admin Recent Activity
app.get('/api/admin/activity/recent', (req, res) => {
    try {
        const recentUsers = db.prepare(`
            SELECT * FROM waitlist 
            ORDER BY created_at DESC 
            LIMIT 20
        `).all();

        res.json(recentUsers);
    } catch (error) {
        console.error('Admin activity error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Admin Live Feed
app.get('/api/admin/activity/live', (req, res) => {
    try {
        const lastMinute = new Date(Date.now() - 60000).toISOString();
        const liveActivity = db.prepare(`
            SELECT * FROM waitlist 
            WHERE created_at >= ? 
            ORDER BY created_at DESC
        `).all(lastMinute);

        res.json(liveActivity);
    } catch (error) {
        console.error('Admin live feed error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete User
app.delete('/api/admin/users/:id', (req, res) => {
    try {
        const { id } = req.params;
        db.prepare('DELETE FROM waitlist WHERE id = ?').run(id);
        
        res.json({ success: true, message: 'User deleted successfully' });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Export CSV
app.get('/api/admin/export/csv', (req, res) => {
    try {
        const users = db.prepare('SELECT * FROM waitlist ORDER BY created_at DESC').all();
        
        // Generate CSV
        let csv = 'Name,Email,Company,Use Case,Joined\n';
        users.forEach(user => {
            csv += `"${user.name}","${user.email}","${user.company || ''}","${user.use_case || ''}","${user.created_at}"\n`;
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="nelieo-waitlist-${Date.now()}.csv"`);
        res.send(csv);
    } catch (error) {
        console.error('Export CSV error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create Backup
app.post('/api/admin/backup', (req, res) => {
    try {
        const fs = require('fs');
        const backupPath = path.join(__dirname, `backups/lumina_waitlist_${Date.now()}.db`);
        
        // Create backups directory if it doesn't exist
        if (!fs.existsSync(path.join(__dirname, 'backups'))) {
            fs.mkdirSync(path.join(__dirname, 'backups'));
        }

        // Copy database file
        fs.copyFileSync(dbPath, backupPath);

        res.json({ 
            success: true, 
            message: 'Backup created successfully',
            backupPath
        });
    } catch (error) {
        console.error('Backup error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
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
