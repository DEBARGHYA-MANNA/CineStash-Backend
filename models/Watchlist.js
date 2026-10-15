const mongoose = require('mongoose');

const watchlistSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        contentId: {
            type: String,
            required: [true, 'Content ID is required'],
        },
        contentType: {
            type: String,
            required: [true, 'Content type is required'],
            enum: ['movie', 'tv', 'anime', 'game', 'book'],
        },
        title: {
            type: String,
            required: [true, 'Title is required'],
            trim: true,
        },
        posterUrl: {
            type: String,
            default: null,
        },
        overview: {
            type: String,
            default: '',
        },
        status: {
            type: String,
            required: true,
            enum: ['want_to_watch', 'currently_watching', 'watched', 'dropped'],
            default: 'want_to_watch',
        },
        rating: {
            type: Number,
            min: 1,
            max: 5,
            default: null,
        },
        notes: {
            type: String,
            default: '',
            maxlength: [500, 'Notes cannot exceed 500 characters'],
        },
        // Extra metadata (stored so we don't re-fetch from API every time)
        metadata: {
            releaseDate: String,
            genres: [String],
            runtime: Number,
            totalEpisodes: Number,
            totalSeasons: Number,
        },
    },
    {
        timestamps: true,
    }
);

// Compound index: A user can't save the same content twice
watchlistSchema.index({ user: 1, contentId: 1, contentType: 1 }, { unique: true });

// Index for fast filtering
watchlistSchema.index({ user: 1, status: 1 });
watchlistSchema.index({ user: 1, contentType: 1 });

const Watchlist = mongoose.model('Watchlist', watchlistSchema);

module.exports = Watchlist;