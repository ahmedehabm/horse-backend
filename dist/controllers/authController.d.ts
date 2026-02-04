import { type NextFunction, type Request, type Response } from "express";
import type { ExtendedError, Socket } from "socket.io";
export declare const signup: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const login: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const updatePassword: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const logout: (req: Request, res: Response) => Promise<void>;
export declare const getMe: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const protect: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const restrictTo: (...roles: string[]) => (req: Request, res: Response, next: NextFunction) => void;
/**
 * Socket.IO authentication middleware
 * Compatible with the existing protect middleware logic
 *
 * Usage: io.use(protectWs);
 */
export declare const protectWs: (socket: Socket, next: (err?: ExtendedError) => void) => Promise<void>;
//# sourceMappingURL=authController.d.ts.map