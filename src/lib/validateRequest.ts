// src/middleware/validateRequest.ts
import type { Request, Response, NextFunction } from "express";
import type { ZodObject } from "zod";
import AppError from "../utils/appError.js";

export const validateRequest = (schema: ZodObject) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (error: any) {
      console.log(error);
      if (error.name === "ZodError") {
        const messageRegex = /"message":\s*"([^"]+)"/g;
        const messages: string[] = [];
        let match: RegExpExecArray | null;

        while ((match = messageRegex.exec(error.message)) !== null) {
          messages.push(match[1]!);
        }

        // Join all messages
        const errorMessage = messages.join(", ");

        return next(new AppError(errorMessage, 400));
      }
    }
  };
};
