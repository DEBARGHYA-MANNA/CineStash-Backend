const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ApiResponse = require('../utils/apiResponse');

/**
 * Protect routes - Verify JWT and attach user to request
 */
const protect = async (req, res, next) => {
  try {
    let token;

    // --- Extract token from Authorization header ---
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return ApiResponse.error(res, 401, 'Not authorized. No token provided.');
    }

    // --- Verify token ---
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // --- Find user by ID from token payload ---
    const user = await User.findById(decoded.id);

    if (!user) {
      return ApiResponse.error(res, 401, 'Not authorized. User no longer exists.');
    }

    // --- Attach user to request ---
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return ApiResponse.error(res, 401, 'Invalid token');
    }
    if (error.name === 'TokenExpiredError') {
      return ApiResponse.error(res, 401, 'Token has expired. Please login again.');
    }
    return ApiResponse.error(res, 401, 'Not authorized');
  }
};

module.exports = { protect };