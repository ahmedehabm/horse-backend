// src/controllers/authController.ts
import { type NextFunction, type Request, type Response } from "express";
import AppError from "../utils/appError.js";
import * as authServices from "../services/authServices.js";
import { prisma } from "../app.js";

export const signup = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    // Create new user (role forced to "user")
    const newUser = await authServices.signup({
      name: req.body.name,
      email: req.body.email,
      password: req.body.password,
      photo: req.body.photo,
    });

    // Auto-login with JWT
    authServices.createSendToken(newUser, 201, res);
  } catch (error) {
    next(error);
  }
};

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { email, password } = req.body;

    // 1) Check user exists & password correct
    const user = await authServices.login(email, password);

    // 2) Send token
    authServices.createSendToken(user, 200, res);
  } catch (error) {
    next(error);
  }
};

export const updatePassword = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user!.id;

    await authServices.updatePassword(currentPassword, newPassword, userId);

    // Re-login user after password change
    authServices.createSendToken(req.user!, 200, res);
  } catch (error) {
    next(error);
  }
};

export const logout = async (req: Request, res: Response) => {
  const token = req.cookies.jwt;

  // Add token to blacklist with expiry = token's remaining lifetime
  // await redis.setex(`blacklist:${token}`, tokenExpiryTime, 'true');

  res.cookie("jwt", "loggedout", {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });

  res.status(200).json({ status: "success" });
};

export const getMe = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });

    res.status(200).json({
      status: "success",
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};

export const protect = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
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
    if (
      authServices.changedPasswordAfter(user.passwordChangedAt, decoded.iat!)
    ) {
      return next(
        new AppError(
          "Password was recently changed! Please log in again.",
          401,
        ),
      );
    }

    // Attach user to req
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

// Role restriction middleware factory
export const restrictTo = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError("You do not have permission to perform this action", 403),
      );
    }
    next();
  };
};
