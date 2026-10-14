const ApiResponse = require('../utils/apiResponse');

/**
 * Global Error Handling Middleware
 * Catches all unhandled errors and sends a clean response
 */
const errorHandler = (err, req, res, next) => {
    // Log the error in development
    if (process.env.NODE_ENV === 'development') {
        console.error('🔥 Error:', err.stack);
    }

    // Mongoose validation error
    if (err.name === 'ValidationError') {
        const messages = Object.values(err.errors).map((val) => val.message);
        return ApiResponse.error(res, 400, 'Validation Error', messages);
    }

    // Mongoose duplicate key error
    if (err.code === 11000) {
        const field = Object.keys(err.keyPattern)[0];
        return ApiResponse.error(res, 400, `${field} already exists`);
    }

    // Mongoose bad ObjectId
    if (err.name === 'CastError') {
        return ApiResponse.error(res, 400, 'Invalid ID format');
    }

    // JWT errors (we'll use these in Phase 2)
    if (err.name === 'JsonWebTokenError') {
        return ApiResponse.error(res, 401, 'Invalid token');
    }

    if (err.name === 'TokenExpiredError') {
        return ApiResponse.error(res, 401, 'Token expired');
    }

    // Default server error
    const statusCode = err.statusCode || 500;
    const message =
        process.env.NODE_ENV === 'development'
            ? err.message
            : 'Something went wrong on the server';

    return ApiResponse.error(res, statusCode, message);
};

module.exports = errorHandler;