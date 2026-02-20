// src/lib/prisma.ts
import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
config({
    path: process.cwd() + "/config.env",
});
const globalForPrisma = globalThis;
export const prisma = globalForPrisma.prisma ??
    new PrismaClient({
        log: process.env.NODE_ENV === "development"
            ? ["query", "error", "warn"]
            : ["error"],
    });
if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = prisma;
}
// Graceful shutdown
const shutdown = async () => {
    console.log("🔌 Disconnecting Prisma...");
    await prisma.$disconnect();
    process.exit(0);
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
process.on("beforeExit", async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=prisma.js.map