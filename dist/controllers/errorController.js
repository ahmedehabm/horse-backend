import AppError from "../utils/appError.js";
import { Prisma } from "@prisma/client";
//  Unique constraint violation (duplicate email, etc.)
const handleDuplicateFieldError = (err) => {
    const field = Object.values(err.meta)[1];
    const message = `Please use another value! (already assigned), Duplicate ${field} used.`;
    return new AppError(message, 409);
};
//  Record not found
const handleNotFoundError = (err) => {
    const message = "Record not found";
    return new AppError(message, 404);
};
// Record already exists (foreign key constraint)
const handleForeignKeyError = (err) => {
    const message = "This operation would violate a foreign key constraint";
    return new AppError(message, 400);
};
// ✅ P3018 = Unique constraint failed (MySQL-specific)
const handleUniqueConstraintError = (err) => {
    new AppError("Duplicate field value. Please use another value!", 409);
};
// JWT Errors
const handleJWTError = () => new AppError("Invalid token. Please log in again!", 401);
const handleJWTExpiredError = () => new AppError("Your token has expired! Please log in again.", 401);
// MQTT Errors (connection, etc.)
const handleMQTTError = (err) => {
    const message = err.message || "MQTT connection error";
    return new AppError(message, 503); // Service Unavailable
};
// Generic Prisma error
const handlePrismaError = (err) => {
    console.error("Prisma Error:", err);
    const message = "Database operation failed. Please try again.";
    return new AppError(message, 400);
};
const sendErrorDev = (err, res) => {
    res.status(err.statusCode).json({
        status: err.status,
        error: err,
        message: err.message,
        stack: err.stack,
    });
};
const sendErrorProd = (err, res) => {
    // Operational error (safe to send to client)
    if (err.isOperational || err instanceof AppError) {
        return res.status(err.statusCode).json({
            status: err.status,
            message: err.message,
        });
    }
    // Programming/unknown error (log, don't leak)
    console.error("💥 INTERNAL SERVER ERROR:", err);
    return res.status(500).json({
        status: "error",
        message: "Something went very wrong!",
    });
};
export default (err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    err.status = err.status || "error";
    // if (process.env.NODE_ENV === "development") {
    //   sendErrorDev(err, res);
    // } else if (process.env.NODE_ENV === "production") {
    let error = err;
    // ✅ CORRECT PRISMA CODES
    if (error.code === "P2002")
        error = handleDuplicateFieldError(error);
    if (error.code === "P2025")
        error = handleNotFoundError(error);
    if (error.code === "P2003")
        error = handleForeignKeyError(error);
    if (error.code === "P3018")
        error = handleUniqueConstraintError(error);
    // MQTT Errors
    if (error.name === "MQTTError" || error.message?.includes("MQTT")) {
        error = handleMQTTError(error);
    }
    // JWT errors
    if (error.name === "JsonWebTokenError")
        error = handleJWTError();
    if (error.name === "TokenExpiredError")
        error = handleJWTExpiredError();
    // Generic Prisma
    if (error.code?.startsWith("P"))
        error = handlePrismaError(error);
    sendErrorProd(error, res);
    // }
};
//# sourceMappingURL=errorController.js.map