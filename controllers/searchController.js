const tmdbService = require('../services/tmdbService');
const anilistService = require('../services/anilistService');
const ApiResponse = require('../utils/apiResponse');

// ============================================
// MOVIES (TMDB)
// ============================================

const searchMovies = async (req, res, next) => {
    try {
        const { query, page = 1 } = req.query;

        if (!query || query.trim() === '') {
            return ApiResponse.error(res, 400, 'Search query is required');
        }

        const results = await tmdbService.searchMovies(query.trim(), parseInt(page));

        return ApiResponse.paginated(
            res,
            `Found ${results.totalResults} movies for "${query}"`,
            results.results,
            {
                currentPage: results.currentPage,
                totalPages: results.totalPages,
                totalResults: results.totalResults,
            }
        );
    } catch (error) {
        next(error);
    }
};

// ============================================
// TV SHOWS (TMDB)
// ============================================

const searchTV = async (req, res, next) => {
    try {
        const { query, page = 1 } = req.query;

        if (!query || query.trim() === '') {
            return ApiResponse.error(res, 400, 'Search query is required');
        }

        const results = await tmdbService.searchTV(query.trim(), parseInt(page));

        return ApiResponse.paginated(
            res,
            `Found ${results.totalResults} TV shows for "${query}"`,
            results.results,
            {
                currentPage: results.currentPage,
                totalPages: results.totalPages,
                totalResults: results.totalResults,
            }
        );
    } catch (error) {
        next(error);
    }
};

// ============================================
// ANIME (ANILIST)
// ============================================

const searchAnime = async (req, res, next) => {
    try {
        const { query, page = 1, format, status, genre, sort } = req.query;

        if (!query || query.trim() === '') {
            return ApiResponse.error(res, 400, 'Search query is required');
        }

        const filters = {};
        if (format) filters.format = format;
        if (status) filters.status = status;
        if (genre) filters.genre = genre;
        if (sort) filters.sort = sort;

        const results = await anilistService.searchAnime(query.trim(), parseInt(page), filters);

        return ApiResponse.paginated(
            res,
            `Found anime results for "${query}"`,
            results.results,
            results.pagination
        );
    } catch (error) {
        next(error);
    }
};

// ============================================
// DETAILS (TMDB + ANILIST)
// ============================================

const getDetails = async (req, res, next) => {
    try {
        const { type, id } = req.params;

        if (!['movie', 'tv', 'anime'].includes(type)) {
            return ApiResponse.error(res, 400, 'Type must be "movie", "tv", or "anime"');
        }

        let details;

        if (type === 'movie') {
            details = await tmdbService.getMovieDetails(id);
        } else if (type === 'tv') {
            details = await tmdbService.getTVDetails(id);
        } else if (type === 'anime') {
            details = await anilistService.getAnimeDetails(id);
        }

        return ApiResponse.success(res, 200, `${type} details retrieved`, details);
    } catch (error) {
        if (error.message.includes('not found') || error.message.includes('404')) {
            return ApiResponse.error(res, 404, 'Content not found');
        }
        next(error);
    }
};

// ============================================
// TRENDING (TMDB + ANILIST)
// ============================================

const getTrending = async (req, res, next) => {
    try {
        const { timeWindow = 'week', page = 1, type } = req.query;

        if (type === 'anime') {
            const results = await anilistService.getTrendingAnime(parseInt(page));
            return ApiResponse.paginated(res, 'Trending anime', results.results, results.pagination);
        }

        if (!['day', 'week'].includes(timeWindow)) {
            return ApiResponse.error(res, 400, 'timeWindow must be "day" or "week"');
        }

        const results = await tmdbService.getTrending(timeWindow, parseInt(page));

        return ApiResponse.paginated(
            res,
            `Trending content (${timeWindow})`,
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
// POPULAR (TMDB + ANILIST)
// ============================================

const getPopular = async (req, res, next) => {
    try {
        const { type = 'movie', page = 1 } = req.query;

        if (type === 'movie') {
            const results = await tmdbService.getPopularMovies(parseInt(page));
            return ApiResponse.paginated(res, 'Popular movies', results.results, {
                currentPage: results.currentPage,
                totalPages: results.totalPages,
            });
        } else if (type === 'tv') {
            const results = await tmdbService.getPopularTV(parseInt(page));
            return ApiResponse.paginated(res, 'Popular TV shows', results.results, {
                currentPage: results.currentPage,
                totalPages: results.totalPages,
            });
        } else if (type === 'anime') {
            const results = await anilistService.getPopularAnime(parseInt(page));
            return ApiResponse.paginated(res, 'Popular anime', results.results, results.pagination);
        } else {
            return ApiResponse.error(res, 400, 'Type must be "movie", "tv", or "anime"');
        }
    } catch (error) {
        next(error);
    }
};

// ============================================
// TOP RATED (TMDB + ANILIST)
// ============================================

const getTopRated = async (req, res, next) => {
    try {
        const { type = 'movie', page = 1 } = req.query;

        if (type === 'movie') {
            const results = await tmdbService.getTopRatedMovies(parseInt(page));
            return ApiResponse.paginated(res, 'Top rated movies', results.results, {
                currentPage: results.currentPage,
                totalPages: results.totalPages,
            });
        } else if (type === 'tv') {
            const results = await tmdbService.getTopRatedTV(parseInt(page));
            return ApiResponse.paginated(res, 'Top rated TV shows', results.results, {
                currentPage: results.currentPage,
                totalPages: results.totalPages,
            });
        } else if (type === 'anime') {
            const results = await anilistService.getTopAnime(parseInt(page));
            return ApiResponse.paginated(res, 'Top rated anime', results.results, results.pagination);
        } else {
            return ApiResponse.error(res, 400, 'Type must be "movie", "tv", or "anime"');
        }
    } catch (error) {
        next(error);
    }
};

// ============================================
// GENRES (TMDB + ANILIST)
// ============================================

const getGenres = async (req, res, next) => {
    try {
        const { type = 'movie' } = req.query;

        let genres;

        if (type === 'movie') {
            genres = await tmdbService.getMovieGenres();
        } else if (type === 'tv') {
            genres = await tmdbService.getTVGenres();
        } else if (type === 'anime') {
            genres = await anilistService.getAnimeGenres();
        } else {
            return ApiResponse.error(res, 400, 'Type must be "movie", "tv", or "anime"');
        }

        return ApiResponse.success(res, 200, `${type} genres retrieved`, { genres });
    } catch (error) {
        next(error);
    }
};

// ============================================
// DISCOVER BY GENRE (TMDB)
// ============================================

const discoverByGenre = async (req, res, next) => {
    try {
        const { type = 'movie', genreId, page = 1 } = req.query;

        if (!genreId) {
            return ApiResponse.error(res, 400, 'genreId is required');
        }

        let results;

        if (type === 'movie') {
            results = await tmdbService.discoverMoviesByGenre(genreId, parseInt(page));
        } else if (type === 'tv') {
            results = await tmdbService.discoverTVByGenre(genreId, parseInt(page));
        } else {
            return ApiResponse.error(res, 400, 'Discover by genre currently supports "movie" and "tv" only');
        }

        return ApiResponse.paginated(
            res,
            `${type} content for genre ${genreId}`,
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
// SEASONAL ANIME
// ============================================

const getSeasonalAnime = async (req, res, next) => {
    try {
        const { page = 1 } = req.query;
        const results = await anilistService.getSeasonalAnime(parseInt(page));

        return ApiResponse.paginated(
            res,
            'Currently airing seasonal anime',
            results.results,
            results.pagination
        );
    } catch (error) {
        next(error);
    }
};

// ============================================
// UPCOMING ANIME
// ============================================

const getUpcomingAnime = async (req, res, next) => {
    try {
        const { page = 1 } = req.query;
        const results = await anilistService.getUpcomingAnime(parseInt(page));

        return ApiResponse.paginated(
            res,
            'Upcoming anime',
            results.results,
            results.pagination
        );
    } catch (error) {
        next(error);
    }
};

// ============================================
// ANIME RECOMMENDATIONS
// ============================================

const getAnimeRecommendations = async (req, res, next) => {
    try {
        const { id } = req.params;

        if (!id) {
            return ApiResponse.error(res, 400, 'Anime ID is required');
        }

        const recommendations = await anilistService.getAnimeRecommendations(id);

        return ApiResponse.success(
            res,
            200,
            'Anime recommendations retrieved',
            { recommendations }
        );
    } catch (error) {
        next(error);
    }
};

module.exports = {
    searchMovies,
    searchTV,
    searchAnime,
    getSeasonalAnime,
    getUpcomingAnime,
    getAnimeRecommendations,
    getDetails,
    getTrending,
    getPopular,
    getTopRated,
    getGenres,
    discoverByGenre,
};