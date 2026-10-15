const axios = require('axios');

const TMDB_BASE_URL = process.env.TMDB_BASE_URL || 'https://api.themoviedb.org/3';
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_IMAGE_BASE = process.env.TMDB_IMAGE_BASE || 'https://image.tmdb.org/t/p/';

const http = require('http');
const https = require('https');

const tmdbClient = axios.create({
    baseURL: TMDB_BASE_URL,
    timeout: 15000,
    params: {
        api_key: TMDB_API_KEY,
        language: 'en-US',
    },
    // Force IPv4 connections (fix for JioFiber IPv6 timeout)
    httpAgent: new http.Agent({ family: 4 }),
    httpsAgent: new https.Agent({ family: 4 }),
});

// Response interceptor for better error logging
tmdbClient.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response) {
            // TMDB returned an error response (4xx, 5xx)
            console.error(`❌ TMDB API Error [${error.response.status}]:`, error.response.data?.status_message);
        } else if (error.request) {
            // Request was made but no response received (network issue)
            console.error('❌ TMDB Network Error: No response received');
            console.error('   URL:', error.config?.url);
            console.error('   Details:', error.message);
        } else {
            // Something else went wrong
            console.error('❌ TMDB Request Error:', error.message);
        }
        return Promise.reject(error);
    }
);

/**
 * Helper: Make a request to TMDB API
 * @param {string} endpoint - API endpoint path (e.g., '/search/movie')
 * @param {Object} params - Additional query parameters
 * @returns {Promise<Object>} Parsed JSON response data
 */
const tmdbRequest = async (endpoint, params = {}) => {
    if (!TMDB_API_KEY || TMDB_API_KEY === 'your_tmdb_api_key_here') {
        throw new Error('TMDB API key is not configured. Please add TMDB_API_KEY to your .env file.');
    }

    try {
        const response = await tmdbClient.get(endpoint, { params });
        return response.data;
    } catch (error) {
        if (error.response) {
            const status = error.response.status;
            const message = error.response.data?.status_message || 'Unknown TMDB error';

            if (status === 401) {
                throw new Error('Invalid TMDB API key. Please check your TMDB_API_KEY in .env');
            }
            if (status === 404) {
                throw new Error('Content not found on TMDB');
            }
            if (status === 429) {
                throw new Error('TMDB rate limit exceeded. Please wait a moment and try again.');
            }

            throw new Error(`TMDB API error (${status}): ${message}`);
        }

        if (error.code === 'ENOTFOUND' || error.code === 'EAI_AGAIN') {
            throw new Error('Cannot reach TMDB servers. Please check your internet connection.');
        }

        if (error.code === 'ECONNABORTED') {
            throw new Error('TMDB request timed out. Please try again.');
        }

        throw new Error(error.message || 'Failed to connect to TMDB API');
    }
};

/**
 * Helper: Build full image URL from TMDB poster/backdrop path
 * @param {string} path - Image path from TMDB (e.g., "/abc123.jpg")
 * @param {string} size - Image size (w500, w780, original, etc.)
 * @returns {string|null} Full image URL or null
 */
const getImageUrl = (path, size = 'w500') => {
    if (!path) return null;
    return `${TMDB_IMAGE_BASE}${size}${path}`;
};

// ============================================
// MOVIES
// ============================================

const searchMovies = async (query, page = 1) => {
    const data = await tmdbRequest('/search/movie', { query, page });

    return {
        results: data.results.map((movie) => ({
            id: movie.id,
            type: 'movie',
            title: movie.title,
            overview: movie.overview,
            posterUrl: getImageUrl(movie.poster_path),
            backdropUrl: getImageUrl(movie.backdrop_path, 'w780'),
            releaseDate: movie.release_date,
            rating: movie.vote_average,
            voteCount: movie.vote_count,
            popularity: movie.popularity,
            genreIds: movie.genre_ids,
        })),
        totalPages: data.total_pages,
        totalResults: data.total_results,
        currentPage: data.page,
    };
};

const getMovieDetails = async (movieId) => {
    const data = await tmdbRequest(`/movie/${movieId}`, {
        append_to_response: 'credits,videos,similar,recommendations',
    });

    const trailer = data.videos?.results?.find(
        (v) => v.type === 'Trailer' && v.site === 'YouTube'
    );

    return {
        id: data.id,
        type: 'movie',
        title: data.title,
        tagline: data.tagline,
        overview: data.overview,
        posterUrl: getImageUrl(data.poster_path, 'w780'),
        backdropUrl: getImageUrl(data.backdrop_path, 'original'),
        releaseDate: data.release_date,
        runtime: data.runtime,
        rating: data.vote_average,
        voteCount: data.vote_count,
        popularity: data.popularity,
        status: data.status,
        budget: data.budget,
        revenue: data.revenue,
        genres: data.genres,
        productionCompanies: data.production_companies?.map((c) => ({
            id: c.id,
            name: c.name,
            logoUrl: getImageUrl(c.logo_path, 'w200'),
        })),
        cast: data.credits?.cast?.slice(0, 15).map((c) => ({
            id: c.id,
            name: c.name,
            character: c.character,
            profileUrl: getImageUrl(c.profile_path, 'w185'),
        })),
        director: data.credits?.crew?.find((c) => c.job === 'Director')?.name,
        trailerUrl: trailer
            ? `https://www.youtube.com/watch?v=${trailer.key}`
            : null,
        similar: data.similar?.results?.slice(0, 6).map((m) => ({
            id: m.id,
            type: 'movie',
            title: m.title,
            posterUrl: getImageUrl(m.poster_path),
            rating: m.vote_average,
        })),
        recommendations: data.recommendations?.results?.slice(0, 6).map((m) => ({
            id: m.id,
            type: 'movie',
            title: m.title,
            posterUrl: getImageUrl(m.poster_path),
            rating: m.vote_average,
        })),
    };
};

const getPopularMovies = async (page = 1) => {
    const data = await tmdbRequest('/movie/popular', { page });

    return {
        results: data.results.map((movie) => ({
            id: movie.id,
            type: 'movie',
            title: movie.title,
            overview: movie.overview,
            posterUrl: getImageUrl(movie.poster_path),
            backdropUrl: getImageUrl(movie.backdrop_path, 'w780'),
            releaseDate: movie.release_date,
            rating: movie.vote_average,
            genreIds: movie.genre_ids,
        })),
        totalPages: data.total_pages,
        currentPage: data.page,
    };
};

const getTopRatedMovies = async (page = 1) => {
    const data = await tmdbRequest('/movie/top_rated', { page });

    return {
        results: data.results.map((movie) => ({
            id: movie.id,
            type: 'movie',
            title: movie.title,
            overview: movie.overview,
            posterUrl: getImageUrl(movie.poster_path),
            releaseDate: movie.release_date,
            rating: movie.vote_average,
        })),
        totalPages: data.total_pages,
        currentPage: data.page,
    };
};

// ============================================
// TV SHOWS
// ============================================

const searchTV = async (query, page = 1) => {
    const data = await tmdbRequest('/search/tv', { query, page });

    return {
        results: data.results.map((show) => ({
            id: show.id,
            type: 'tv',
            title: show.name,
            overview: show.overview,
            posterUrl: getImageUrl(show.poster_path),
            backdropUrl: getImageUrl(show.backdrop_path, 'w780'),
            firstAirDate: show.first_air_date,
            rating: show.vote_average,
            voteCount: show.vote_count,
            popularity: show.popularity,
            genreIds: show.genre_ids,
        })),
        totalPages: data.total_pages,
        totalResults: data.total_results,
        currentPage: data.page,
    };
};

const getTVDetails = async (tvId) => {
    const data = await tmdbRequest(`/tv/${tvId}`, {
        append_to_response: 'credits,videos,similar,recommendations',
    });

    const trailer = data.videos?.results?.find(
        (v) => v.type === 'Trailer' && v.site === 'YouTube'
    );

    return {
        id: data.id,
        type: 'tv',
        title: data.name,
        tagline: data.tagline,
        overview: data.overview,
        posterUrl: getImageUrl(data.poster_path, 'w780'),
        backdropUrl: getImageUrl(data.backdrop_path, 'original'),
        firstAirDate: data.first_air_date,
        lastAirDate: data.last_air_date,
        numberOfSeasons: data.number_of_seasons,
        numberOfEpisodes: data.number_of_episodes,
        episodeRunTime: data.episode_run_time?.[0],
        rating: data.vote_average,
        voteCount: data.vote_count,
        popularity: data.popularity,
        status: data.status,
        genres: data.genres,
        networks: data.networks?.map((n) => ({
            id: n.id,
            name: n.name,
            logoUrl: getImageUrl(n.logo_path, 'w200'),
        })),
        seasons: data.seasons?.map((s) => ({
            seasonNumber: s.season_number,
            name: s.name,
            episodeCount: s.episode_count,
            airDate: s.air_date,
            overview: s.overview,
            posterUrl: getImageUrl(s.poster_path),
        })),
        cast: data.credits?.cast?.slice(0, 15).map((c) => ({
            id: c.id,
            name: c.name,
            character: c.character,
            profileUrl: getImageUrl(c.profile_path, 'w185'),
        })),
        creators: data.created_by?.map((c) => c.name),
        trailerUrl: trailer
            ? `https://www.youtube.com/watch?v=${trailer.key}`
            : null,
        similar: data.similar?.results?.slice(0, 6).map((s) => ({
            id: s.id,
            type: 'tv',
            title: s.name,
            posterUrl: getImageUrl(s.poster_path),
            rating: s.vote_average,
        })),
        recommendations: data.recommendations?.results?.slice(0, 6).map((s) => ({
            id: s.id,
            type: 'tv',
            title: s.name,
            posterUrl: getImageUrl(s.poster_path),
            rating: s.vote_average,
        })),
    };
};

const getPopularTV = async (page = 1) => {
    const data = await tmdbRequest('/tv/popular', { page });

    return {
        results: data.results.map((show) => ({
            id: show.id,
            type: 'tv',
            title: show.name,
            overview: show.overview,
            posterUrl: getImageUrl(show.poster_path),
            firstAirDate: show.first_air_date,
            rating: show.vote_average,
            genreIds: show.genre_ids,
        })),
        totalPages: data.total_pages,
        currentPage: data.page,
    };
};

const getTopRatedTV = async (page = 1) => {
    const data = await tmdbRequest('/tv/top_rated', { page });

    return {
        results: data.results.map((show) => ({
            id: show.id,
            type: 'tv',
            title: show.name,
            overview: show.overview,
            posterUrl: getImageUrl(show.poster_path),
            firstAirDate: show.first_air_date,
            rating: show.vote_average,
        })),
        totalPages: data.total_pages,
        currentPage: data.page,
    };
};

// ============================================
// TRENDING
// ============================================

const getTrending = async (timeWindow = 'week', page = 1) => {
    const data = await tmdbRequest(`/trending/all/${timeWindow}`, { page });

    return {
        results: data.results.map((item) => ({
            id: item.id,
            type: item.media_type,
            title: item.title || item.name,
            overview: item.overview,
            posterUrl: getImageUrl(item.poster_path),
            backdropUrl: getImageUrl(item.backdrop_path, 'w780'),
            releaseDate: item.release_date || item.first_air_date,
            rating: item.vote_average,
            popularity: item.popularity,
        })),
        totalPages: data.total_pages,
        currentPage: data.page,
    };
};

// ============================================
// GENRES
// ============================================

const getMovieGenres = async () => {
    const data = await tmdbRequest('/genre/movie/list');
    return data.genres;
};

const getTVGenres = async () => {
    const data = await tmdbRequest('/genre/tv/list');
    return data.genres;
};

// ============================================
// DISCOVER
// ============================================

const discoverMoviesByGenre = async (genreId, page = 1) => {
    const data = await tmdbRequest('/discover/movie', {
        with_genres: genreId,
        sort_by: 'popularity.desc',
        page,
    });

    return {
        results: data.results.map((movie) => ({
            id: movie.id,
            type: 'movie',
            title: movie.title,
            overview: movie.overview,
            posterUrl: getImageUrl(movie.poster_path),
            releaseDate: movie.release_date,
            rating: movie.vote_average,
        })),
        totalPages: data.total_pages,
        currentPage: data.page,
    };
};

const discoverTVByGenre = async (genreId, page = 1) => {
    const data = await tmdbRequest('/discover/tv', {
        with_genres: genreId,
        sort_by: 'popularity.desc',
        page,
    });

    return {
        results: data.results.map((show) => ({
            id: show.id,
            type: 'tv',
            title: show.name,
            overview: show.overview,
            posterUrl: getImageUrl(show.poster_path),
            firstAirDate: show.first_air_date,
            rating: show.vote_average,
        })),
        totalPages: data.total_pages,
        currentPage: data.page,
    };
};

module.exports = {
    searchMovies,
    getMovieDetails,
    getPopularMovies,
    getTopRatedMovies,
    searchTV,
    getTVDetails,
    getPopularTV,
    getTopRatedTV,
    getTrending,
    getMovieGenres,
    getTVGenres,
    discoverMoviesByGenre,
    discoverTVByGenre,
};