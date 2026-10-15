const express = require('express');
const router = express.Router();
const {
    searchMovies,
    searchTV,
    getDetails,
    getTrending,
    getPopular,
    getTopRated,
    getGenres,
    discoverByGenre,
} = require('../controllers/searchController');

// Search
router.get('/movies', searchMovies);
router.get('/tv', searchTV);

// Details
router.get('/details/:type/:id', getDetails);

// Browse
router.get('/trending', getTrending);
router.get('/popular', getPopular);
router.get('/top-rated', getTopRated);

// Genres & Discover
router.get('/genres', getGenres);
router.get('/discover', discoverByGenre);

module.exports = router;