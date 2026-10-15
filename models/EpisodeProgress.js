const mongoose = require('mongoose');

const episodeProgressSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        seriesId: {
            type: String,
            required: [true, 'Series ID is required'],
        },
        seriesType: {
            type: String,
            required: true,
            enum: ['tv', 'anime'],
        },
        seasonNumber: {
            type: Number,
            required: [true, 'Season number is required'],
            min: 0,
        },
        episodeNumber: {
            type: Number,
            required: [true, 'Episode number is required'],
            min: 1,
        },
        watched: {
            type: Boolean,
            default: false,
        },
        watchedAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

// Compound index: Unique per user + series + season + episode
episodeProgressSchema.index(
    { user: 1, seriesId: 1, seriesType: 1, seasonNumber: 1, episodeNumber: 1 },
    { unique: true }
);

// Index for fast queries
episodeProgressSchema.index({ user: 1, seriesId: 1, seriesType: 1 });

const EpisodeProgress = mongoose.model('EpisodeProgress', episodeProgressSchema);

module.exports = EpisodeProgress;