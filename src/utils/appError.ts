// src/utils/AppError.ts

export default class AppError extends Error {
  public readonly statusCode: number;
  public status: "fail" | "error";
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);

    this.statusCode = statusCode;
    this.status = String(statusCode).startsWith("4") ? "fail" : "error";

    this.isOperational = true;

    // Hide internal stack trace frames
    Error.captureStackTrace(this, this.constructor);
  }
}
