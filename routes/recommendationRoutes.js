const express = require('express');
const router = express.Router();

// TODO: Implement in Phase 5
// router.get('/trending', getTrending);
// router.get('/for-you', getPersonalized);
// router.get('/by-genre/:genre', getByGenre);

router.get('/', (req, res) => {
  res.json({ message: 'Recommendation routes - Coming in Phase 5' });
});

module.exports = router;