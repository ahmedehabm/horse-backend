// src/utils/AppError.ts
export default class AppError extends Error {
    statusCode;
    status;
    isOperational;
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
        this.status = String(statusCode).startsWith("4") ? "fail" : "error";
        this.isOperational = true;
        // Hide internal stack trace frames
        Error.captureStackTrace(this, this.constructor);
    }
}
//# sourceMappingURL=appError.js.map