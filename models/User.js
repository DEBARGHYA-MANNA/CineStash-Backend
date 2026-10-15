const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

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
            select: false, // Never return password in queries by default
        },
        resetPasswordToken: String,
        resetPasswordExpire: Date,
    },
    {
        timestamps: true, // Adds createdAt and updatedAt automatically
    }
);

// ============================================
// PRE-SAVE HOOK: Hash password before saving
// ============================================
userSchema.pre('save', async function (next) {
    // Only hash if the password field was actually modified
    if (!this.isModified('password')) {
        return next();
    }

    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// ============================================
// INSTANCE METHOD: Compare entered password with hashed
// ============================================
userSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

// ============================================
// INSTANCE METHOD: Generate password reset token
// ============================================
userSchema.methods.generateResetPasswordToken = function () {
    // Generate a random token (32 bytes, hex string)
    const resetToken = crypto.randomBytes(32).toString('hex');

    // Hash the token and store the HASH in the database
    // (we never store the raw token — security best practice)
    this.resetPasswordToken = crypto
        .createHash('sha256')
        .update(resetToken)
        .digest('hex');

    // Token expires in 15 minutes
    this.resetPasswordExpire = Date.now() + 15 * 60 * 1000;

    // Return the RAW token (this is what gets sent to the user via email)
    return resetToken;
};

const User = mongoose.model('User', userSchema);

module.exports = User;