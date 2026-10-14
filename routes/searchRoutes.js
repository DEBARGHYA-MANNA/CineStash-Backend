const express = require('express');
const router = express.Router();

// TODO: Implement in Phase 3
// router.get('/movies', searchMovies);
// router.get('/tv', searchTV);
// router.get('/anime', searchAnime);
// router.get('/details/:type/:id', getDetails);

router.get('/', (req, res) => {
    res.json({ message: 'Search routes - Coming in Phase 3' });
});

module.exports = router;