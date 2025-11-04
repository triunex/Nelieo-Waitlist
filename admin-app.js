// Nelieo Admin Dashboard - Real-time Monitoring System

// Configuration
const ADMIN_PASSWORD = 'nelieo2025'; // Change this in production!
const REFRESH_INTERVAL = 5000; // 5 seconds
const GOAL_TARGET = 50000;
const GOAL_DEADLINE = new Date('2025-12-31');

// State
let charts = {};
let refreshTimer = null;
let isAuthenticated = false;
let currentUsersSearch = '';
let currentUsersPage = 1;
const USERS_PAGE_SIZE = 50;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    checkAuthentication();
    initializeEventListeners();
    initializeLenis();
});

// Authentication
function checkAuthentication() {
    const authToken = sessionStorage.getItem('admin_auth');
    if (authToken === 'authenticated') {
        isAuthenticated = true;
        showDashboard();
    } else {
        showLogin();
    }
}

function showLogin() {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('dashboard').style.display = 'none';
}

function showDashboard() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('dashboard').style.display = 'flex';
    initializeDashboard();
}

function initializeEventListeners() {
    // Login form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    // Logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const section = item.dataset.section;
            switchSection(section);
        });
    });

    // User search
    const userSearch = document.getElementById('userSearch');
    if (userSearch) {
        userSearch.addEventListener('input', debounce(handleUserSearch, 300));
    }
}

function handleLogin(e) {
    e.preventDefault();
    const password = document.getElementById('adminPassword').value;
    const errorDiv = document.getElementById('loginError');

    if (password === ADMIN_PASSWORD) {
        sessionStorage.setItem('admin_auth', 'authenticated');
        isAuthenticated = true;
        showDashboard();
    } else {
        errorDiv.textContent = 'Incorrect password. Please try again.';
        errorDiv.classList.add('show');
        setTimeout(() => {
            errorDiv.classList.remove('show');
        }, 3000);
    }
}

function handleLogout() {
    sessionStorage.removeItem('admin_auth');
    isAuthenticated = false;
    if (refreshTimer) clearInterval(refreshTimer);
    showLogin();
}

function switchSection(section) {
    // Update navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelector(`[data-section="${section}"]`).classList.add('active');

    // Update sections
    document.querySelectorAll('.content-section').forEach(sec => {
        sec.classList.remove('active');
    });
    document.getElementById(`${section}Section`).classList.add('active');

    // Update header
    const titles = {
        overview: { title: 'Overview Dashboard', subtitle: 'Real-time monitoring and analytics' },
        users: { title: 'User Management', subtitle: 'View and manage waitlist signups' },
        analytics: { title: 'Analytics', subtitle: 'Detailed conversion and engagement metrics' },
        database: { title: 'Database Monitoring', subtitle: 'Database health and performance' },
        activity: { title: 'Live Activity', subtitle: 'Real-time user activity feed' }
    };

    const info = titles[section];
    document.getElementById('sectionTitle').textContent = info.title;
    document.getElementById('sectionSubtitle').textContent = info.subtitle;
}

// Dashboard Initialization
async function initializeDashboard() {
    await loadAllData();
    initializeCharts();
    startAutoRefresh();
}

async function loadAllData() {
    try {
        await Promise.all([
            loadOverviewMetrics(),
            loadUsers(),
            loadAnalytics(),
            loadDatabaseStats(),
            loadRecentActivity(),
            loadLiveFeed()
        ]);
    } catch (error) {
        console.error('Error loading dashboard data:', error);
    }
}

// API Calls
async function fetchAPI(endpoint) {
    try {
        const response = await fetch(`/api/admin${endpoint}`);
        if (!response.ok) throw new Error(`API error: ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error(`Error fetching ${endpoint}:`, error);
        return null;
    }
}

// Load Overview Metrics
async function loadOverviewMetrics() {
    const stats = await fetchAPI('/stats');
    if (!stats) return;

    // Total signups
    document.getElementById('totalSignups').textContent = formatNumber(stats.totalSignups || 0);
    document.getElementById('signupsChange').textContent = `+${stats.weeklyGrowth || 0}%`;

    // Today's signups
    document.getElementById('todaySignups').textContent = stats.todaySignups || 0;
    document.getElementById('todayRate').textContent = `${stats.signupsPerHour || 0} signups/hour`;

    // Conversion rate
    const conversionRate = stats.conversionRate || 0;
    document.getElementById('conversionRate').textContent = `${conversionRate.toFixed(1)}%`;
    document.getElementById('conversionDetail').textContent = 
        `${stats.totalSignups || 0} of ${stats.totalVisitors || 0} visitors`;

    // Goal progress
    const goalProgress = ((stats.totalSignups || 0) / GOAL_TARGET * 100).toFixed(1);
    document.getElementById('goalProgress').textContent = `${goalProgress}%`;
    document.getElementById('goalProgressBar').style.width = `${goalProgress}%`;
    document.getElementById('goalDetail').textContent = 
        `${formatNumber(stats.totalSignups || 0)} / ${formatNumber(GOAL_TARGET)} by Dec 31`;

    // Update badge
    document.getElementById('usersBadge').textContent = stats.totalSignups || 0;
}

// Load Users
async function loadUsers(search = currentUsersSearch, page = currentUsersPage) {
    const normalizedSearch = (search || '').trim();

    const query = new URLSearchParams({
        search: normalizedSearch,
        page: String(page),
        limit: String(USERS_PAGE_SIZE)
    }).toString();

    const users = await fetchAPI(`/users?${query}`);
    if (!users || users.success === false) return;

    currentUsersSearch = normalizedSearch;
    currentUsersPage = parseInt(page, 10) || 1;

    const tbody = document.getElementById('usersTableBody');
    tbody.innerHTML = '';

    if (!Array.isArray(users.data) || users.data.length === 0) {
        const emptyRow = document.createElement('tr');
        emptyRow.innerHTML = `
            <td colspan="6" class="empty-state">No users found.</td>
        `;
        tbody.appendChild(emptyRow);
        renderPagination({ page: 1, pages: 0 });
        return;
    }

    users.data.forEach(user => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${escapeHtml(user.name)}</td>
            <td>${escapeHtml(user.email)}</td>
            <td>${escapeHtml(user.company || 'N/A')}</td>
            <td>${escapeHtml(user.use_case || 'N/A')}</td>
            <td>${formatDate(user.created_at)}</td>
            <td>
                <div class="user-actions">
                    <button class="action-btn" onclick="viewUser('${user.id}')">View</button>
                    <button class="action-btn" onclick="deleteUser('${user.id}')">Delete</button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Update pagination
    renderPagination(users.pagination);
}

function renderPagination(pagination) {
    const container = document.getElementById('usersPagination');
    if (!container) return;

    container.innerHTML = '';

    if (!pagination || pagination.pages <= 1) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'flex';

    const pageNum = parseInt(pagination.page, 10) || 1;
    const totalPages = parseInt(pagination.pages, 10) || 1;

    const createButton = (label, targetPage, disabled = false) => {
        const button = document.createElement('button');
        button.className = 'pagination-btn';
        button.textContent = label;
        button.disabled = disabled;

        if (!disabled) {
            button.addEventListener('click', () => {
                loadUsers(currentUsersSearch, targetPage);
            });
        }

        return button;
    };

    container.appendChild(createButton('Previous', Math.max(1, pageNum - 1), pageNum <= 1));

    const info = document.createElement('span');
    info.className = 'page-info';
    info.textContent = `Page ${pageNum} of ${totalPages}`;
    container.appendChild(info);

    container.appendChild(createButton('Next', Math.min(totalPages, pageNum + 1), pageNum >= totalPages));
}

// Load Analytics
async function loadAnalytics() {
    const analytics = await fetchAPI('/analytics');
    if (!analytics) return;

    // Funnel data
    if (charts.funnel) {
        charts.funnel.data.labels = ['Visitors', 'Page Views', 'Form Starts', 'Submissions'];
        charts.funnel.data.datasets[0].data = analytics.funnel || [0, 0, 0, 0];
        charts.funnel.update();
    }

    // Use case distribution
    if (charts.useCase) {
        const useCases = analytics.useCases || {};
        charts.useCase.data.labels = Object.keys(useCases);
        charts.useCase.data.datasets[0].data = Object.values(useCases);
        charts.useCase.update();
    }

    // Traffic sources
    renderTrafficSources(analytics.sources || {});
}

function renderTrafficSources(sources) {
    const container = document.getElementById('trafficSources');
    container.innerHTML = '';
    
    Object.entries(sources).forEach(([source, count]) => {
        const div = document.createElement('div');
        div.className = 'source-item';
        div.innerHTML = `
            <span class="source-name">${escapeHtml(source)}</span>
            <span class="source-count">${count}</span>
        `;
        container.appendChild(div);
    });
}

// Load Database Stats
async function loadDatabaseStats() {
    const dbStats = await fetchAPI('/database');
    if (!dbStats) return;

    document.getElementById('dbSize').textContent = formatBytes(dbStats.size || 0);
    document.getElementById('queryTime').textContent = `${dbStats.avgQueryTime || 0} ms`;
    document.getElementById('totalRecords').textContent = formatNumber(dbStats.totalRecords || 0);
    document.getElementById('lastBackup').textContent = dbStats.lastBackup || 'Never';
}

// Load Recent Activity
async function loadRecentActivity() {
    const activity = await fetchAPI('/activity/recent');
    if (!activity) return;

    const container = document.getElementById('recentActivity');
    container.innerHTML = '';

    activity.slice(0, 10).forEach(item => {
        const div = document.createElement('div');
        div.className = 'activity-item';
        div.innerHTML = `
            <div class="activity-avatar">${getInitials(item.name)}</div>
            <div class="activity-details">
                <div class="activity-name">${escapeHtml(item.name)}</div>
                <div class="activity-email">${escapeHtml(item.email)}</div>
            </div>
            <div class="activity-time">${timeAgo(item.created_at)}</div>
        `;
        container.appendChild(div);
    });
}

// Load Live Feed
async function loadLiveFeed() {
    const feed = await fetchAPI('/activity/live');
    if (!feed) return;

    const container = document.getElementById('liveFeed');
    
    feed.forEach(item => {
        const existing = container.querySelector(`[data-id="${item.id}"]`);
        if (existing) return; // Don't duplicate

        const div = document.createElement('div');
        div.className = 'activity-item';
        div.dataset.id = item.id;
        div.style.opacity = '0';
        div.style.transform = 'translateY(-20px)';
        div.innerHTML = `
            <div class="activity-avatar">${getInitials(item.name)}</div>
            <div class="activity-details">
                <div class="activity-name">${escapeHtml(item.name)}</div>
                <div class="activity-email">${escapeHtml(item.email)}</div>
            </div>
            <div class="activity-time">${timeAgo(item.created_at)}</div>
        `;
        
        container.insertBefore(div, container.firstChild);
        
        // Animate in
        setTimeout(() => {
            div.style.transition = 'all 0.4s ease';
            div.style.opacity = '1';
            div.style.transform = 'translateY(0)';
        }, 10);
    });

    // Keep only last 50 items
    while (container.children.length > 50) {
        container.removeChild(container.lastChild);
    }
}

// Initialize Charts
function initializeCharts() {
    const chartConfig = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                grid: {
                    color: 'rgba(255, 255, 255, 0.05)'
                },
                ticks: {
                    color: 'rgba(255, 255, 255, 0.5)'
                }
            },
            x: {
                grid: {
                    color: 'rgba(255, 255, 255, 0.05)'
                },
                ticks: {
                    color: 'rgba(255, 255, 255, 0.5)'
                }
            }
        }
    };

    // Signup Trend Chart
    const signupTrendCtx = document.getElementById('signupTrendChart');
    if (signupTrendCtx) {
        charts.signupTrend = new Chart(signupTrendCtx, {
            type: 'line',
            data: {
                labels: generateLast30Days(),
                datasets: [{
                    label: 'Signups',
                    data: generateMockSignupData(),
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                ...chartConfig,
                scales: {
                    ...chartConfig.scales,
                    y: {
                        ...chartConfig.scales.y,
                        beginAtZero: true
                    }
                }
            }
        });
    }

    // Hourly Activity Chart
    const hourlyCtx = document.getElementById('hourlyActivityChart');
    if (hourlyCtx) {
        charts.hourly = new Chart(hourlyCtx, {
            type: 'bar',
            data: {
                labels: Array.from({length: 24}, (_, i) => `${i}:00`),
                datasets: [{
                    label: 'Signups',
                    data: generateMockHourlyData(),
                    backgroundColor: 'rgba(16, 185, 129, 0.8)',
                    borderRadius: 6
                }]
            },
            options: chartConfig
        });
    }

    // Funnel Chart
    const funnelCtx = document.getElementById('funnelChart');
    if (funnelCtx) {
        charts.funnel = new Chart(funnelCtx, {
            type: 'bar',
            data: {
                labels: ['Visitors', 'Page Views', 'Form Starts', 'Submissions'],
                datasets: [{
                    label: 'Users',
                    data: [1000, 750, 400, 150],
                    backgroundColor: [
                        'rgba(102, 126, 234, 0.8)',
                        'rgba(118, 75, 162, 0.8)',
                        'rgba(237, 100, 166, 0.8)',
                        'rgba(255, 154, 86, 0.8)'
                    ],
                    borderRadius: 8
                }]
            },
            options: {
                ...chartConfig,
                indexAxis: 'y'
            }
        });
    }

    // Use Case Chart
    const useCaseCtx = document.getElementById('useCaseChart');
    if (useCaseCtx) {
        charts.useCase = new Chart(useCaseCtx, {
            type: 'doughnut',
            data: {
                labels: ['Automation', 'Research', 'Development', 'Testing', 'Other'],
                datasets: [{
                    data: [35, 25, 20, 15, 5],
                    backgroundColor: [
                        'rgba(102, 126, 234, 0.8)',
                        'rgba(16, 185, 129, 0.8)',
                        'rgba(168, 237, 234, 0.8)',
                        'rgba(255, 154, 86, 0.8)',
                        'rgba(239, 68, 68, 0.8)'
                    ],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: 'rgba(255, 255, 255, 0.7)',
                            padding: 15,
                            font: {
                                size: 13
                            }
                        }
                    }
                }
            }
        });
    }

    // Company Size Chart
    const companySizeCtx = document.getElementById('companySizeChart');
    if (companySizeCtx) {
        charts.companySize = new Chart(companySizeCtx, {
            type: 'pie',
            data: {
                labels: ['1-10', '11-50', '51-200', '201-1000', '1000+'],
                datasets: [{
                    data: [40, 30, 15, 10, 5],
                    backgroundColor: [
                        'rgba(102, 126, 234, 0.8)',
                        'rgba(16, 185, 129, 0.8)',
                        'rgba(168, 237, 234, 0.8)',
                        'rgba(255, 154, 86, 0.8)',
                        'rgba(239, 68, 68, 0.8)'
                    ],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: 'rgba(255, 255, 255, 0.7)',
                            padding: 15,
                            font: {
                                size: 13
                            }
                        }
                    }
                }
            }
        });
    }
}

// Auto Refresh
function startAutoRefresh() {
    refreshTimer = setInterval(() => {
        loadAllData();
    }, REFRESH_INTERVAL);
}

function refreshData() {
    loadAllData();
}

// User Actions
function viewUser(userId) {
    alert(`View user: ${userId}`);
    // Implement modal or detail view
}

function deleteUser(userId) {
    if (confirm('Are you sure you want to delete this user?')) {
        fetch(`/api/admin/users/${userId}`, { method: 'DELETE' })
            .then(() => loadUsers(currentUsersSearch, currentUsersPage))
            .catch(error => console.error('Error deleting user:', error));
    }
}

async function exportUsers() {
    try {
        const response = await fetch('/api/admin/export/csv');
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `nelieo-waitlist-${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Error exporting users:', error);
    }
}

async function createBackup() {
    try {
        const response = await fetch('/api/admin/backup', { method: 'POST' });
        const result = await response.json();
        alert(result.message || 'Backup created successfully!');
        loadDatabaseStats();
    } catch (error) {
        console.error('Error creating backup:', error);
    }
}

// Search Users
function handleUserSearch(e) {
    const query = e.target.value;
    loadUsers(query, 1);
}

// Utility Functions
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

function formatNumber(num) {
    return new Intl.NumberFormat().format(num);
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
}

function timeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
}

function getInitials(name) {
    return name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .substring(0, 2);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function generateLast30Days() {
    const days = [];
    for (let i = 29; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        days.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    }
    return days;
}

function generateMockSignupData() {
    // Replace with real data from API
    return Array.from({length: 30}, () => Math.floor(Math.random() * 50));
}

function generateMockHourlyData() {
    // Replace with real data from API
    return Array.from({length: 24}, () => Math.floor(Math.random() * 20));
}

// Initialize Lenis Smooth Scroll
function initializeLenis() {
    const lenis = new Lenis({
        duration: 1.2,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        direction: 'vertical',
        smooth: true,
        mouseMultiplier: 1,
        smoothTouch: false,
    });

    function raf(time) {
        lenis.raf(time);
        requestAnimationFrame(raf);
    }

    requestAnimationFrame(raf);
}
