// src/server.ts
import { config } from "dotenv";
import fs from "fs";

// 1. LOAD ENVIRONMENT VARIABLES FIRST
config({ path: "./config.env" });

// 2. UNCAUGHT EXCEPTIONS
process.on("uncaughtException", (err) => {
  console.log("💥 UNCAUGHT EXCEPTION! Shutting down...");
  console.log(err.name, err.message);
  process.exit(1);
});

import app, { prisma } from "./app.js";
import { initAwsIot } from "./iot/initAwsIot.js";
import { handleDeviceEvent } from "./iot/deviceEventHandler.js";
import { initWsClient } from "./ws/initWsClient.js";

const PORT = process.env.PORT || 3000;

// 3. ENSURE TEMP DIRECTORY EXISTS
if (!fs.existsSync("./temp")) {
  fs.mkdirSync("./temp");
}

// 4. DATABASE CONNECTION
async function connectDatabase() {
  try {
    await prisma.$connect();
    console.log("✅ Database connected successfully!");
  } catch (err: any) {
    console.error("❌ Database connection error:", err.message);
    process.exit(1);
  }
}

// 5. START SERVER
connectDatabase().then(() => {
  // ✅ Initialize Socket.IO with HTTP server
  const { httpServer, io } = initWsClient(app);

  // ✅ Listen on HTTP server (not app)
  const server = httpServer.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}...`);

    // Initialize AWS IoT MQTT connection
    // initAwsIot(handleDeviceEvent);
  });

  // 6. UNHANDLED REJECTIONS
  process.on("unhandledRejection", (err: any) => {
    console.log("💥 UNHANDLED REJECTION! Shutting down...");
    console.log(err.name, err.message);

    server.close(() => {
      prisma.$disconnect();
      process.exit(1);
    });
  });

  // 7. GRACEFUL SHUTDOWN
  process.on("SIGTERM", () => {
    console.log("👋 SIGTERM received. Shutting down gracefully...");
    server.close(() => {
      io.close(); // ✅ Close Socket.IO connections
      prisma.$disconnect();
      console.log("💤 Process terminated!");
    });
  });
});
