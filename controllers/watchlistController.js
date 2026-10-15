const Watchlist = require('../models/Watchlist');
const ApiResponse = require('../utils/apiResponse');

// ============================================
// @desc    Get user's watchlist with filters
// @route   GET /api/watchlist?status=watched&contentType=movie&page=1&limit=20
// @access  Private
// ============================================
const getWatchlist = async (req, res, next) => {
    try {
        const { status, contentType, sortBy = 'updatedAt', order = 'desc', page = 1, limit = 20 } = req.query;

        // Build filter query
        const filter = { user: req.user.id };

        if (status) {
            const validStatuses = ['want_to_watch', 'currently_watching', 'watched', 'dropped'];
            if (!validStatuses.includes(status)) {
                return ApiResponse.error(res, 400, `Invalid status. Must be one of: ${validStatuses.join(', ')}`);
            }
            filter.status = status;
        }

        if (contentType) {
            const validTypes = ['movie', 'tv', 'anime', 'game', 'book'];
            if (!validTypes.includes(contentType)) {
                return ApiResponse.error(res, 400, `Invalid contentType. Must be one of: ${validTypes.join(', ')}`);
            }
            filter.contentType = contentType;
        }

        // Build sort object
        const sortObj = {};
        sortObj[sortBy] = order === 'asc' ? 1 : -1;

        // Pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Execute query
        const [items, total] = await Promise.all([
            Watchlist.find(filter)
                .sort(sortObj)
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            Watchlist.countDocuments(filter),
        ]);

        // Get status counts for the UI (how many in each status)
        const statusCounts = await Watchlist.aggregate([
            { $match: { user: req.user.id } },
            { $group: { _id: '$status', count: { $sum: 1 } } },
        ]);

        const counts = {
            total,
            want_to_watch: 0,
            currently_watching: 0,
            watched: 0,
            dropped: 0,
        };

        statusCounts.forEach((s) => {
            counts[s._id] = s.count;
        });

        return ApiResponse.paginated(
            res,
            'Watchlist retrieved',
            items,
            {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / parseInt(limit)),
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

        // Validation
        if (!contentId || !contentType || !title) {
            return ApiResponse.error(res, 400, 'contentId, contentType, and title are required');
        }

        const validTypes = ['movie', 'tv', 'anime', 'game', 'book'];
        if (!validTypes.includes(contentType)) {
            return ApiResponse.error(res, 400, `Invalid contentType. Must be one of: ${validTypes.join(', ')}`);
        }

        const validStatuses = ['want_to_watch', 'currently_watching', 'watched', 'dropped'];
        if (!validStatuses.includes(status)) {
            return ApiResponse.error(res, 400, `Invalid status. Must be one of: ${validStatuses.join(', ')}`);
        }

        // Check if already in watchlist
        const existing = await Watchlist.findOne({
            user: req.user.id,
            contentId: String(contentId),
            contentType,
        });

        if (existing) {
            return ApiResponse.error(res, 409, 'This item is already in your watchlist');
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
            rating: rating || null,
            notes: notes || '',
            metadata: metadata || {},
        });

        return ApiResponse.success(res, 201, 'Item added to watchlist', item);
    } catch (error) {
        // Handle duplicate key error (race condition)
        if (error.code === 11000) {
            return ApiResponse.error(res, 409, 'This item is already in your watchlist');
        }
        next(error);
    }
};

// ============================================
// @desc    Update watchlist item (status, rating, notes)
// @route   PUT /api/watchlist/:id
// @access  Private
// @body    { status, rating, notes }
// ============================================
const updateWatchlistItem = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status, rating, notes } = req.body;

        // Find item and verify ownership
        const item = await Watchlist.findOne({
            _id: id,
            user: req.user.id,
        });

        if (!item) {
            return ApiResponse.error(res, 404, 'Watchlist item not found');
        }

        // Validate and update fields
        if (status !== undefined) {
            const validStatuses = ['want_to_watch', 'currently_watching', 'watched', 'dropped'];
            if (!validStatuses.includes(status)) {
                return ApiResponse.error(res, 400, `Invalid status. Must be one of: ${validStatuses.join(', ')}`);
            }
            item.status = status;
        }

        if (rating !== undefined) {
            if (rating !== null && (rating < 1 || rating > 5)) {
                return ApiResponse.error(res, 400, 'Rating must be between 1 and 5');
            }
            item.rating = rating;
        }

        if (notes !== undefined) {
            if (notes.length > 500) {
                return ApiResponse.error(res, 400, 'Notes cannot exceed 500 characters');
            }
            item.notes = notes;
        }

        await item.save();

        return ApiResponse.success(res, 200, 'Watchlist item updated', item);
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

        const item = await Watchlist.findOneAndDelete({
            _id: id,
            user: req.user.id,
        });

        if (!item) {
            return ApiResponse.error(res, 404, 'Watchlist item not found');
        }

        return ApiResponse.success(res, 200, 'Item removed from watchlist', {
            deletedItem: {
                id: item._id,
                title: item.title,
                contentType: item.contentType,
            },
        });
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

        const item = await Watchlist.findOne({
            user: req.user.id,
            contentId: String(contentId),
            contentType,
        });

        return ApiResponse.success(res, 200, 'Watchlist check complete', {
            inWatchlist: !!item,
            item: item || null,
        });
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
        const userId = req.user.id;

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
                { $group: { _id: '$status', count: { $sum: 1 } } },
            ]),

            Watchlist.aggregate([
                { $match: { user: userId } },
                { $group: { _id: '$contentType', count: { $sum: 1 } } },
            ]),

            Watchlist.find({ user: userId, status: 'watched' })
                .sort({ updatedAt: -1 })
                .limit(5)
                .select('title contentType posterUrl rating updatedAt')
                .lean(),

            Watchlist.aggregate([
                { $match: { user: userId, rating: { $ne: null } } },
                { $group: { _id: null, avgRating: { $avg: '$rating' } } },
            ]),
        ]);

        // Format status breakdown
        const byStatus = {
            want_to_watch: 0,
            currently_watching: 0,
            watched: 0,
            dropped: 0,
        };
        statusBreakdown.forEach((s) => {
            byStatus[s._id] = s.count;
        });

        // Format type breakdown
        const byType = {};
        typeBreakdown.forEach((t) => {
            byType[t._id] = t.count;
        });

        return ApiResponse.success(res, 200, 'Watchlist stats retrieved', {
            totalItems,
            byStatus,
            byType,
            recentlyWatched,
            averageRating: averageRating[0]?.avgRating
                ? Math.round(averageRating[0].avgRating * 10) / 10
                : null,
        });
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