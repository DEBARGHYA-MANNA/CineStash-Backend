const Friendship = require('../models/Friendship');
const User = require('../models/User');
const ApiResponse = require('../utils/apiResponse');

// ============================================
// @desc    Send friend request
// @route   POST /api/friends/request
// @access  Private
// @body    { userId } (the user to send request to)
// ============================================
const sendFriendRequest = async (req, res, next) => {
    try {
        const { userId } = req.body;

        if (!userId) {
            return ApiResponse.error(res, 400, 'userId is required');
        }

        if (userId === req.user.id) {
            return ApiResponse.error(res, 400, 'You cannot send a friend request to yourself');
        }

        // Check if target user exists
        const targetUser = await User.findById(userId);
        if (!targetUser) {
            return ApiResponse.error(res, 404, 'User not found');
        }

        // Check if friendship already exists (in either direction)
        const existing = await Friendship.findOne({
            $or: [
                { requester: req.user.id, recipient: userId },
                { requester: userId, recipient: req.user.id },
            ],
        });

        if (existing) {
            if (existing.status === 'accepted') {
                return ApiResponse.error(res, 409, 'You are already friends');
            }
            if (existing.status === 'pending') {
                return ApiResponse.error(res, 409, 'A friend request is already pending');
            }
            if (existing.status === 'blocked') {
                return ApiResponse.error(res, 403, 'Cannot send friend request to this user');
            }
        }

        // Create friend request
        const friendship = await Friendship.create({
            requester: req.user.id,
            recipient: userId,
            status: 'pending',
        });

        return ApiResponse.success(res, 201, 'Friend request sent', {
            friendship,
            targetUser: {
                name: targetUser.name,
                uniqueId: targetUser.uniqueId,
            },
        });
    } catch (error) {
        if (error.code === 11000) {
            return ApiResponse.error(res, 409, 'Friend request already exists');
        }
        next(error);
    }
};

// ============================================
// @desc    Accept friend request
// @route   PUT /api/friends/accept/:friendshipId
// @access  Private
// ============================================
const acceptFriendRequest = async (req, res, next) => {
    try {
        const { friendshipId } = req.params;

        const friendship = await Friendship.findOne({
            _id: friendshipId,
            recipient: req.user.id,
            status: 'pending',
        });

        if (!friendship) {
            return ApiResponse.error(res, 404, 'Friend request not found');
        }

        friendship.status = 'accepted';
        await friendship.save();

        // Populate requester info
        await friendship.populate('requester', 'name uniqueId');

        return ApiResponse.success(res, 200, 'Friend request accepted', {
            friend: {
                name: friendship.requester.name,
                uniqueId: friendship.requester.uniqueId,
            },
        });
    } catch (error) {
        next(error);
    }
};

// ============================================
// @desc    Reject friend request
// @route   PUT /api/friends/reject/:friendshipId
// @access  Private
// ============================================
const rejectFriendRequest = async (req, res, next) => {
    try {
        const { friendshipId } = req.params;

        const friendship = await Friendship.findOneAndDelete({
            _id: friendshipId,
            recipient: req.user.id,
            status: 'pending',
        });

        if (!friendship) {
            return ApiResponse.error(res, 404, 'Friend request not found');
        }

        return ApiResponse.success(res, 200, 'Friend request rejected');
    } catch (error) {
        next(error);
    }
};

// ============================================
// @desc    Remove friend / Cancel request
// @route   DELETE /api/friends/:friendshipId
// @access  Private
// ============================================
const removeFriend = async (req, res, next) => {
    try {
        const { friendshipId } = req.params;

        const friendship = await Friendship.findOneAndDelete({
            _id: friendshipId,
            $or: [
                { requester: req.user.id },
                { recipient: req.user.id },
            ],
        });

        if (!friendship) {
            return ApiResponse.error(res, 404, 'Friendship not found');
        }

        return ApiResponse.success(res, 200, 'Friend removed');
    } catch (error) {
        next(error);
    }
};

// ============================================
// @desc    Get my friends list
// @route   GET /api/friends
// @access  Private
// ============================================
const getFriends = async (req, res, next) => {
    try {
        const friendships = await Friendship.find({
            $or: [
                { requester: req.user.id },
                { recipient: req.user.id },
            ],
            status: 'accepted',
        })
            .populate('requester', 'name uniqueId email')
            .populate('recipient', 'name uniqueId email')
            .lean();

        // Extract the friend (the other user) from each friendship
        const friends = friendships.map((f) => {
            const friend =
                f.requester._id.toString() === req.user.id
                    ? f.recipient
                    : f.requester;
            return {
                friendshipId: f._id,
                ...friend,
                friendsSince: f.createdAt,
            };
        });

        return ApiResponse.success(res, 200, 'Friends list retrieved', {
            friends,
            totalFriends: friends.length,
        });
    } catch (error) {
        next(error);
    }
};

// ============================================
// @desc    Get pending friend requests (received)
// @route   GET /api/friends/requests
// @access  Private
// ============================================
const getPendingRequests = async (req, res, next) => {
    try {
        const requests = await Friendship.find({
            recipient: req.user.id,
            status: 'pending',
        })
            .populate('requester', 'name uniqueId email')
            .sort({ createdAt: -1 })
            .lean();

        return ApiResponse.success(res, 200, 'Pending requests retrieved', {
            requests: requests.map((r) => ({
                friendshipId: r._id,
                from: r.requester,
                sentAt: r.createdAt,
            })),
            totalPending: requests.length,
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    sendFriendRequest,
    acceptFriendRequest,
    rejectFriendRequest,
    removeFriend,
    getFriends,
    getPendingRequests,
};