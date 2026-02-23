// src/app.js
import express from "express";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import cors from "cors";

// // Routes
import streamRoutes from "./routes/streamRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import horseRoutes from "./routes/horseRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import deviceRoutes from "./routes/deviceRoutes.js";

// WebSocket setup

//Authentication
import { protect } from "./controllers/authController.js";

// Error handling
import AppError from "./utils/appError.js";
import GlobalError from "./controllers/errorController.js";
import path from "path";

// Initialize Express app
const app = express();

// 1) GLOBAL MIDDLEWARES

// Security headers
app.use(helmet());

//temporary
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// CORS
// app.use(
//   cors({
//     origin: process.env.CLIENT_URL || "http://localhost:4173",
//     credentials: true,
//   }),
// );

app.use(
  cors({
    origin: (origin, callback) => {
      // allow requests with no origin (like Postman)
      if (!origin) return callback(null, true);
      callback(null, origin); // echo back the requesting origin
    },
    credentials: true, // allow cookies
  }),
);

// Development logging
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

// Rate limiting
// const limiter = rateLimit({
//   limit: 100,
//   windowMs: 60 * 60 * 1000,
//   message: "Too many requests from this IP, please try again in an hour",
// });
// app.use("/api", limiter);

// Body parser
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Cookie parser
app.use(cookieParser());

// 2) HTTP ROUTES

//PUBLIC ROUTES
app.use("/api/v1/auth", authRoutes);

//PROTECTED ROUTES
app.use(protect);

app.use("/stream", streamRoutes);
app.use("/api/v1/horses", horseRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/devices", deviceRoutes);

//no need right now
// app.use("/api/v1/feedings", feedingRoutes);

// 4) CATCH UNHANDLED ROUTES
app.all("/{*any}", (req, res, next) => {
  next(
    new AppError(
      `cant find the requeted route ${req.originalUrl} on the server`,
      404,
    ),
  );
});

// // 5) GLOBAL ERROR HANDLER
app.use(GlobalError);

export default app;
