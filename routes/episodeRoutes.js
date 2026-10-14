const express = require('express');
const router = express.Router();

// TODO: Implement in Phase 5
// router.get('/:seriesId', getEpisodeProgress);
// router.put('/:seriesId/season/:seasonNum/episode/:epNum', updateEpisode);

router.get('/', (req, res) => {
    res.json({ message: 'Episode routes - Coming in Phase 5' });
});

module.exports = router;