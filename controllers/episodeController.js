const EpisodeProgress = require('../models/EpisodeProgress');
const ApiResponse = require('../utils/apiResponse');

// ============================================
// @desc    Get episode progress for a series
// @route   GET /api/episodes/:seriesType/:seriesId
// @access  Private
// ============================================
const getProgress = async (req, res, next) => {
    try {
        const { seriesType, seriesId } = req.params;

        if (!['tv', 'anime'].includes(seriesType)) {
            return ApiResponse.error(res, 400, 'seriesType must be "tv" or "anime"');
        }

        const episodes = await EpisodeProgress.find({
            user: req.user.id,
            seriesId: String(seriesId),
            seriesType,
        })
            .sort({ seasonNumber: 1, episodeNumber: 1 })
            .lean();

        // Group by season for easier frontend consumption
        const groupedBySeason = {};

        episodes.forEach((ep) => {
            const season = ep.seasonNumber;
            if (!groupedBySeason[season]) {
                groupedBySeason[season] = [];
            }
            groupedBySeason[season].push({
                episodeNumber: ep.episodeNumber,
                watched: ep.watched,
                watchedAt: ep.watchedAt,
            });
        });

        // Calculate overall stats
        const totalTracked = episodes.length;
        const totalWatched = episodes.filter((ep) => ep.watched).length;

        return ApiResponse.success(res, 200, 'Episode progress retrieved', {
            seriesId: String(seriesId),
            seriesType,
            totalTracked,
            totalWatched,
            progress: totalTracked > 0 ? Math.round((totalWatched / totalTracked) * 100) : 0,
            seasons: groupedBySeason,
            episodes,
        });
    } catch (error) {
        next(error);
    }
};

// ============================================
// @desc    Update single episode status
// @route   PUT /api/episodes/:seriesType/:seriesId/season/:seasonNum/episode/:epNum
// @access  Private
// @body    { watched: true/false }
// ============================================
const updateEpisode = async (req, res, next) => {
    try {
        const { seriesType, seriesId, seasonNum, epNum } = req.params;
        const { watched } = req.body;

        if (!['tv', 'anime'].includes(seriesType)) {
            return ApiResponse.error(res, 400, 'seriesType must be "tv" or "anime"');
        }

        if (watched === undefined) {
            return ApiResponse.error(res, 400, 'watched field is required (true/false)');
        }

        // Upsert: create if doesn't exist, update if it does
        const episode = await EpisodeProgress.findOneAndUpdate(
            {
                user: req.user.id,
                seriesId: String(seriesId),
                seriesType,
                seasonNumber: parseInt(seasonNum),
                episodeNumber: parseInt(epNum),
            },
            {
                $set: {
                    watched: Boolean(watched),
                    watchedAt: watched ? new Date() : null,
                },
                $setOnInsert: {
                    user: req.user.id,
                    seriesId: String(seriesId),
                    seriesType,
                    seasonNumber: parseInt(seasonNum),
                    episodeNumber: parseInt(epNum),
                },
            },
            {
                new: true,
                upsert: true,
                runValidators: true,
            }
        );

        return ApiResponse.success(
            res,
            200,
            watched ? 'Episode marked as watched' : 'Episode marked as unwatched',
            episode
        );
    } catch (error) {
        next(error);
    }
};

// ============================================
// @desc    Bulk update episodes (mark multiple as watched/unwatched)
// @route   PUT /api/episodes/:seriesType/:seriesId/bulk
// @access  Private
// @body    { episodes: [{ seasonNumber, episodeNumber, watched }], markAllUpTo: { season, episode } }
// ============================================
const bulkUpdateEpisodes = async (req, res, next) => {
    try {
        const { seriesType, seriesId } = req.params;
        const { episodes, markAllUpTo } = req.body;

        if (!['tv', 'anime'].includes(seriesType)) {
            return ApiResponse.error(res, 400, 'seriesType must be "tv" or "anime"');
        }

        const userId = req.user.id;
        const sid = String(seriesId);
        let updatedCount = 0;

        // Option 1: Mark all episodes up to a specific point
        if (markAllUpTo) {
            const { season, episode } = markAllUpTo;

            // Get all existing progress for this series
            const existing = await EpisodeProgress.find({
                user: userId,
                seriesId: sid,
                seriesType,
            });

            const existingMap = new Map();
            existing.forEach((ep) => {
                existingMap.set(`${ep.seasonNumber}-${ep.episodeNumber}`, ep);
            });

            // Build bulk operations
            const bulkOps = [];

            for (let s = 1; s <= season; s++) {
                const maxEp = s < season ? 999 : episode; // All episodes for previous seasons

                for (let e = 1; e <= maxEp; e++) {
                    const key = `${s}-${e}`;
                    const existingEp = existingMap.get(key);

                    if (existingEp) {
                        if (!existingEp.watched) {
                            bulkOps.push({
                                updateOne: {
                                    filter: { _id: existingEp._id },
                                    update: { $set: { watched: true, watchedAt: new Date() } },
                                },
                            });
                        }
                    } else {
                        bulkOps.push({
                            insertOne: {
                                document: {
                                    user: userId,
                                    seriesId: sid,
                                    seriesType,
                                    seasonNumber: s,
                                    episodeNumber: e,
                                    watched: true,
                                    watchedAt: new Date(),
                                },
                            },
                        });
                    }
                }
            }

            if (bulkOps.length > 0) {
                const result = await EpisodeProgress.bulkWrite(bulkOps);
                updatedCount = (result.modifiedCount || 0) + (result.insertedCount || 0);
            }

            return ApiResponse.success(
                res,
                200,
                `Marked all episodes up to S${season}E${episode} as watched`,
                { updatedCount }
            );
        }

        // Option 2: Update specific episodes
        if (episodes && Array.isArray(episodes)) {
            const bulkOps = episodes.map((ep) => ({
                updateOne: {
                    filter: {
                        user: userId,
                        seriesId: sid,
                        seriesType,
                        seasonNumber: ep.seasonNumber,
                        episodeNumber: ep.episodeNumber,
                    },
                    update: {
                        $set: {
                            watched: Boolean(ep.watched),
                            watchedAt: ep.watched ? new Date() : null,
                        },
                        $setOnInsert: {
                            user: userId,
                            seriesId: sid,
                            seriesType,
                            seasonNumber: ep.seasonNumber,
                            episodeNumber: ep.episodeNumber,
                        },
                    },
                    upsert: true,
                },
            }));

            if (bulkOps.length > 0) {
                const result = await EpisodeProgress.bulkWrite(bulkOps);
                updatedCount = (result.modifiedCount || 0) + (result.upsertedCount || 0);
            }

            return ApiResponse.success(
                res,
                200,
                `Updated ${updatedCount} episodes`,
                { updatedCount }
            );
        }

        return ApiResponse.error(
            res,
            400,
            'Provide either "episodes" array or "markAllUpTo" object'
        );
    } catch (error) {
        next(error);
    }
};

// ============================================
// @desc    Delete all episode progress for a series
// @route   DELETE /api/episodes/:seriesType/:seriesId
// @access  Private
// ============================================
const deleteProgress = async (req, res, next) => {
    try {
        const { seriesType, seriesId } = req.params;

        const result = await EpisodeProgress.deleteMany({
            user: req.user.id,
            seriesId: String(seriesId),
            seriesType,
        });

        return ApiResponse.success(res, 200, 'Episode progress cleared', {
            deletedCount: result.deletedCount,
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getProgress,
    updateEpisode,
    bulkUpdateEpisodes,
    deleteProgress,
};