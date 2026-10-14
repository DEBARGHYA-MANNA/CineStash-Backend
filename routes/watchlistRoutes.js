const express = require('express');
const router = express.Router();

// TODO: Implement in Phase 5
// router.get('/', getWatchlist);
// router.post('/', addToWatchlist);
// router.put('/:id', updateWatchlistItem);
// router.delete('/:id', removeFromWatchlist);

router.get('/', (req, res) => {
    res.json({ message: 'Watchlist routes - Coming in Phase 5' });
});

module.exports = router;