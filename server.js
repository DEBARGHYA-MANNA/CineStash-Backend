// Force IPv4 - Fix for JioFiber/Indian ISP IPv6 issues
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const morgan = require('morgan');

// Load environment variables
dotenv.config();

// Import database connection
const connectDB = require('./config/db');

// Import middleware
const errorHandler = require('./middleware/errorHandler');

// Import routes
const authRoutes = require('./routes/authRoutes');
const searchRoutes = require('./routes/searchRoutes');
const watchlistRoutes = require('./routes/watchlistRoutes');
const episodeRoutes = require('./routes/episodeRoutes');
const recommendationRoutes = require('./routes/recommendationRoutes');
const userRoutes = require('./routes/userRoutes');
const friendRoutes = require('./routes/friendRoutes');
const groupVaultRoutes = require('./routes/groupVaultRoutes');

// Initialize Express app
const app = express();

// ============================================
// MIDDLEWARE
// ============================================

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS - Allow frontend to communicate with backend
app.use(
    cors({
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
        allowedHeaders: ['Content-Type', 'Authorization'],
    })
);

// HTTP request logger (only in development)
if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
}

// ============================================
// ROUTES
// ============================================

// Health check
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: '🎬 CineStash API is running!',
        version: '1.0.0',
        endpoints: {
            auth: '/api/auth',
            search: '/api/search',
            watchlist: '/api/watchlist',
            episodes: '/api/episodes',
            recommendations: '/api/recommendations',
            users: '/api/users',
            friends: '/api/friends',
            groups: '/api/groups',
        },
    });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/watchlist', watchlistRoutes);
app.use('/api/episodes', episodeRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/users', userRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/groups', groupVaultRoutes);

// 404 Handler - Catch undefined routes
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Route ${req.originalUrl} not found`,
    });
});

// Global Error Handler (must be last middleware)
app.use(errorHandler);

// ============================================
// START SERVER
// ============================================

const PORT = process.env.PORT || 5000;

const startServer = async () => {
    try {
        // Connect to MongoDB first
        await connectDB();

        // Then start the server
        app.listen(PORT, () => {
            console.log('');
            console.log('╔══════════════════════════════════════════╗');
            console.log('║       🎬  CINESTASH API SERVER  🎬       ║');
            console.log('╠══════════════════════════════════════════╣');
            console.log(`║  🌐 Server:  http://localhost:${PORT}       ║`);
            console.log(`║  📡 Env:     ${process.env.NODE_ENV.padEnd(26)}║`);
            console.log(`║  🗄️  DB:     MongoDB Connected            ║`);
            console.log('╚══════════════════════════════════════════╝');
            console.log('');
        });
    } catch (error) {
        console.error('💀 Failed to start server:', error.message);
        process.exit(1);
    }
};

startServer();