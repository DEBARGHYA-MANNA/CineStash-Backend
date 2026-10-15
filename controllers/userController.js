const User = require('../models/User');
const ApiResponse = require('../utils/apiResponse');

// ============================================
// @desc    Search users by unique ID or name
// @route   GET /api/users/search?query=DEB-7X9K2
// @access  Private
// ============================================
const searchUsers = async (req, res, next) => {
    try {
        const { query } = req.query;

        if (!query || query.trim() === '') {
            return ApiResponse.error(res, 400, 'Search query is required');
        }

        const searchQuery = query.trim().toUpperCase();

        // Search by uniqueId (exact or partial) or name (partial)
        const users = await User.find({
            $or: [
                { uniqueId: { $regex: searchQuery, $options: 'i' } },
                { name: { $regex: query.trim(), $options: 'i' } },
            ],
            _id: { $ne: req.user.id }, // Exclude self
        })
            .select('name uniqueId email referralCode referralTier')
            .limit(20)
            .lean();

        return ApiResponse.success(res, 200, `Found ${users.length} users`, { users });
    } catch (error) {
        next(error);
    }
};

// ============================================
// @desc    Get user profile by unique ID
// @route   GET /api/users/profile/:uniqueId
// @access  Private
// ============================================
const getUserProfile = async (req, res, next) => {
    try {
        const { uniqueId } = req.params;

        const user = await User.findOne({
            uniqueId: uniqueId.toUpperCase(),
        })
            .select('name uniqueId referralTier referralCount createdAt')
            .lean();

        if (!user) {
            return ApiResponse.error(res, 404, 'User not found');
        }

        return ApiResponse.success(res, 200, 'User profile retrieved', { user });
    } catch (error) {
        next(error);
    }
};

// ============================================
// @desc    Get my referral info
// @route   GET /api/users/referral
// @access  Private
// ============================================
const getReferralInfo = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id)
            .select('referralCode referralCount referralTier referredBy')
            .populate('referredBy', 'name uniqueId')
            .lean();

        // Get list of users referred by this user
        const referredUsers = await User.find({ referredBy: req.user.id })
            .select('name uniqueId createdAt')
            .sort({ createdAt: -1 })
            .lean();

        return ApiResponse.success(res, 200, 'Referral info retrieved', {
            referralCode: user.referralCode,
            referralCount: user.referralCount,
            referralTier: user.referralTier,
            referredBy: user.referredBy,
            referredUsers,
        });
    } catch (error) {
        next(error);
    }
};

// ============================================
// @desc    Use a referral code during registration
// @route   POST /api/users/use-referral
// @access  Private (called after registration)
// ============================================
const useReferralCode = async (req, res, next) => {
    try {
        const { referralCode } = req.body;

        if (!referralCode) {
            return ApiResponse.error(res, 400, 'Referral code is required');
        }

        // Check if user already has a referrer
        const currentUser = await User.findById(req.user.id);
        if (currentUser.referredBy) {
            return ApiResponse.error(res, 400, 'You have already used a referral code');
        }

        // Find the referrer
        const referrer = await User.findOne({
            referralCode: referralCode.toUpperCase(),
        });

        if (!referrer) {
            return ApiResponse.error(res, 404, 'Invalid referral code');
        }

        if (referrer._id.toString() === req.user.id) {
            return ApiResponse.error(res, 400, 'You cannot use your own referral code');
        }

        // Link the referral
        currentUser.referredBy = referrer._id;
        await currentUser.save({ validateBeforeSave: false });

        // Increment referrer's count
        referrer.referralCount += 1;

        // Update tier based on count
        if (referrer.referralCount >= 50) referrer.referralTier = 'diamond';
        else if (referrer.referralCount >= 25) referrer.referralTier = 'platinum';
        else if (referrer.referralCount >= 10) referrer.referralTier = 'gold';
        else if (referrer.referralCount >= 5) referrer.referralTier = 'silver';
        else referrer.referralTier = 'bronze';

        await referrer.save({ validateBeforeSave: false });

        return ApiResponse.success(res, 200, 'Referral code applied successfully', {
            referredBy: {
                name: referrer.name,
                uniqueId: referrer.uniqueId,
            },
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    searchUsers,
    getUserProfile,
    getReferralInfo,
    useReferralCode,
};