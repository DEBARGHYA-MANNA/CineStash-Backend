const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getTrending,
  getPersonalized,
  getByGenre,
  getPopularAll,
} = require('../controllers/recommendationController');

// Public routes
router.get('/trending', getTrending);
router.get('/by-genre', getByGenre);
router.get('/popular-all', getPopularAll);

// Protected routes (needs user data)
router.get('/for-you', protect, getPersonalized);

module.exports = router;