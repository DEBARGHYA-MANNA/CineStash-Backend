
const mongoose = require('mongoose');
const Watchlist = require('../models/Watchlist');
const ApiResponse = require('../utils/apiResponse');

// ============================================
// @desc    Get user's watchlist with filters
// @route   GET /api/watchlist?status=watched&contentType=movie&page=1&limit=20
// @access  Private
// ============================================
const getWatchlist = async (req, res, next) => {
    try {
        const {
            status,
            contentType,
            sortBy = 'updatedAt',
            order = 'desc',
            page = 1,
            limit = 20,
        } = req.query;

        // Validate pagination
        const currentPage = Math.max(1, parseInt(page, 10) || 1);
        const pageLimit = Math.min(
            100,
            Math.max(1, parseInt(limit, 10) || 20)
        );

        // Build filter query
        const filter = { user: req.user.id };

        if (status) {
            const validStatuses = [
                'want_to_watch',
                'currently_watching',
                'watched',
                'dropped',
            ];

            if (!validStatuses.includes(status)) {
                return ApiResponse.error(
                    res,
                    400,
                    `Invalid status. Must be one of: ${validStatuses.join(', ')}`
                );
            }

            filter.status = status;
        }

        if (contentType) {
            const validTypes = [
                'movie',
                'tv',
                'anime',
                'game',
                'book',
            ];

            if (!validTypes.includes(contentType)) {
                return ApiResponse.error(
                    res,
                    400,
                    `Invalid contentType. Must be one of: ${validTypes.join(', ')}`
                );
            }

            filter.contentType = contentType;
        }

        // Build sort object using allowed fields
        const allowedSortFields = [
            'createdAt',
            'updatedAt',
            'title',
            'rating',
        ];

        const safeSortBy = allowedSortFields.includes(sortBy)
            ? sortBy
            : 'updatedAt';

        const sortObj = {
            [safeSortBy]: order === 'asc' ? 1 : -1,
        };

        // Pagination offset
        const skip = (currentPage - 1) * pageLimit;

        // Fetch items and total count
        const [items, total] = await Promise.all([
            Watchlist.find(filter)
                .sort(sortObj)
                .skip(skip)
                .limit(pageLimit)
                .lean(),

            Watchlist.countDocuments(filter),
        ]);

        // Validate and cast user ID for aggregation
        if (!mongoose.isValidObjectId(req.user.id)) {
            return ApiResponse.error(res, 400, 'Invalid user ID');
        }

        const userId = new mongoose.Types.ObjectId(req.user.id);

        // Get status counts across the user's entire watchlist
        const statusCounts = await Watchlist.aggregate([
            {
                $match: { user: userId },
            },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 },
                },
            },
        ]);

        const counts = {
            total,
            want_to_watch: 0,
            currently_watching: 0,
            watched: 0,
            dropped: 0,
        };

        statusCounts.forEach((item) => {
            counts[item._id] = item.count;
        });

        return ApiResponse.paginated(
            res,
            'Watchlist retrieved',
            items,
            {
                currentPage,
                totalPages: Math.ceil(total / pageLimit),
                totalItems: total,
                statusCounts: counts,
            }
        );
    } catch (error) {
        next(error);
    }
};

// ============================================
// @desc    Add item to watchlist
// @route   POST /api/watchlist
// @access  Private
// @body    { contentId, contentType, title, posterUrl, overview, status, metadata }
// ============================================
const addToWatchlist = async (req, res, next) => {
    try {
        const {
            contentId,
            contentType,
            title,
            posterUrl,
            overview,
            status = 'want_to_watch',
            rating,
            notes,
            metadata,
        } = req.body;

        // Required field validation
        if (!contentId || !contentType || !title) {
            return ApiResponse.error(
                res,
                400,
                'contentId, contentType, and title are required'
            );
        }

        const validTypes = [
            'movie',
            'tv',
            'anime',
            'game',
            'book',
        ];

        if (!validTypes.includes(contentType)) {
            return ApiResponse.error(
                res,
                400,
                `Invalid contentType. Must be one of: ${validTypes.join(', ')}`
            );
        }

        const validStatuses = [
            'want_to_watch',
            'currently_watching',
            'watched',
            'dropped',
        ];

        if (!validStatuses.includes(status)) {
            return ApiResponse.error(
                res,
                400,
                `Invalid status. Must be one of: ${validStatuses.join(', ')}`
            );
        }

        // Validate rating if supplied
        if (
            rating !== undefined &&
            rating !== null &&
            (!Number.isFinite(Number(rating)) ||
                Number(rating) < 1 ||
                Number(rating) > 5)
        ) {
            return ApiResponse.error(
                res,
                400,
                'Rating must be between 1 and 5'
            );
        }

        // Check if item already exists
        const existing = await Watchlist.findOne({
            user: req.user.id,
            contentId: String(contentId),
            contentType,
        });

        if (existing) {
            return ApiResponse.error(
                res,
                409,
                'This item is already in your watchlist'
            );
        }

        // Create watchlist item
        const item = await Watchlist.create({
            user: req.user.id,
            contentId: String(contentId),
            contentType,
            title,
            posterUrl: posterUrl || null,
            overview: overview || '',
            status,
            rating: rating == null ? null : Number(rating),
            notes: notes || '',
            metadata: metadata || {},
        });

        return ApiResponse.success(
            res,
            201,
            'Item added to watchlist',
            item
        );
    } catch (error) {
        // Handle duplicate key errors
        if (error.code === 11000) {
            return ApiResponse.error(
                res,
                409,
                'This item is already in your watchlist'
            );
        }

        next(error);
    }
};

// ============================================
// @desc    Update watchlist item
// @route   PUT /api/watchlist/:id
// @access  Private
// @body    { status, rating, notes }
// ============================================
const updateWatchlistItem = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status, rating, notes } = req.body;

        // Validate item ID
        if (!mongoose.isValidObjectId(id)) {
            return ApiResponse.error(
                res,
                400,
                'Invalid watchlist item ID'
            );
        }

        // Find item and verify ownership
        const item = await Watchlist.findOne({
            _id: id,
            user: req.user.id,
        });

        if (!item) {
            return ApiResponse.error(
                res,
                404,
                'Watchlist item not found'
            );
        }

        // Validate and update status
        if (status !== undefined) {
            const validStatuses = [
                'want_to_watch',
                'currently_watching',
                'watched',
                'dropped',
            ];

            if (!validStatuses.includes(status)) {
                return ApiResponse.error(
                    res,
                    400,
                    `Invalid status. Must be one of: ${validStatuses.join(', ')}`
                );
            }

            item.status = status;
        }

        // Validate and update rating
        if (rating !== undefined) {
            if (
                rating !== null &&
                (!Number.isFinite(Number(rating)) ||
                    Number(rating) < 1 ||
                    Number(rating) > 5)
            ) {
                return ApiResponse.error(
                    res,
                    400,
                    'Rating must be between 1 and 5'
                );
            }

            item.rating = rating === null ? null : Number(rating);
        }

        // Validate and update notes
        if (notes !== undefined) {
            if (typeof notes !== 'string') {
                return ApiResponse.error(
                    res,
                    400,
                    'Notes must be a string'
                );
            }

            if (notes.length > 500) {
                return ApiResponse.error(
                    res,
                    400,
                    'Notes cannot exceed 500 characters'
                );
            }

            item.notes = notes;
        }

        await item.save();

        // AUTO-SYNC: If status changed to watched, sync to group vaults
        if (status === 'watched') {
            const {
                autoSyncWatchedToGroups,
            } = require('./groupVaultController');

            // Avoid blocking the response if group synchronization fails
            Promise.resolve()
                .then(() =>
                    autoSyncWatchedToGroups(
                        req.user.id,
                        item.contentId,
                        item.contentType,
                        item.rating
                    )
                )
                .catch((error) => {
                    console.error(
                        'Failed to sync watched item to group vaults:',
                        error
                    );
                });
        }

        return ApiResponse.success(
            res,
            200,
            'Watchlist item updated',
            item
        );
    } catch (error) {
        next(error);
    }
};

// ============================================
// @desc    Remove item from watchlist
// @route   DELETE /api/watchlist/:id
// @access  Private
// ============================================
const removeFromWatchlist = async (req, res, next) => {
    try {
        const { id } = req.params;

        if (!mongoose.isValidObjectId(id)) {
            return ApiResponse.error(
                res,
                400,
                'Invalid watchlist item ID'
            );
        }

        const item = await Watchlist.findOneAndDelete({
            _id: id,
            user: req.user.id,
        });

        if (!item) {
            return ApiResponse.error(
                res,
                404,
                'Watchlist item not found'
            );
        }

        return ApiResponse.success(
            res,
            200,
            'Item removed from watchlist',
            {
                deletedItem: {
                    id: item._id,
                    title: item.title,
                    contentType: item.contentType,
                },
            }
        );
    } catch (error) {
        next(error);
    }
};

// ============================================
// @desc    Check if item is in watchlist
// @route   GET /api/watchlist/check/:contentType/:contentId
// @access  Private
// ============================================
const checkWatchlist = async (req, res, next) => {
    try {
        const { contentType, contentId } = req.params;

        const validTypes = [
            'movie',
            'tv',
            'anime',
            'game',
            'book',
        ];

        if (!validTypes.includes(contentType)) {
            return ApiResponse.error(
                res,
                400,
                `Invalid contentType. Must be one of: ${validTypes.join(', ')}`
            );
        }

        const item = await Watchlist.findOne({
            user: req.user.id,
            contentId: String(contentId),
            contentType,
        }).lean();

        return ApiResponse.success(
            res,
            200,
            'Watchlist check complete',
            {
                inWatchlist: !!item,
                item: item || null,
            }
        );
    } catch (error) {
        next(error);
    }
};

// ============================================
// @desc    Get watchlist stats for dashboard
// @route   GET /api/watchlist/stats
// @access  Private
// ============================================
const getWatchlistStats = async (req, res, next) => {
    try {
        // Validate and cast user ID for aggregation
        if (!mongoose.isValidObjectId(req.user.id)) {
            return ApiResponse.error(
                res,
                400,
                'Invalid user ID'
            );
        }

        const userId = new mongoose.Types.ObjectId(req.user.id);

        const [
            totalItems,
            statusBreakdown,
            typeBreakdown,
            recentlyWatched,
            averageRating,
        ] = await Promise.all([
            Watchlist.countDocuments({ user: userId }),

            Watchlist.aggregate([
                { $match: { user: userId } },
                {
                    $group: {
                        _id: '$status',
                        count: { $sum: 1 },
                    },
                },
            ]),

            Watchlist.aggregate([
                { $match: { user: userId } },
                {
                    $group: {
                        _id: '$contentType',
                        count: { $sum: 1 },
                    },
                },
            ]),

            Watchlist.find({
                user: userId,
                status: 'watched',
            })
                .sort({ updatedAt: -1 })
                .limit(5)
                .select(
                    'title contentType posterUrl rating updatedAt'
                )
                .lean(),

            Watchlist.aggregate([
                {
                    $match: {
                        user: userId,
                        rating: { $ne: null },
                    },
                },
                {
                    $group: {
                        _id: null,
                        avgRating: { $avg: '$rating' },
                    },
                },
            ]),
        ]);

        // Format status breakdown
        const byStatus = {
            want_to_watch: 0,
            currently_watching: 0,
            watched: 0,
            dropped: 0,
        };

        statusBreakdown.forEach((item) => {
            byStatus[item._id] = item.count;
        });

        // Format content-type breakdown
        const byType = {};

        typeBreakdown.forEach((item) => {
            byType[item._id] = item.count;
        });

        const avgRating = averageRating[0]?.avgRating;

        return ApiResponse.success(
            res,
            200,
            'Watchlist stats retrieved',
            {
                totalItems,
                byStatus,
                byType,
                recentlyWatched,
                averageRating:
                    avgRating != null
                        ? Math.round(avgRating * 10) / 10
                        : null,
            }
        );
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getWatchlist,
    addToWatchlist,
    updateWatchlistItem,
    removeFromWatchlist,
    checkWatchlist,
    getWatchlistStats,
};
