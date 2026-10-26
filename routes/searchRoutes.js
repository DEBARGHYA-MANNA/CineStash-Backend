const express = require('express');
const router = express.Router();
const {
    searchMovies,
    searchTV,
    searchAnime,
    getDetails,
    getTrending,
    getPopular,
    getTopRated,
    getGenres,
    discoverByGenre,
    getSeasonalAnime,
    getUpcomingAnime,
    getAnimeRecommendations,
} = require('../controllers/searchController');

// ============================================
// SEARCH
// ============================================
router.get('/movies', searchMovies);
router.get('/tv', searchTV);
router.get('/anime', searchAnime);

// ============================================
// DETAILS (movie, tv, anime)
// ============================================
router.get('/details/:type/:id', getDetails);

// ============================================
// BROWSE
// ============================================
router.get('/trending', getTrending);
router.get('/popular', getPopular);
router.get('/top-rated', getTopRated);

// ============================================
// GENRES & DISCOVER
// ============================================
router.get('/genres', getGenres);
router.get('/discover', discoverByGenre);

// ============================================
// ANIME-SPECIFIC
// ============================================
router.get('/anime/seasonal', getSeasonalAnime);
router.get('/anime/upcoming', getUpcomingAnime);
router.get('/anime/recommendations/:id', getAnimeRecommendations);

module.exports = router;