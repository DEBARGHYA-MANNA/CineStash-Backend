const crypto = require('crypto');
const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const sendEmail = require('../services/emailService');
const ApiResponse = require('../utils/apiResponse');

// ============================================
// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
// ============================================
const register = async (req, res, next) => {
    try {
        const { name, email, password } = req.body;

        // --- Validation ---
        if (!name || !email || !password) {
            return ApiResponse.error(res, 400, 'Please provide name, email, and password');
        }

        if (password.length < 6) {
            return ApiResponse.error(res, 400, 'Password must be at least 6 characters');
        }

        // --- Check if user already exists ---
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return ApiResponse.error(res, 400, 'An account with this email already exists');
        }

        // --- Create user ---
        // --- Check referral code if provided ---
        const { referralCode } = req.body;
        let referredBy = null;

        if (referralCode) {
            const referrer = await User.findOne({
                referralCode: referralCode.toUpperCase(),
            });
            if (referrer) {
                referredBy = referrer._id;
                referrer.referralCount += 1;

                // Update tier
                if (referrer.referralCount >= 50) referrer.referralTier = 'diamond';
                else if (referrer.referralCount >= 25) referrer.referralTier = 'platinum';
                else if (referrer.referralCount >= 10) referrer.referralTier = 'gold';
                else if (referrer.referralCount >= 5) referrer.referralTier = 'silver';

                await referrer.save({ validateBeforeSave: false });
            }
        }

        // --- Create user ---
        const user = await User.create({
            name,
            email,
            password,
            referredBy,
        });

        // --- Generate JWT ---
        const token = generateToken(user._id);

        return ApiResponse.success(res, 201, 'Registration successful', {
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
            },
            token,
        });
    } catch (error) {
        next(error);
    }
};

// ============================================
// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
// ============================================
const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        // --- Validation ---
        if (!email || !password) {
            return ApiResponse.error(res, 400, 'Please provide email and password');
        }

        // --- Find user (include password field since it's hidden by default) ---
        const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

        if (!user) {
            return ApiResponse.error(res, 401, 'Invalid email or password');
        }

        // --- Compare password ---
        const isMatch = await user.matchPassword(password);

        if (!isMatch) {
            return ApiResponse.error(res, 401, 'Invalid email or password');
        }

        // --- Generate JWT ---
        const token = generateToken(user._id);

        return ApiResponse.success(res, 200, 'Login successful', {
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
            },
            token,
        });
    } catch (error) {
        next(error);
    }
};

// ============================================
// @desc    Get current logged-in user profile
// @route   GET /api/auth/me
// @access  Private (requires JWT)
// ============================================
const getMe = async (req, res, next) => {
    try {
        // req.user is set by the auth middleware
        const user = await User.findById(req.user.id);

        if (!user) {
            return ApiResponse.error(res, 404, 'User not found');
        }

        return ApiResponse.success(res, 200, 'User profile retrieved', {
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                createdAt: user.createdAt,
            },
        });
    } catch (error) {
        next(error);
    }
};

// ============================================
// @desc    Forgot password - send reset token
// @route   POST /api/auth/forgot-password
// @access  Public
// ============================================
const forgotPassword = async (req, res, next) => {
    try {
        const { email } = req.body;

        if (!email) {
            return ApiResponse.error(res, 400, 'Please provide your email address');
        }

        // --- Find user ---
        const user = await User.findOne({ email: email.toLowerCase() });

        if (!user) {
            // Don't reveal whether the email exists or not (security)
            return ApiResponse.success(
                res,
                200,
                'If an account with that email exists, a reset link has been sent'
            );
        }

        // --- Generate reset token ---
        const resetToken = user.generateResetPasswordToken();
        await user.save({ validateBeforeSave: false });

        // --- Build reset URL ---
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const resetUrl = `${frontendUrl}/auth/reset-password/${resetToken}`;

        // --- Build email HTML ---
        const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #1a1a2e; color: #f1f1f1; border-radius: 10px;">
        <h1 style="color: #f59e0b; text-align: center;">🎬 CineStash</h1>
        <h2 style="color: #f1f1f1;">Password Reset Request</h2>
        <p>Hi <strong>${user.name}</strong>,</p>
        <p>We received a request to reset your password. Click the button below to set a new password:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background-color: #f59e0b; color: #1a1a2e; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
            Reset Password
          </a>
        </div>
        <p style="color: #a0a0b0; font-size: 14px;">
          This link will expire in <strong>15 minutes</strong>.
        </p>
        <p style="color: #a0a0b0; font-size: 14px;">
          If you didn't request this, you can safely ignore this email.
        </p>
        <hr style="border-color: #16213e;" />
        <p style="color: #6b6b6b; font-size: 12px; text-align: center;">
          Or copy this link: <br/>
          <a href="${resetUrl}" style="color: #f59e0b;">${resetUrl}</a>
        </p>
      </div>
    `;

        // --- Send email (or log to console) ---
        try {
            await sendEmail({
                to: user.email,
                subject: '🎬 CineStash - Password Reset Request',
                html: emailHtml,
            });

            return ApiResponse.success(
                res,
                200,
                'If an account with that email exists, a reset link has been sent'
            );
        } catch (emailError) {
            // If email fails, clear the token so it can't be used
            user.resetPasswordToken = undefined;
            user.resetPasswordExpire = undefined;
            await user.save({ validateBeforeSave: false });

            return ApiResponse.error(res, 500, 'Failed to send reset email. Please try again.');
        }
    } catch (error) {
        next(error);
    }
};

// ============================================
// @desc    Reset password using token
// @route   PUT /api/auth/reset-password/:token
// @access  Public
// ============================================
const resetPassword = async (req, res, next) => {
    try {
        const { token } = req.params;
        const { password } = req.body;

        if (!password) {
            return ApiResponse.error(res, 400, 'Please provide a new password');
        }

        if (password.length < 6) {
            return ApiResponse.error(res, 400, 'Password must be at least 6 characters');
        }

        // --- Hash the incoming token to compare with DB ---
        const hashedToken = crypto
            .createHash('sha256')
            .update(token)
            .digest('hex');

        // --- Find user with matching token and non-expired ---
        const user = await User.findOne({
            resetPasswordToken: hashedToken,
            resetPasswordExpire: { $gt: Date.now() },
        });

        if (!user) {
            return ApiResponse.error(res, 400, 'Invalid or expired reset token');
        }

        // --- Set new password ---
        user.password = password;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;
        await user.save(); // Pre-save hook will hash the new password

        // --- Generate new JWT so user is auto-logged in ---
        const newToken = generateToken(user._id);

        return ApiResponse.success(res, 200, 'Password reset successful', {
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
            },
            token: newToken,
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    register,
    login,
    getMe,
    forgotPassword,
    resetPassword,
};