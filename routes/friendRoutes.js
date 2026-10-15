const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
    sendFriendRequest,
    acceptFriendRequest,
    rejectFriendRequest,
    removeFriend,
    getFriends,
    getPendingRequests,
} = require('../controllers/friendController');

router.use(protect);

router.get('/', getFriends);
router.get('/requests', getPendingRequests);
router.post('/request', sendFriendRequest);
router.put('/accept/:friendshipId', acceptFriendRequest);
router.put('/reject/:friendshipId', rejectFriendRequest);
router.delete('/:friendshipId', removeFriend);

module.exports = router;