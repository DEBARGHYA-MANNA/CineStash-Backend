const mongoose = require('mongoose');

const groupVaultSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Group vault name is required'],
            trim: true,
            maxlength: [50, 'Name cannot exceed 50 characters'],
        },
        description: {
            type: String,
            default: '',
            maxlength: [200, 'Description cannot exceed 200 characters'],
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        members: [
            {
                user: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'User',
                },
                role: {
                    type: String,
                    enum: ['admin', 'member'],
                    default: 'member',
                },
                joinedAt: {
                    type: Date,
                    default: Date.now,
                },
            },
        ],
        // Group vault cover image (optional)
        coverImage: {
            type: String,
            default: null,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    {
        timestamps: true,
    }
);

// Index for fast member lookups
groupVaultSchema.index({ 'members.user': 1 });
groupVaultSchema.index({ createdBy: 1 });

const GroupVault = mongoose.model('GroupVault', groupVaultSchema);

module.exports = GroupVault;