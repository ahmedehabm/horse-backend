// src/controllers/errorController.ts
import type { NextFunction, Request, Response } from "express";
import AppError from "../utils/appError.js";
import { Prisma } from "@prisma/client";

//  Unique constraint violation (duplicate email, etc.)
const handleDuplicateFieldError = (
  err: Prisma.PrismaClientKnownRequestError,
) => {
  const field = Object.values(err.meta as any)[1];
  const message = `Please use another value! (already assigned), Duplicate ${field} used.`;
  return new AppError(message, 409);
};

//  Record not found
const handleNotFoundError = (err: Prisma.PrismaClientKnownRequestError) => {
  const message = "Record not found";
  return new AppError(message, 404);
};

// Record already exists (foreign key constraint)
const handleForeignKeyError = (err: Prisma.PrismaClientKnownRequestError) => {
  const message = "This operation would violate a foreign key constraint";
  return new AppError(message, 400);
};

// ✅ P3018 = Unique constraint failed (MySQL-specific)
const handleUniqueConstraintError = (
  err: Prisma.PrismaClientKnownRequestError,
) => new AppError("Duplicate field value. Please use another value!", 409);

// JWT Errors
const handleJWTError = () =>
  new AppError("Invalid token. Please log in again!", 401);

const handleJWTExpiredError = () =>
  new AppError("Your token has expired! Please log in again.", 401);

// MQTT Errors (connection, etc.)
const handleMQTTError = (err: any) => {
  const message = err.message || "MQTT connection error";
  return new AppError(message, 503);
};

// Generic Prisma error
const handlePrismaError = (err: any) => {
  console.error("Prisma Error:", err);
  const message = "Database operation failed. Please try again.";
  return new AppError(message, 400);
};

const sendErrorDev = (err: any, res: Response) => {
  res.status(err.statusCode).json({
    status: err.status,
    error: err,
    message: err.message,
    stack: err.stack,
  });
};

const sendErrorProd = (err: AppError | any, res: Response) => {
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

export default (err: any, req: Request, res: Response, next: NextFunction) => {
  err.statusCode ||= 500;
  err.status ||= "error";

  // Transform errors FIRST, then decide how to send
  let error = err;

  if (error?.code === "P2002") error = handleDuplicateFieldError(error);
  if (error?.code === "P2025") error = handleNotFoundError(error);
  if (error?.code === "P2003") error = handleForeignKeyError(error);
  if (error?.code === "P3018") error = handleUniqueConstraintError(error);

  if (error?.name === "JsonWebTokenError") error = handleJWTError();
  if (error?.name === "TokenExpiredError") error = handleJWTExpiredError();

  // Only catch unhandled Prisma errors
  if (error?.code?.startsWith?.("P") && !(error instanceof AppError)) {
    error = handlePrismaError(error);
  }

  const env = process.env.NODE_ENV;

  if (env === "development") {
    return sendErrorDev(error, res);
  }

  return sendErrorProd(error, res);
};
