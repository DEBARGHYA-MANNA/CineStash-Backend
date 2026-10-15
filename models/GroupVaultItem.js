const mongoose = require('mongoose');

const groupVaultItemSchema = new mongoose.Schema(
    {
        groupVault: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'GroupVault',
            required: true,
        },
        contentId: {
            type: String,
            required: true,
        },
        contentType: {
            type: String,
            required: true,
            enum: ['movie', 'tv', 'anime', 'game', 'book'],
        },
        title: {
            type: String,
            required: true,
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
        // ============================================
        // WHO in the group has watched this?
        // This is the key feature: auto-sync watched status
        // ============================================
        watchedBy: [
            {
                user: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'User',
                },
                watchedAt: {
                    type: Date,
                    default: Date.now,
                },
                rating: {
                    type: Number,
                    min: 1,
                    max: 5,
                    default: null,
                },
            },
        ],
        // Who added this to the group vault?
        addedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        // Group notes (shared)
        groupNotes: {
            type: String,
            default: '',
            maxlength: [500, 'Notes cannot exceed 500 characters'],
        },
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

// Compound index: Unique content per group vault
groupVaultItemSchema.index(
    { groupVault: 1, contentId: 1, contentType: 1 },
    { unique: true }
);

// Index for fast watched-by queries
groupVaultItemSchema.index({ 'watchedBy.user': 1 });

const GroupVaultItem = mongoose.model('GroupVaultItem', groupVaultItemSchema);

module.exports = GroupVaultItem;