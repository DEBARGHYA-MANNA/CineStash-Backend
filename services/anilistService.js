const axios = require('axios');
const http = require('http');
const https = require('https');

const ANILIST_URL = 'https://graphql.anilist.co';

// ============================================
// AXIOS INSTANCE
// ============================================
const anilistClient = axios.create({
    baseURL: ANILIST_URL,
    method: 'POST',
    timeout: 15000,
    httpAgent: new http.Agent({ family: 4 }),
    httpsAgent: new https.Agent({ family: 4 }),
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    },
});

// Response interceptor
anilistClient.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response) {
            console.error(`❌ AniList API Error [${error.response.status}]:`, error.response.data?.errors);
        } else if (error.code === 'ECONNABORTED') {
            console.error('❌ AniList request timed out');
        } else {
            console.error('❌ AniList Network Error:', error.message);
        }
        return Promise.reject(error);
    }
);

/**
 * Helper: Make a GraphQL request to AniList
 * @param {string} query - GraphQL query string
 * @param {Object} variables - Query variables
 * @returns {Promise<Object>} Parsed data object
 */
const anilistRequest = async (query, variables = {}) => {
    try {
        const response = await anilistClient.post('', { query, variables });

        if (response.data.errors) {
            throw new Error(response.data.errors[0].message);
        }

        return response.data.data;
    } catch (error) {
        if (error.code === 'ENOTFOUND' || error.code === 'EAI_AGAIN') {
            throw new Error('Cannot reach AniList servers. Check your internet connection.');
        }
        if (error.code === 'ECONNABORTED') {
            throw new Error('AniList request timed out. Please try again.');
        }
        throw new Error(error.message || 'Failed to connect to AniList API');
    }
};

/**
 * Helper: Clean HTML tags from AniList descriptions
 */
const cleanDescription = (html) => {
    if (!html) return '';
    return html
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/?[^>]+(>|$)/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#039;/g, "'")
        .replace(/&quot;/g, '"')
        .trim();
};

/**
 * Helper: Map AniList status to readable format
 */
const mapStatus = (status) => {
    const statusMap = {
        FINISHED: 'Finished Airing',
        RELEASING: 'Currently Airing',
        NOT_YET_RELEASED: 'Not Yet Aired',
        CANCELLED: 'Cancelled',
        HIATUS: 'On Hiatus',
    };
    return statusMap[status] || status;
};

/**
 * Helper: Map AniList format to readable format
 */
const mapFormat = (format) => {
    const formatMap = {
        TV: 'TV',
        TV_SHORT: 'TV Short',
        MOVIE: 'Movie',
        SPECIAL: 'Special',
        OVA: 'OVA',
        ONA: 'ONA',
        MUSIC: 'Music',
    };
    return formatMap[format] || format;
};

// ============================================
// SEARCH ANIME
// ============================================

const searchAnime = async (query, page = 1, filters = {}) => {
    const graphqlQuery = `
    query ($search: String, $page: Int, $perPage: Int, $format: MediaFormat, $status: MediaStatus, $genre: String, $sort: [MediaSort]) {
      Page(page: $page, perPage: $perPage) {
        pageInfo {
          total
          currentPage
          lastPage
          hasNextPage
        }
        media(search: $search, type: ANIME, format: $format, status: $status, genre: $genre, sort: $sort) {
          id
          idMal
          title {
            romaji
            english
            native
          }
          description(asHtml: false)
          episodes
          status
          format
          averageScore
          meanScore
          popularity
          favourites
          trending
          season
          seasonYear
          startDate {
            year
            month
            day
          }
          endDate {
            year
            month
            day
          }
          genres
          coverImage {
            large
            medium
            color
          }
          bannerImage
          studios(isMain: true) {
            nodes {
              name
            }
          }
          source
          duration
          trailer {
            id
            site
          }
        }
      }
    }
  `;

    const variables = {
        search: query,
        page,
        perPage: 25,
    };

    // Add filters
    if (filters.format) variables.format = filters.format;
    if (filters.status) variables.status = filters.status;
    if (filters.genre) variables.genre = filters.genre;
    if (filters.sort) variables.sort = [filters.sort];

    const data = await anilistRequest(graphqlQuery, variables);
    const pageData = data.Page;

    return {
        results: pageData.media.map((anime) => ({
            id: anime.id,
            malId: anime.idMal,
            type: 'anime',
            title: anime.title.english || anime.title.romaji,
            titleRomaji: anime.title.romaji,
            titleNative: anime.title.native,
            overview: cleanDescription(anime.description),
            posterUrl: anime.coverImage?.large || anime.coverImage?.medium,
            bannerUrl: anime.bannerImage,
            episodes: anime.episodes,
            status: mapStatus(anime.status),
            format: mapFormat(anime.format),
            rating: anime.averageScore ? anime.averageScore / 10 : null,
            meanScore: anime.meanScore ? anime.meanScore / 10 : null,
            popularity: anime.popularity,
            favorites: anime.favourites,
            trending: anime.trending,
            season: anime.season,
            year: anime.seasonYear,
            genres: anime.genres,
            studios: anime.studios?.nodes?.map((s) => s.name) || [],
            source: anime.source,
            duration: anime.duration,
            trailerUrl: anime.trailer?.site === 'youtube'
                ? `https://www.youtube.com/watch?v=${anime.trailer.id}`
                : null,
        })),
        pagination: {
            currentPage: pageData.pageInfo.currentPage,
            totalPages: pageData.pageInfo.lastPage,
            totalItems: pageData.pageInfo.total,
            hasNextPage: pageData.pageInfo.hasNextPage,
        },
    };
};

// ============================================
// GET ANIME DETAILS
// ============================================

const getAnimeDetails = async (animeId) => {
    const graphqlQuery = `
    query ($id: Int) {
      Media(id: $id, type: ANIME) {
        id
        idMal
        title {
          romaji
          english
          native
          userPreferred
        }
        description(asHtml: false)
        episodes
        status
        format
        averageScore
        meanScore
        popularity
        favourites
        trending
        season
        seasonYear
        startDate {
          year
          month
          day
        }
        endDate {
          year
          month
          day
        }
        genres
        tags {
          name
          rank
          isMediaSpoiler
        }
        coverImage {
          extraLarge
          large
          medium
          color
        }
        bannerImage
        studios(isMain: false) {
          nodes {
            id
            name
            isAnimationStudio
          }
        }
        source
        duration
        countryOfOrigin
        isAdult
        trailer {
          id
          site
          thumbnail
        }
        relations {
          edges {
            relationType
            node {
              id
              title {
                romaji
                english
              }
              type
              format
              coverImage {
                medium
              }
            }
          }
        }
        characters(sort: ROLE, perPage: 15) {
          edges {
            role
            node {
              id
              name {
                full
                native
              }
              image {
                medium
              }
            }
          }
        }
        recommendations(perPage: 10, sort: RATING_DESC) {
          nodes {
            mediaRecommendation {
              id
              title {
                romaji
                english
              }
              coverImage {
                large
              }
              averageScore
            }
          }
        }
        externalLinks {
          site
          url
          type
        }
        streamingEpisodes {
          title
          url
          site
          thumbnail
        }
        nextAiringEpisode {
          airingAt
          timeUntilAiring
          episode
        }
      }
    }
  `;

    const data = await anilistRequest(graphqlQuery, { id: parseInt(animeId) });
    const anime = data.Media;

    if (!anime) {
        throw new Error('Anime not found');
    }

    return {
        id: anime.id,
        malId: anime.idMal,
        type: 'anime',
        title: anime.title.english || anime.title.romaji,
        titleRomaji: anime.title.romaji,
        titleNative: anime.title.native,
        overview: cleanDescription(anime.description),
        posterUrl: anime.coverImage?.extraLarge || anime.coverImage?.large,
        bannerUrl: anime.bannerImage,
        color: anime.coverImage?.color,
        episodes: anime.episodes,
        status: mapStatus(anime.status),
        format: mapFormat(anime.format),
        rating: anime.averageScore ? anime.averageScore / 10 : null,
        meanScore: anime.meanScore ? anime.meanScore / 10 : null,
        popularity: anime.popularity,
        favorites: anime.favourites,
        trending: anime.trending,
        season: anime.season,
        year: anime.seasonYear,
        startDate: anime.startDate,
        endDate: anime.endDate,
        genres: anime.genres,
        tags: anime.tags
            ?.filter((t) => !t.isMediaSpoiler)
            .slice(0, 15)
            .map((t) => ({ name: t.name, rank: t.rank })) || [],
        studios: anime.studios?.nodes?.map((s) => ({
            id: s.id,
            name: s.name,
            isMain: s.isAnimationStudio,
        })) || [],
        source: anime.source,
        duration: anime.duration,
        countryOfOrigin: anime.countryOfOrigin,
        isAdult: anime.isAdult,
        trailerUrl: anime.trailer?.site === 'youtube'
            ? `https://www.youtube.com/watch?v=${anime.trailer.id}`
            : null,
        nextAiringEpisode: anime.nextAiringEpisode
            ? {
                episode: anime.nextAiringEpisode.episode,
                airingAt: new Date(anime.nextAiringEpisode.airingAt * 1000).toISOString(),
            }
            : null,
        characters: anime.characters?.edges?.map((c) => ({
            id: c.node.id,
            name: c.node.name.full,
            nameNative: c.node.name.native,
            role: c.role,
            imageUrl: c.node.image?.medium,
        })) || [],
        relations: anime.relations?.edges?.map((r) => ({
            relationType: r.relationType,
            id: r.node.id,
            title: r.node.title.english || r.node.title.romaji,
            type: r.node.type,
            format: mapFormat(r.node.format),
            posterUrl: r.node.coverImage?.medium,
        })) || [],
        recommendations: anime.recommendations?.nodes
            ?.filter((r) => r.mediaRecommendation)
            .map((r) => ({
                id: r.mediaRecommendation.id,
                type: 'anime',
                title: r.mediaRecommendation.title.english || r.mediaRecommendation.title.romaji,
                posterUrl: r.mediaRecommendation.coverImage?.large,
                rating: r.mediaRecommendation.averageScore
                    ? r.mediaRecommendation.averageScore / 10
                    : null,
            })) || [],
        externalLinks: anime.externalLinks?.map((l) => ({
            site: l.site,
            url: l.url,
            type: l.type,
        })) || [],
        streamingEpisodes: anime.streamingEpisodes?.map((e) => ({
            title: e.title,
            url: e.url,
            site: e.site,
            thumbnail: e.thumbnail,
        })) || [],
    };
};

// ============================================
// BROWSE ANIME (Top, Popular, Trending, Seasonal)
// ============================================

const browseAnime = async (page = 1, sort = 'SCORE_DESC', filters = {}) => {
    const graphqlQuery = `
    query ($page: Int, $perPage: Int, $sort: [MediaSort], $season: MediaSeason, $seasonYear: Int, $format: MediaFormat, $status: MediaStatus) {
      Page(page: $page, perPage: $perPage) {
        pageInfo {
          total
          currentPage
          lastPage
          hasNextPage
        }
        media(type: ANIME, sort: $sort, season: $season, seasonYear: $seasonYear, format: $format, status: $status) {
          id
          idMal
          title {
            romaji
            english
          }
          description(asHtml: false)
          episodes
          status
          format
          averageScore
          popularity
          favourites
          trending
          season
          seasonYear
          genres
          coverImage {
            large
            medium
          }
          bannerImage
          studios(isMain: true) {
            nodes {
              name
            }
          }
        }
      }
    }
  `;

    const variables = {
        page,
        perPage: 25,
        sort: [sort],
    };

    if (filters.season) variables.season = filters.season;
    if (filters.seasonYear) variables.seasonYear = filters.seasonYear;
    if (filters.format) variables.format = filters.format;
    if (filters.status) variables.status = filters.status;

    const data = await anilistRequest(graphqlQuery, variables);
    const pageData = data.Page;

    return {
        results: pageData.media.map((anime) => ({
            id: anime.id,
            malId: anime.idMal,
            type: 'anime',
            title: anime.title.english || anime.title.romaji,
            titleRomaji: anime.title.romaji,
            overview: cleanDescription(anime.description)?.substring(0, 200) + '...',
            posterUrl: anime.coverImage?.large || anime.coverImage?.medium,
            bannerUrl: anime.bannerImage,
            episodes: anime.episodes,
            status: mapStatus(anime.status),
            format: mapFormat(anime.format),
            rating: anime.averageScore ? anime.averageScore / 10 : null,
            popularity: anime.popularity,
            favorites: anime.favourites,
            season: anime.season,
            year: anime.seasonYear,
            genres: anime.genres,
            studios: anime.studios?.nodes?.map((s) => s.name) || [],
        })),
        pagination: {
            currentPage: pageData.pageInfo.currentPage,
            totalPages: pageData.pageInfo.lastPage,
            totalItems: pageData.pageInfo.total,
            hasNextPage: pageData.pageInfo.hasNextPage,
        },
    };
};

// ============================================
// CONVENIENCE WRAPPERS
// ============================================

const getTopAnime = async (page = 1) => {
    return browseAnime(page, 'SCORE_DESC');
};

const getPopularAnime = async (page = 1) => {
    return browseAnime(page, 'POPULARITY_DESC');
};

const getTrendingAnime = async (page = 1) => {
    return browseAnime(page, 'TRENDING_DESC');
};

const getSeasonalAnime = async (page = 1) => {
    // Get current season and year
    const now = new Date();
    const month = now.getMonth();
    let season, year = now.getFullYear();

    if (month >= 0 && month <= 2) season = 'WINTER';
    else if (month >= 3 && month <= 5) season = 'SPRING';
    else if (month >= 6 && month <= 8) season = 'SUMMER';
    else season = 'FALL';

    return browseAnime(page, 'POPULARITY_DESC', { season, seasonYear: year });
};

const getUpcomingAnime = async (page = 1) => {
    return browseAnime(page, 'POPULARITY_DESC', { status: 'NOT_YET_RELEASED' });
};

// ============================================
// ANIME GENRES
// ============================================

const getAnimeGenres = async () => {
    // AniList doesn't have a genres endpoint, so we return the known list
    return [
        'Action', 'Adventure', 'Comedy', 'Drama', 'Ecchi',
        'Fantasy', 'Horror', 'Mahou Shoujo', 'Mecha', 'Music',
        'Mystery', 'Psychological', 'Romance', 'Sci-Fi', 'Slice of Life',
        'Sports', 'Supernatural', 'Thriller',
    ].map((name, index) => ({ id: index + 1, name }));
};

// ============================================
// ANIME RECOMMENDATIONS
// ============================================

const getAnimeRecommendations = async (animeId) => {
    const graphqlQuery = `
    query ($id: Int) {
      Media(id: $id, type: ANIME) {
        recommendations(perPage: 10, sort: RATING_DESC) {
          nodes {
            mediaRecommendation {
              id
              title {
                romaji
                english
              }
              coverImage {
                large
              }
              averageScore
              genres
            }
          }
        }
      }
    }
  `;

    const data = await anilistRequest(graphqlQuery, { id: parseInt(animeId) });

    if (!data.Media) {
        throw new Error('Anime not found');
    }

    return data.Media.recommendations?.nodes
        ?.filter((r) => r.mediaRecommendation)
        .map((r) => ({
            id: r.mediaRecommendation.id,
            type: 'anime',
            title: r.mediaRecommendation.title.english || r.mediaRecommendation.title.romaji,
            posterUrl: r.mediaRecommendation.coverImage?.large,
            rating: r.mediaRecommendation.averageScore
                ? r.mediaRecommendation.averageScore / 10
                : null,
            genres: r.mediaRecommendation.genres,
        })) || [];
};

module.exports = {
    searchAnime,
    getAnimeDetails,
    getTopAnime,
    getPopularAnime,
    getTrendingAnime,
    getSeasonalAnime,
    getUpcomingAnime,
    getAnimeGenres,
    getAnimeRecommendations,
};