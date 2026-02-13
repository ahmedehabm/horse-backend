// import { Server as SocketIOServer } from "socket.io";
// import { createServer } from "http";
// import { prisma } from "./prisma.js";
// import type { NextFunction, Request, Response } from "express";

import { prisma } from "./prisma.js";

// // ============================================================================
// // STANDALONE TEST - No dependencies on your app
// // ============================================================================

// interface FeederTestConfig {
//   thingName: string;
//   baseWeight: number;
//   variance: number;
// }

// const TEST_FEEDERS: FeederTestConfig[] = [
//   { thingName: "FEEDER-BELLA-001", baseWeight: 12.5, variance: 0.5 },
//   { thingName: "FEEDER-LUNA-007", baseWeight: 8.3, variance: 0.3 },
//   { thingName: "FEEDER-THUNDER-002", baseWeight: 15.7, variance: 0.8 },
// ];

// // Create minimal Socket.IO server for testing
// const httpServer = createServer();
// const io = new SocketIOServer(httpServer, {
//   cors: {
//     origin: ["http://localhost:5173", "http://localhost:3000"],
//     credentials: true,
//   },
// });

// /**
//  * Emit to room - standalone version
//  */
// function emitToRoom(room: string, event: string, payload: unknown): void {
//   io.to(room).emit(event, payload);
// }

// /**
//  * Generate random weight with slight variance
//  */
// function generateWeight(baseWeight: number, variance: number): string {
//   const fluctuation = (Math.random() - 0.5) * 2 * variance;
//   const weight = baseWeight + fluctuation;
//   return weight.toFixed(2);
// }

// /**
//  * Emit weight update for a single feeder
//  */
// function emitFeederWeight(thingName: string, weight: string): void {
//   const room = `feeder-weight:${thingName}`;

//   emitToRoom(room, "FEEDER_WEIGHT", {
//     type: "FEEDER_WEIGHT",
//     thingName,
//     weight,
//   });

//   console.log(`📡 Emitted weight to ${thingName}: ${weight} kg`);
// }

// /**
//  * Start continuous weight streaming simulation
//  */
// function startWeightSimulation(intervalMs: number = 1000): () => void {
//   console.log(`\n🔄 Starting weight simulation (every ${intervalMs}ms)...\n`);

//   const intervalId = setInterval(() => {
//     for (const feeder of TEST_FEEDERS) {
//       const weight = generateWeight(feeder.baseWeight, feeder.variance);
//       emitFeederWeight(feeder.thingName, weight);
//     }
//     console.log("---");
//   }, intervalMs);

//   return () => {
//     clearInterval(intervalId);
//     console.log("\n⏹️ Weight simulation stopped.\n");
//   };
// }

// // ============================================================================
// // SOCKET.IO CONNECTION HANDLING
// // ============================================================================

// io.on("connection", (socket) => {
//   console.log(`\n✅ Client connected: ${socket.id}`);

//   // Auto-join all test feeder rooms for testing
//   for (const feeder of TEST_FEEDERS) {
//     const room = `feeder-weight:${feeder.thingName}`;
//     socket.join(room);
//     console.log(`   Joined room: ${room}`);
//   }

//   socket.on("disconnect", (reason) => {
//     console.log(`❌ Client disconnected: ${socket.id} (${reason})`);
//   });
// });

// // ============================================================================
// // START SERVER AND SIMULATION
// // ============================================================================

// const PORT = 3000; // Different port to avoid conflict with main app

// httpServer.listen(PORT, () => {
//   console.log(`
// ╔════════════════════════════════════════════════════════════════╗
// ║           WEIGHT STREAM TEST SERVER                            ║
// ╠════════════════════════════════════════════════════════════════╣
// ║                                                                ║
// ║   Socket.IO server running on: http://localhost:${PORT}          ║
// ║                                                                ║
// ║   Test feeders:                                                ║
// ║     • FEEDER-BELLA-001   (base: 12.5 kg)                       ║
// ║     • FEEDER-LUNA-007    (base: 8.3 kg)                        ║
// ║     • FEEDER-THUNDER-002 (base: 15.7 kg)                       ║
// ║                                                                ║
// ║   Rooms:                                                       ║
// ║     • feeder-weight:FEEDER-BELLA-001                           ║
// ║     • feeder-weight:FEEDER-LUNA-007                            ║
// ║     • feeder-weight:FEEDER-THUNDER-002                         ║
// ║                                                                ║
// ╚════════════════════════════════════════════════════════════════╝
// `);

//   // Start simulation after server is ready
//   const stopSimulation = startWeightSimulation(1000);

//   // Stop after 60 seconds
//   setTimeout(() => {
//     stopSimulation();
//     console.log("\n👋 Test complete. Server still running for connections.\n");
//   }, 60000);
// });

// /**
//  * GET /horses/stats
//  * Get dashboard statistics for the authenticated user
//  */
// export async function getHorsesStats(
//   req: Request,
//   res: Response,
//   next: NextFunction,
// ) {
//   try {
//     const userId = req.user.id;

//     // Get pagination from query params (not params)
//     const page = parseInt(req.query.page as string) || 1;
//     const limit = parseInt(req.query.limit as string) || 10;

//     // 1) Active feedings for ALL horses owned by this user (batch)
//     const activeFeedings = await prisma.feeding.findMany({
//       where: {
//         status: { in: ["PENDING", "STARTED", "RUNNING"] },
//         horse: { ownerId: userId },
//       },
//       select: {
//         id: true,
//         status: true,
//         horseId: true,
//       },
//       orderBy: { createdAt: "desc" },
//       skip: (page - 1) * limit,
//       take: limit,
//     });

//     // 2) Active stream (only one per user)
//     const user = await prisma.user.findUnique({
//       where: { id: userId },
//       select: { activeStreamHorseId: true },
//     });

//     //this means that stream is started already
//     let activeStream: null | {
//       horseId: string;
//       status: "STARTED";
//     } = null;

//     if (user?.activeStreamHorseId) {
//       // Verify the horse belongs to this user + get camera
//       const horse = await prisma.horse.findFirst({
//         where: { id: user.activeStreamHorseId, ownerId: userId },
//       });

//       if (horse) {
//         activeStream = {
//           horseId: horse.id,
//           status: "STARTED",
//         };
//       } else {
//         // Token missing/invalid - clear active stream
//         await prisma.user.update({
//           where: { id: userId },
//           data: { activeStreamHorseId: null },
//         });
//         activeStream = null;
//       }
//     }

//     // 3) Send response
//     res.status(200).json({
//       status: "success",
//       data: {
//         activeFeedings: activeFeedings.map((f) => ({
//           horseId: f.horseId,
//           feedingId: f.id,
//           status: f.status,
//         })),
//         activeStream,
//       },
//     });
//   } catch (error) {
//     next(error);
//   }
// }

const device = await prisma.device.findUnique({
  where: {
    id: "9f94de15-4c9e-412a-9bd1-dae550161e02",
    feederType: "SCHEDULED",
  },
  select: {
    id: true,
    thingName: true,
    // scheduledAmountKg: true,
    horsesAsFeeder: {
      select: {
        id: true,
        name: true,
      },
    },
  },
});

console.log(device);
