// src/controllers/authController.ts
import {} from "express";
import AppError from "../utils/appError.js";
import * as authServices from "../services/authServices.js";
import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
export const signup = async (req, res, next) => {
    try {
        // Create new user (role forced to "user")
        const newUser = await authServices.signup({
            name: req.body.name,
            username: req.body.username,
            password: req.body.password,
        });
        // Auto-login with JWT ( if puclic )
        // authServices.createSendToken(newUser, 201, res);
        return res.status(201).json({
            status: "success",
            data: {
                user: {
                    id: newUser.id,
                    name: newUser.name,
                    username: newUser.username,
                    role: newUser.role,
                },
            },
        });
    }
    catch (error) {
        next(error);
    }
};
export const login = async (req, res, next) => {
    try {
        const { username, password } = req.body;
        // 1) Check user exists & password correct
        const user = await authServices.login(username, password);
        // 2) Send token
        authServices.createSendToken(user, 200, res);
    }
    catch (error) {
        next(error);
    }
};
export const updatePassword = async (req, res, next) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.user.id;
        await authServices.updatePassword(currentPassword, newPassword, userId);
        // Re-login user after password change
        authServices.createSendToken(req.user, 200, res);
    }
    catch (error) {
        next(error);
    }
};
export const logout = async (req, res) => {
    const token = req.cookies.jwt;
    // Add token to blacklist with expiry = token's remaining lifetime
    // await redis.setex(`blacklist:${token}`, tokenExpiryTime, 'true');
    res.cookie("jwt", "loggedout", {
        expires: new Date(Date.now() + 10 * 1000),
        httpOnly: true,
    });
    res.status(200).json({ status: "success" });
};
export const getMe = async (req, res, next) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: {
                id: true,
                name: true,
                username: true,
                role: true,
            },
        });
        res.status(200).json({
            status: "success",
            data: { user },
        });
    }
    catch (error) {
        next(error);
    }
};
export const protect = async (req, res, next) => {
    try {
        // 1) Get token from cookie
        let token;
        if (req.cookies.jwt) {
            token = req.cookies.jwt;
        }
        // Uncomment for Bearer token support later
        // else if (req.headers.authorization?.startsWith('Bearer')) {
        //   token = req.headers.authorization.split(' ')[1];
        // }
        if (!token) {
            return next(new AppError("You are not logged in! Please log in.", 401));
        }
        //2) Verfiaction token
        const decoded = await authServices.verifyToken(token);
        // 3) Check user still exists
        const user = await prisma.user.findUnique({
            where: { id: decoded.id },
        });
        if (!user) {
            return next(new AppError("The user no longer exists.", 401));
        }
        // 4) Check password changed after token issued
        if (authServices.changedPasswordAfter(user.passwordChangedAt, decoded.iat)) {
            return next(new AppError("Password was recently changed! Please log in again.", 401));
        }
        // Attach user to req
        req.user = user;
        next();
    }
    catch (error) {
        next(error);
    }
};
// Role restriction middleware factory
export const restrictTo = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return next(new AppError("You do not have permission to perform this action", 403));
        }
        next();
    };
};
// src/middleware/protectWs.ts
/**
 * Socket.IO authentication middleware
 * Compatible with the existing protect middleware logic
 *
 * Usage: io.use(protectWs);
 */
export const protectWs = async (socket, next) => {
    try {
        // 1) Get token from multiple sources
        let token;
        // Priority 1: Token from auth object (explicitly passed from client)
        if (socket.handshake.auth?.token) {
            token = socket.handshake.auth.token;
        }
        // Priority 2: Token from cookie header
        else if (socket.handshake.headers.cookie) {
            const cookies = socket.handshake.headers.cookie;
            const jwtMatch = cookies.match(/jwt=([^;]+)/);
            token = jwtMatch?.[1];
        }
        // Priority 3: Token from authorization header (Bearer token)
        else if (socket.handshake.headers.authorization?.startsWith("Bearer")) {
            token = socket.handshake.headers.authorization.split(" ")[1];
        }
        if (!token) {
            return next(new AppError("You are not logged in! Please log in.", 404));
        }
        // 2) Verification token
        const decoded = await authServices.verifyToken(token);
        // 3) Check user still exists
        const user = await prisma.user.findUnique({
            where: { id: decoded.id },
        });
        if (!user) {
            return next(new Error("The user no longer exists."));
        }
        // 4) Check password changed after token issued
        if (authServices.changedPasswordAfter(user.passwordChangedAt, decoded.iat)) {
            return next(new Error("Password was recently changed! Please log in again."));
        }
        // 5) Admin has no WebSocket features — reject connection
        if (user.role === "ADMIN") {
            return next(new AppError("Admin does not require WebSocket access", 403));
        }
        // ✅ Attach only needed fields to socket.data
        const socketUser = {
            id: user.id,
            name: user.name,
            username: user.username,
            role: user.role,
        };
        socket.data.user = socketUser;
        // ✅ Also attach to socket.request for compatibility
        socket.request.user = socketUser;
        next();
    }
    catch (error) {
        next(error);
    }
};
export const getAllUsers = async (req, res, next) => {
    try {
        const page = Math.max(parseInt(String(req.query.page ?? "1"), 10) || 1, 1);
        const limit = Math.max(parseInt(String(req.query.limit ?? "10"), 10) || 10, 1);
        const skip = (page - 1) * limit;
        const where = {
            role: Role.USER,
        };
        const [users, total] = await prisma.$transaction([
            prisma.user.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: "desc" },
                select: {
                    id: true,
                    name: true,
                    username: true,
                },
            }),
            prisma.user.count({ where }),
        ]);
        res.status(200).json({
            status: "success",
            results: users.length,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
            data: { users },
        });
    }
    catch (err) {
        next(err);
    }
};
//# sourceMappingURL=authController.js.map