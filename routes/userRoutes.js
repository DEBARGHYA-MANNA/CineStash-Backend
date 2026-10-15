const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
    searchUsers,
    getUserProfile,
    getReferralInfo,
    useReferralCode,
} = require('../controllers/userController');

router.use(protect);

router.get('/search', searchUsers);
router.get('/profile/:uniqueId', getUserProfile);
router.get('/referral', getReferralInfo);
router.post('/use-referral', useReferralCode);

module.exports = router;