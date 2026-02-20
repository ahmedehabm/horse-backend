// src/services/authServices.ts
import jwt from "jsonwebtoken";
import {} from "express";
import { promisify } from "util";
import bcrypt from "bcryptjs";
import AppError from "../utils/appError.js";
import { prisma } from "../lib/prisma.js";
export function signJWT(id) {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || "90d",
    });
}
export async function verifyToken(token) {
    return new Promise((resolve, reject) => {
        jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
            if (err)
                reject(err);
            else
                resolve(decoded);
        });
    });
}
/**
 * Send JWT token as cookie + response
 */
//to adjust
export function createSendToken(user, statusCode, res) {
    const token = signJWT(user.id);
    // Secure cookie options
    const cookieOptions = {
        expires: new Date(Date.now() +
            parseInt(process.env.JWT_COOKIE_EXPIRES_IN) * 24 * 60 * 60 * 1000),
        httpOnly: true,
        secure: false, //will change
        sameSite: "lax", //will change
    };
    res.cookie("jwt", token, cookieOptions);
    res.status(statusCode).json({
        status: "success",
        // token,
        data: {
            user: {
                id: user.id,
                name: user.name,
                username: user.username,
                role: user.role,
            },
        },
    });
}
/**
 * Signup - create new user
 */
export async function signup(userData) {
    // Check if email exists
    const existingUser = await prisma.user.findUnique({
        where: { username: userData.username },
    });
    if (existingUser) {
        throw new AppError("Username already exists", 400);
    }
    // Hash password
    const hashedPassword = await bcrypt.hash(userData.password, 12);
    // Create user (force role: "user")
    const newUser = await prisma.user.create({
        data: {
            name: userData.name,
            username: userData.username,
            password: hashedPassword,
            role: "USER",
        },
        select: {
            id: true,
            name: true,
            username: true,
            role: true,
        },
    });
    return newUser;
}
/**
 * Login - validate credentials
 */
export async function login(username, password) {
    // 1) Find user with password
    const user = await prisma.user.findUnique({
        where: { username },
        select: {
            id: true,
            name: true,
            username: true,
            role: true,
            password: true,
            passwordChangedAt: true,
        },
    });
    if (!user) {
        throw new AppError("Incorrect email or password", 401);
    }
    // 2) Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
        throw new AppError("Incorrect email or password", 401);
    }
    return user;
}
/**
 * Check if password changed after token issued
 */
export function changedPasswordAfter(passwordChangedAt, iat) {
    if (!passwordChangedAt)
        return false;
    const changedTimestamp = parseInt((passwordChangedAt.getTime() / 1000).toString(), 10);
    return changedTimestamp > iat;
}
/**
 * Update password (logged-in user)
 */
export async function updatePassword(currentPassword, newPassword, userId) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { password: true },
    });
    if (!user) {
        throw new AppError("User not found", 404);
    }
    // Check current password
    const isCorrect = await bcrypt.compare(currentPassword, user.password);
    if (!isCorrect) {
        throw new AppError("Your current password is wrong", 401);
    }
    // Update password
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
        where: { id: userId },
        data: {
            password: hashedPassword,
            passwordChangedAt: new Date(),
        },
    });
    return user;
}
// Reset token helpers
// export function generateResetToken(): string {
//   return crypto.randomBytes(32).toString("hex");
// }
// export async function hashToken(token: string): Promise<string> {
//   return crypto.createHash("sha256").update(token).digest("hex");
// }
// /**
//  * Forgot password - send reset token
//  */
// export async function forgotPassword(
//   email: string,
//   req: Request,
// ): Promise<void> {
//   // 1) Get user
//   const user = await prisma.user.findUnique({
//     where: { email },
//   });
//   if (!user) {
//     throw new AppError("No user found with that email", 404);
//   }
//   // 2) Generate random reset token
//   const resetToken = authServices.generateResetToken();
//   const hashedToken = await authServices.hashToken(resetToken);
//   // 3) Save to DB
//   await prisma.user.update({
//     where: { id: user.id },
//     data: {
//       passwordResetToken: hashedToken,
//       passwordResetExpires: new Date(Date.now() + 10 * 60 * 1000), // 10min
//     },
//   });
//   // 4) Send email
//   const resetURL = `${req.protocol}://${req.get("host")}/api/v1/auth/resetPassword/${resetToken}`;
//   await sendEmail({
//     email: user.email,
//     subject: "Your password reset token (valid for 10 min)",
//     message: `Forgot your password? Submit a PATCH request with your new password to: ${resetURL}`,
//   });
// }
// /**
//  * Reset password with token
//  */
// export async function resetPassword(
//   token: string,
//   password: string,
//   passwordConfirm: string,
// ) {
//   // 1) Hash token and find user
//   const hashedToken = await authServices.hashToken(token);
//   const user = await prisma.user.findFirst({
//     where: {
//       passwordResetToken: hashedToken,
//       passwordResetExpires: { gt: new Date() },
//     },
//   });
//   if (!user) {
//     throw new AppError("Token is invalid or has expired", 400);
//   }
//   // 2) Update password
//   const hashedPassword = await bcrypt.hash(password, 12);
//   await prisma.user.update({
//     where: { id: user.id },
//     data: {
//       password: hashedPassword,
//       passwordConfirm: hashedPassword,
//       passwordResetToken: null,
//       passwordResetExpires: null,
//       passwordChangedAt: new Date(),
//     },
//   });
//   return user;
// }
//# sourceMappingURL=authServices.js.map