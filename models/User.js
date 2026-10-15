const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { nanoid } = require('nanoid');

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Name is required'],
            trim: true,
            maxlength: [50, 'Name cannot exceed 50 characters'],
        },
        email: {
            type: String,
            required: [true, 'Email is required'],
            unique: true,
            lowercase: true,
            trim: true,
            match: [
                /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
                'Please provide a valid email',
            ],
        },
        password: {
            type: String,
            required: [true, 'Password is required'],
            minlength: [6, 'Password must be at least 6 characters'],
            select: false,
        },
        // ============================================
        // UNIQUE USER ID (Searchable, e.g., DEB-7X9K2)
        // ============================================
        uniqueId: {
            type: String,
            unique: true,
            uppercase: true,
        },
        // ============================================
        // REFERRAL SYSTEM (MLM)
        // ============================================
        referralCode: {
            type: String,
            unique: true,
        },
        referredBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
        referralCount: {
            type: Number,
            default: 0,
        },
        // Future: perks, tiers, rewards
        referralTier: {
            type: String,
            enum: ['bronze', 'silver', 'gold', 'platinum', 'diamond'],
            default: 'bronze',
        },
        // ============================================
        // PASSWORD RESET
        // ============================================
        resetPasswordToken: String,
        resetPasswordExpire: Date,
    },
    {
        timestamps: true,
    }
);

// ============================================
// PRE-SAVE HOOKS
// ============================================
userSchema.pre('save', async function (next) {
    // Hash password if modified
    if (this.isModified('password')) {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
    }

    // Generate unique user ID if new (e.g., DEB-7X9K2)
    if (this.isNew && !this.uniqueId) {
        const prefix = this.name
            .split(' ')[0]
            .substring(0, 3)
            .toUpperCase();
        const suffix = nanoid(5).toUpperCase();
        this.uniqueId = `${prefix}-${suffix}`;
    }

    // Generate referral code if new (e.g., CINE-AB3XZ)
    if (this.isNew && !this.referralCode) {
        this.referralCode = `CINE-${nanoid(5).toUpperCase()}`;
    }

    next();
});

// ============================================
// INSTANCE METHODS
// ============================================
userSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

userSchema.methods.generateResetPasswordToken = function () {
    const resetToken = crypto.randomBytes(32).toString('hex');

    this.resetPasswordToken = crypto
        .createHash('sha256')
        .update(resetToken)
        .digest('hex');

    this.resetPasswordExpire = Date.now() + 15 * 60 * 1000;

    return resetToken;
};

const User = mongoose.model('User', userSchema);

module.exports = User;