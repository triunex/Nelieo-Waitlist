# 📊 Nelieo Admin Dashboard

YC-grade monitoring and analytics dashboard for the Nelieo waitlist system.

## 🎯 Overview

A beautiful, real-time monitoring dashboard to track your journey to 50,000 waitlist signups by December 31, 2025.

### Key Features

✅ **Real-time Monitoring** - 5-second auto-refresh  
✅ **Live Activity Feed** - See signups as they happen  
✅ **Analytics & Charts** - Conversion funnel, trends, distributions  
✅ **User Management** - Search, view, export, delete users  
✅ **Database Health** - Performance metrics, backup system  
✅ **Goal Tracking** - Visual progress to 50K target  
✅ **CSV Export** - Download full waitlist data  
✅ **Beautiful UI** - Glassmorphism design, smooth animations

---

## 🚀 Quick Start

### 1. Access the Dashboard

Navigate to: `http://localhost:3001/admin.html` (local) or `https://your-domain.com/admin.html` (production)

### 2. Login

**Default Password:** `nelieo2025`

⚠️ **IMPORTANT:** Change the password in `admin-app.js` before deploying to production!

```javascript
// In admin-app.js, line 5
const ADMIN_PASSWORD = 'your_secure_password_here';
```

### 3. Navigate

Use the sidebar to switch between:
- **Overview** - Key metrics and trends
- **Users** - Full user list with search
- **Analytics** - Conversion funnel and distributions
- **Database** - Health monitoring and backups
- **Activity** - Live feed of signups

---

## 📈 Dashboard Sections

### Overview
- **Total Signups** - All-time count with weekly growth %
- **Today's Signups** - Current day with hourly rate
- **Conversion Rate** - Visitors to signups ratio
- **Goal Progress** - Visual progress bar to 50K target
- **Signup Trend Chart** - Last 30 days line graph
- **Hourly Activity** - Today's signups by hour
- **Recent Activity** - Latest 10 signups

### Users
- **Search** - Find users by name or email
- **Table View** - Name, email, company, use case, join date
- **Actions** - View details, delete user
- **Export CSV** - Download full list
- **Pagination** - 50 users per page

### Analytics
- **Conversion Funnel** - Visitors → Page Views → Form Starts → Submissions
- **Use Case Distribution** - Pie chart of user intentions
- **Company Size** - Organization size breakdown
- **Traffic Sources** - Where users are coming from

### Database
- **Size Monitoring** - Current database file size
- **Query Performance** - Average query execution time
- **Total Records** - Count across all tables
- **Health Indicators** - Connection, write access, indexes, integrity
- **Backup System** - One-click backup creation

### Activity
- **Live Feed** - Real-time signup stream
- **Auto-refresh** - Updates every 5 seconds
- **Animation** - Smooth fade-in for new entries

---

## 🔧 Configuration

### Change Admin Password

Edit `admin-app.js`:

```javascript
const ADMIN_PASSWORD = 'your_secure_password';
```

### Adjust Refresh Rate

Default is 5 seconds. To change:

```javascript
const REFRESH_INTERVAL = 5000; // milliseconds
```

### Update Goal Target

Default is 50,000 by Dec 31, 2025:

```javascript
const GOAL_TARGET = 50000;
const GOAL_DEADLINE = new Date('2025-12-31');
```

---

## 🔐 Security Best Practices

### Production Setup

1. **Change Default Password**
   ```javascript
   const ADMIN_PASSWORD = 'complex_password_here';
   ```

2. **Add IP Whitelisting** (in `server-sqlite.js`):
   ```javascript
   const ALLOWED_IPS = ['your.ip.address'];
   
   app.use('/api/admin/*', (req, res, next) => {
       if (!ALLOWED_IPS.includes(req.ip)) {
           return res.status(403).json({ error: 'Forbidden' });
       }
       next();
   });
   ```

3. **Use Environment Variables**:
   ```bash
   # Add to .env
   ADMIN_PASSWORD=your_secure_password
   ```

4. **Add Rate Limiting**:
   ```bash
   npm install express-rate-limit
   ```
   
   ```javascript
   const rateLimit = require('express-rate-limit');
   
   const adminLimiter = rateLimit({
       windowMs: 15 * 60 * 1000, // 15 minutes
       max: 100 // limit each IP to 100 requests per windowMs
   });
   
   app.use('/api/admin/*', adminLimiter);
   ```

5. **Enable HTTPS Only** (Render handles this automatically)

---

## 📊 API Endpoints

All endpoints are prefixed with `/api/admin/`:

### GET /stats
```json
{
  "totalSignups": 156,
  "todaySignups": 12,
  "weeklyGrowth": 15.3,
  "signupsPerHour": 1.5,
  "conversionRate": 33.5,
  "totalVisitors": 465
}
```

### GET /users?search=&page=1&limit=50
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 156,
    "pages": 4
  }
}
```

### GET /analytics
```json
{
  "useCases": {...},
  "funnel": [936, 624, 312, 156],
  "sources": {...}
}
```

### GET /database
```json
{
  "size": 98304,
  "totalRecords": 156,
  "avgQueryTime": 2,
  "lastBackup": "2025-11-04 10:30",
  "health": "Excellent"
}
```

### GET /activity/recent
Returns last 20 signups

### GET /activity/live
Returns signups from last 60 seconds

### DELETE /users/:id
Deletes a specific user

### GET /export/csv
Downloads CSV file of all users

### POST /backup
Creates database backup

---

## 🎨 Customization

### Change Color Scheme

Edit `admin-styles.css`:

```css
:root {
    --gradient-blue: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    --gradient-green: linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%);
    /* Add your custom gradients */
}
```

### Modify Chart Colors

In `admin-app.js`, update chart configurations:

```javascript
backgroundColor: [
    'rgba(102, 126, 234, 0.8)', // Blue
    'rgba(16, 185, 129, 0.8)',   // Green
    // Add your colors
]
```

### Add Custom Metrics

1. Create API endpoint in `server-sqlite.js`:
```javascript
app.get('/api/admin/custom-metric', (req, res) => {
    // Your logic
    res.json({ data: ... });
});
```

2. Add UI in `admin.html`:
```html
<div class="metric-card">
    <!-- Your metric card -->
</div>
```

3. Load data in `admin-app.js`:
```javascript
async function loadCustomMetric() {
    const data = await fetchAPI('/custom-metric');
    // Update UI
}
```

---

## 📱 Mobile Responsive

The dashboard is fully responsive:
- **Desktop** - Full sidebar + main content
- **Tablet** - Collapsible sidebar
- **Mobile** - Single column layout, touch-friendly

---

## 🔄 Auto-Refresh

Dashboard automatically refreshes every 5 seconds when active.

**Sections that auto-refresh:**
- Overview metrics
- Recent activity
- Live feed
- All charts

**Manual refresh:**
Click the refresh button on any card.

---

## 💾 Backup System

### Manual Backup

1. Go to **Database** section
2. Click **"Backup Now"** button
3. Backup saved to `backups/` folder

### Backup Location

```
waitlist/
  backups/
    lumina_waitlist_1699123456789.db
    lumina_waitlist_1699234567890.db
```

### Automated Backups (Optional)

Add to `server-sqlite.js`:

```javascript
const cron = require('node-cron');

// Daily backup at 3 AM
cron.schedule('0 3 * * *', () => {
    console.log('Creating automated backup...');
    // Backup logic here
});
```

---

## 🐛 Troubleshooting

### Dashboard won't load
- Check server is running on port 3001
- Verify `/admin.html` exists in waitlist folder
- Check browser console for errors

### "Incorrect password" error
- Verify password in `admin-app.js` matches what you're entering
- Password is case-sensitive
- Default is `nelieo2025`

### Charts not rendering
- Ensure Chart.js CDN is loaded
- Check browser console for JavaScript errors
- Verify data is being returned from APIs

### API returns empty data
- Check database has records
- Verify SQLite file exists and is readable
- Check server logs for errors

### Auto-refresh not working
- Check browser tab is active (pauses when inactive)
- Verify `REFRESH_INTERVAL` is set correctly
- Check network tab for API calls

---

## 🎯 Metrics Explained

### Conversion Rate
```
(Total Signups / Total Visitors) × 100
```
Target: 30-40% is excellent for a waitlist

### Weekly Growth
```
((This Week Signups - Last Week Signups) / Last Week Signups) × 100
```
Target: 10-20% weekly growth to reach 50K

### Goal Progress
```
(Current Signups / Target Signups) × 100
```
Track progress to 50,000 by December 31

### Signups Per Hour
```
Today's Signups / Hours Elapsed Today
```
Helps predict daily total

---

## 📊 Export Data

### CSV Export

1. Go to **Users** section
2. Click **"Export CSV"** button
3. File downloads automatically

**CSV Format:**
```csv
Name,Email,Company,Use Case,Joined
John Doe,john@example.com,Acme Inc,Automation,2025-11-04T10:30:00Z
```

### API Export

Use the API directly:
```bash
curl http://localhost:3001/api/admin/export/csv > waitlist.csv
```

---

## 🚀 Performance

### Optimizations

- **Database Indexing** - Email and created_at indexed
- **WAL Mode** - Better concurrent access
- **Query Caching** - Results cached for 5 seconds
- **Lazy Loading** - Charts load on demand
- **Debounced Search** - 300ms delay on user input

### Expected Performance

- **Page Load** - <1 second
- **API Response** - <50ms
- **Chart Render** - <200ms
- **Auto-refresh** - <100ms

---

## 📈 Roadmap

### Planned Features

- [ ] Email notifications for milestones
- [ ] A/B testing analytics
- [ ] Geographic heatmap
- [ ] Referral tracking
- [ ] Custom date range filtering
- [ ] Compare time periods
- [ ] Export to Google Sheets
- [ ] Slack integration
- [ ] Mobile app
- [ ] AI-powered insights

---

## 🤝 Contributing

To add features:

1. Create API endpoint in `server-sqlite.js`
2. Add UI in `admin.html`
3. Add logic in `admin-app.js`
4. Update styles in `admin-styles.css`
5. Test thoroughly
6. Commit and push

---

## 📞 Support

If you encounter issues:

1. Check server logs
2. Review browser console
3. Verify database integrity
4. Check API responses
5. Review this documentation

---

## 🎉 Success Metrics

Track these to reach your 50K goal:

✅ **Daily Target** - 274 signups/day (from Nov 4 to Dec 31)  
✅ **Weekly Target** - 1,918 signups/week  
✅ **Monthly Target** - 8,333 signups/month  
✅ **Conversion Rate** - Maintain >30%  
✅ **Weekly Growth** - Keep >10%

**You got this! 🚀**

---

**Built with ❤️ for Nelieo**  
**Target: $100B Company | 50K Waitlist by Dec 31, 2025**
