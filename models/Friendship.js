const mongoose = require('mongoose');

const friendshipSchema = new mongoose.Schema(
    {
        requester: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        recipient: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        status: {
            type: String,
            enum: ['pending', 'accepted', 'rejected', 'blocked'],
            default: 'pending',
        },
    },
    {
        timestamps: true,
    }
);

// Compound index: Only one friendship record per pair
friendshipSchema.index(
    { requester: 1, recipient: 1 },
    { unique: true }
);

// Index for fast friend lookups
friendshipSchema.index({ requester: 1, status: 1 });
friendshipSchema.index({ recipient: 1, status: 1 });

const Friendship = mongoose.model('Friendship', friendshipSchema);

module.exports = Friendship;