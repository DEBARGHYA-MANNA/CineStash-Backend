/**
 * Standardized API Response Helpers
 * Keeps all API responses consistent across the entire app
 */

class ApiResponse {
    /**
     * Send a success response
     * @param {Object} res - Express response object
     * @param {number} statusCode - HTTP status code
     * @param {string} message - Success message
     * @param {Object|Array} data - Response data
     */
    static success(res, statusCode = 200, message = 'Success', data = null) {
        const response = {
            success: true,
            message,
        };

        if (data !== null) {
            response.data = data;
        }

        return res.status(statusCode).json(response);
    }

    /**
     * Send an error response
     * @param {Object} res - Express response object
     * @param {number} statusCode - HTTP status code
     * @param {string} message - Error message
     * @param {Object} errors - Detailed error info (optional)
     */
    static error(res, statusCode = 500, message = 'Internal Server Error', errors = null) {
        const response = {
            success: false,
            message,
        };

        if (errors !== null) {
            response.errors = errors;
        }

        return res.status(statusCode).json(response);
    }

    /**
     * Send a paginated success response
     * @param {Object} res - Express response object
     * @param {string} message - Success message
     * @param {Array} data - Array of results
     * @param {Object} pagination - Pagination info { page, limit, total, totalPages }
     */
    static paginated(res, message = 'Success', data = [], pagination = {}) {
        return res.status(200).json({
            success: true,
            message,
            data,
            pagination,
        });
    }
}

module.exports = ApiResponse;