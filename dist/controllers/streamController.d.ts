import type { Request, Response, NextFunction } from "express";
/**
 * Middleware 1: Validate stream token exists and is valid
 */
export declare const validateStreamToken: (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * Middleware 2: Verify user owns the horse and has active stream
 */
export declare const verifyActiveStream: (req: Request, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=streamController.d.ts.map