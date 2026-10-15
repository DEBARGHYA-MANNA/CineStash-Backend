const tmdbService = require('../services/tmdbService');
const ApiResponse = require('../utils/apiResponse');

// ============================================
// @desc    Search movies
// @route   GET /api/search/movies?query=...&page=1
// @access  Public
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
// @desc    Search TV shows
// @route   GET /api/search/tv?query=...&page=1
// @access  Public
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
// @desc    Get details for a movie or TV show
// @route   GET /api/search/details/:type/:id
// @access  Public
// ============================================
const getDetails = async (req, res, next) => {
    try {
        const { type, id } = req.params;

        if (!['movie', 'tv'].includes(type)) {
            return ApiResponse.error(res, 400, 'Type must be "movie" or "tv"');
        }

        let details;

        if (type === 'movie') {
            details = await tmdbService.getMovieDetails(id);
        } else {
            details = await tmdbService.getTVDetails(id);
        }

        return ApiResponse.success(res, 200, `${type} details retrieved`, details);
    } catch (error) {
        if (error.message.includes('404')) {
            return ApiResponse.error(res, 404, 'Content not found');
        }
        next(error);
    }
};

// ============================================
// @desc    Get trending content
// @route   GET /api/search/trending?timeWindow=week&page=1
// @access  Public
// ============================================
const getTrending = async (req, res, next) => {
    try {
        const { timeWindow = 'week', page = 1 } = req.query;

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
// @desc    Get popular content
// @route   GET /api/search/popular?type=movie&page=1
// @access  Public
// ============================================
const getPopular = async (req, res, next) => {
    try {
        const { type = 'movie', page = 1 } = req.query;

        let results;

        if (type === 'movie') {
            results = await tmdbService.getPopularMovies(parseInt(page));
        } else if (type === 'tv') {
            results = await tmdbService.getPopularTV(parseInt(page));
        } else {
            return ApiResponse.error(res, 400, 'Type must be "movie" or "tv"');
        }

        return ApiResponse.paginated(
            res,
            `Popular ${type} content`,
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
// @desc    Get top rated content
// @route   GET /api/search/top-rated?type=movie&page=1
// @access  Public
// ============================================
const getTopRated = async (req, res, next) => {
    try {
        const { type = 'movie', page = 1 } = req.query;

        let results;

        if (type === 'movie') {
            results = await tmdbService.getTopRatedMovies(parseInt(page));
        } else if (type === 'tv') {
            results = await tmdbService.getTopRatedTV(parseInt(page));
        } else {
            return ApiResponse.error(res, 400, 'Type must be "movie" or "tv"');
        }

        return ApiResponse.paginated(
            res,
            `Top rated ${type} content`,
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
// @desc    Get all genres
// @route   GET /api/search/genres?type=movie
// @access  Public
// ============================================
const getGenres = async (req, res, next) => {
    try {
        const { type = 'movie' } = req.query;

        let genres;

        if (type === 'movie') {
            genres = await tmdbService.getMovieGenres();
        } else if (type === 'tv') {
            genres = await tmdbService.getTVGenres();
        } else {
            return ApiResponse.error(res, 400, 'Type must be "movie" or "tv"');
        }

        return ApiResponse.success(res, 200, `${type} genres retrieved`, { genres });
    } catch (error) {
        next(error);
    }
};

// ============================================
// @desc    Discover content by genre
// @route   GET /api/search/discover?type=movie&genreId=28&page=1
// @access  Public
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
            return ApiResponse.error(res, 400, 'Type must be "movie" or "tv"');
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

module.exports = {
    searchMovies,
    searchTV,
    getDetails,
    getTrending,
    getPopular,
    getTopRated,
    getGenres,
    discoverByGenre,
};