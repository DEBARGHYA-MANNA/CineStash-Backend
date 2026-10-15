const Watchlist = require('../models/Watchlist');
const tmdbService = require('../services/tmdbService');
const anilistService = require('../services/anilistService');
const ApiResponse = require('../utils/apiResponse');

// ============================================
// @desc    Get trending content (global, all types)
// @route   GET /api/recommendations/trending
// @access  Public
// ============================================
const getTrending = async (req, res, next) => {
    try {
        const { page = 1 } = req.query;

        // Fetch trending from both TMDB and AniList in parallel
        const [tmdbTrending, animeTrending] = await Promise.allSettled([
            tmdbService.getTrending('week', parseInt(page)),
            anilistService.getTrendingAnime(parseInt(page)),
        ]);

        const results = [];

        if (tmdbTrending.status === 'fulfilled') {
            results.push(...tmdbTrending.value.results);
        }

        if (animeTrending.status === 'fulfilled') {
            results.push(...animeTrending.value.results);
        }

        // Shuffle to mix content types
        const shuffled = results.sort(() => Math.random() - 0.5);

        return ApiResponse.success(res, 200, 'Trending content retrieved', {
            results: shuffled,
            sources: {
                tmdb: tmdbTrending.status === 'fulfilled',
                anilist: animeTrending.status === 'fulfilled',
            },
        });
    } catch (error) {
        next(error);
    }
};

// ============================================
// @desc    Get personalized recommendations based on user's watchlist
// @route   GET /api/recommendations/for-you
// @access  Private
// ============================================
const getPersonalized = async (req, res, next) => {
    try {
        const userId = req.user.id;

        // Step 1: Get user's watched and currently watching items
        const userItems = await Watchlist.find({
            user: userId,
            status: { $in: ['watched', 'currently_watching'] },
        })
            .select('contentType metadata rating')
            .lean();

        if (userItems.length === 0) {
            // No history — return general trending instead
            return getTrending(req, res, next);
        }

        // Step 2: Extract genre preferences from metadata
        const genreCounts = {};
        const typeCounts = {};

        userItems.forEach((item) => {
            // Count content types
            typeCounts[item.contentType] = (typeCounts[item.contentType] || 0) + 1;

            // Count genres from metadata
            if (item.metadata?.genres && Array.isArray(item.metadata.genres)) {
                item.metadata.genres.forEach((genre) => {
                    const genreName = typeof genre === 'string' ? genre : genre.name;
                    if (genreName) {
                        // Weight by rating if available
                        const weight = item.rating || 3;
                        genreCounts[genreName] = (genreCounts[genreName] || 0) + weight;
                    }
                });
            }
        });

        // Step 3: Get top genres (sorted by weighted count)
        const topGenres = Object.entries(genreCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([genre]) => genre);

        // Step 4: Get top content type
        const topType = Object.entries(typeCounts)
            .sort((a, b) => b[1] - a[1])[0]?.[0] || 'movie';

        // Step 5: Fetch recommendations based on preferences
        const recommendations = [];
        const fetchPromises = [];

        // Fetch popular content for top type
        if (topType === 'movie' || topType === 'tv') {
            fetchPromises.push(
                tmdbService.getPopular(topType === 'movie' ? 1 : 1)
                    .then((data) => {
                        const items = topType === 'movie' ? data.results : data.results;
                        recommendations.push(...items.slice(0, 10));
                    })
                    .catch(() => { })
            );

            // Also get top rated
            fetchPromises.push(
                (topType === 'movie'
                    ? tmdbService.getTopRatedMovies(1)
                    : tmdbService.getTopRatedTV(1)
                )
                    .then((data) => {
                        recommendations.push(...data.results.slice(0, 10));
                    })
                    .catch(() => { })
            );
        }

        if (topType === 'anime') {
            fetchPromises.push(
                anilistService.getPopularAnime(1)
                    .then((data) => {
                        recommendations.push(...data.results.slice(0, 10));
                    })
                    .catch(() => { })
            );
        }

        // Always include some anime and some movies/tv for variety
        fetchPromises.push(
            anilistService.getTrendingAnime(1)
                .then((data) => {
                    recommendations.push(...data.results.slice(0, 5));
                })
                .catch(() => { })
        );

        fetchPromises.push(
            tmdbService.getTrending('week', 1)
                .then((data) => {
                    recommendations.push(...data.results.slice(0, 5));
                })
                .catch(() => { })
        );

        await Promise.allSettled(fetchPromises);

        // Step 6: Remove duplicates and items already in watchlist
        const watchlistIds = new Set(
            userItems.map((item) => `${item.contentType}-${item.contentId}`)
        );

        const seen = new Set();
        const uniqueRecs = recommendations.filter((rec) => {
            const key = `${rec.type}-${rec.id}`;
            if (seen.has(key) || watchlistIds.has(key)) return false;
            seen.add(key);
            return true;
        });

        return ApiResponse.success(res, 200, 'Personalized recommendations', {
            results: uniqueRecs.slice(0, 20),
            basedOn: {
                topGenres,
                topType,
                totalItemsAnalyzed: userItems.length,
            },
        });
    } catch (error) {
        next(error);
    }
};

// ============================================
// @desc    Get recommendations by genre
// @route   GET /api/recommendations/by-genre?genre=Action&type=movie
// @access  Public
// ============================================
const getByGenre = async (req, res, next) => {
    try {
        const { genre, type = 'movie', page = 1 } = req.query;

        if (!genre) {
            return ApiResponse.error(res, 400, 'genre parameter is required');
        }

        let results;

        if (type === 'movie') {
            // First get genre ID from name
            const genres = await tmdbService.getMovieGenres();
            const genreObj = genres.find(
                (g) => g.name.toLowerCase() === genre.toLowerCase()
            );

            if (!genreObj) {
                return ApiResponse.error(res, 404, `Genre "${genre}" not found for movies`);
            }

            results = await tmdbService.discoverMoviesByGenre(genreObj.id, parseInt(page));
        } else if (type === 'tv') {
            const genres = await tmdbService.getTVGenres();
            const genreObj = genres.find(
                (g) => g.name.toLowerCase() === genre.toLowerCase()
            );

            if (!genreObj) {
                return ApiResponse.error(res, 404, `Genre "${genre}" not found for TV`);
            }

            results = await tmdbService.discoverTVByGenre(genreObj.id, parseInt(page));
        } else if (type === 'anime') {
            results = await anilistService.searchAnime('', parseInt(page), { genre });
            return ApiResponse.paginated(
                res,
                `Anime in genre "${genre}"`,
                results.results,
                results.pagination
            );
        } else {
            return ApiResponse.error(res, 400, 'Type must be "movie", "tv", or "anime"');
        }

        return ApiResponse.paginated(
            res,
            `${type} content in genre "${genre}"`,
            results.results,
            {
                currentPage: results.currentPage,
                totalPages: results.totalPages,
            }
        );
    } catch (error) {
        next(error);
    }
};

// ============================================
// @desc    Get popular content across all types (for homepage)
// @route   GET /api/recommendations/popular-all
// @access  Public
// ============================================
const getPopularAll = async (req, res, next) => {
    try {
        const [movies, tv, anime] = await Promise.allSettled([
            tmdbService.getPopularMovies(1),
            tmdbService.getPopularTV(1),
            anilistService.getPopularAnime(1),
        ]);

        return ApiResponse.success(res, 200, 'Popular content across all types', {
            movies: movies.status === 'fulfilled' ? movies.value.results.slice(0, 10) : [],
            tv: tv.status === 'fulfilled' ? tv.value.results.slice(0, 10) : [],
            anime: anime.status === 'fulfilled' ? anime.value.results.slice(0, 10) : [],
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getTrending,
    getPersonalized,
    getByGenre,
    getPopularAll,
};