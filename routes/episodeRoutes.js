const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
    getProgress,
    updateEpisode,
    bulkUpdateEpisodes,
    deleteProgress,
} = require('../controllers/episodeController');

// All episode routes are protected
router.use(protect);

router.get('/:seriesType/:seriesId', getProgress);
router.put('/:seriesType/:seriesId/bulk', bulkUpdateEpisodes);
router.put('/:seriesType/:seriesId/season/:seasonNum/episode/:epNum', updateEpisode);
router.delete('/:seriesType/:seriesId', deleteProgress);

module.exports = router;