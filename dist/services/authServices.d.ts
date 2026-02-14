import { type Response } from "express";
interface JWTPayload {
    id: string;
    iat?: number;
    exp?: number;
}
export declare function signJWT(id: string): string;
export declare function verifyToken(token: string): Promise<JWTPayload>;
/**
 * Send JWT token as cookie + response
 */
export declare function createSendToken(user: any, statusCode: number, res: Response): void;
/**
 * Signup - create new user
 */
export declare function signup(userData: {
    name: string;
    username: string;
    password: string;
}): Promise<{
    name: string | null;
    id: string;
    username: string;
    role: import("@prisma/client").$Enums.Role;
}>;
/**
 * Login - validate credentials
 */
export declare function login(username: string, password: string): Promise<{
    name: string | null;
    id: string;
    username: string;
    password: string;
    passwordChangedAt: Date | null;
    role: import("@prisma/client").$Enums.Role;
}>;
/**
 * Check if password changed after token issued
 */
export declare function changedPasswordAfter(passwordChangedAt: Date | null, iat: number): boolean;
/**
 * Update password (logged-in user)
 */
export declare function updatePassword(currentPassword: string, newPassword: string, userId: string): Promise<{
    password: string;
}>;
export {};
//# sourceMappingURL=authServices.d.ts.map