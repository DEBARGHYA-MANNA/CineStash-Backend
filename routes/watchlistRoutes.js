const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
    getWatchlist,
    addToWatchlist,
    updateWatchlistItem,
    removeFromWatchlist,
    checkWatchlist,
    getWatchlistStats,
} = require('../controllers/watchlistController');

// All watchlist routes are protected
router.use(protect);

router.get('/', getWatchlist);
router.get('/stats', getWatchlistStats);
router.get('/check/:contentType/:contentId', checkWatchlist);
router.post('/', addToWatchlist);
router.put('/:id', updateWatchlistItem);
router.delete('/:id', removeFromWatchlist);

module.exports = router;