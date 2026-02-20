import { startFeeding, startScheduledFeeding, } from "../services/deviceService.js";
import { prisma } from "./prisma.js";
async function testSerialization() {
    // Setup: Create valid test data
    const user = await prisma.user.create({
        data: { username: "test-user", password: "test" },
    });
    const device = await prisma.device.create({
        data: {
            deviceType: "FEEDER",
            feederType: "SCHEDULED",
            thingLabel: "test-feeder",
            thingName: "test-thing",
            location: "Test Barn",
        },
    });
    const horse = await prisma.horse.create({
        data: {
            name: "Test Horse",
            age: 5,
            breed: "Test",
            location: "Test",
            ownerId: user.id,
            feederId: device.id,
        },
    });
    console.log("Starting race condition test...\n");
    // Run both feeds at the same time
    const [result1, result2] = await Promise.allSettled([
        startFeeding(horse.id, 2.5, user.id),
        startScheduledFeeding(device.id, "morning"),
    ]);
    console.log("\n=== RESULTS ===");
    console.log("Manual Feed:", result1.status);
    console.log("Scheduled Feed:", result2.status);
    if (result1.status === "rejected") {
        console.log("Manual Error:", result1.reason.message);
    }
    if (result2.status === "rejected") {
        console.log("Scheduled Error:", result2.reason.message);
    }
    // Cleanup
    await prisma.activeFeeding.deleteMany({ where: { horseId: horse.id } });
    await prisma.feeding.deleteMany({ where: { horseId: horse.id } });
    await prisma.horse.delete({ where: { id: horse.id } });
    await prisma.device.delete({ where: { id: device.id } });
    await prisma.user.delete({ where: { id: user.id } });
}
testSerialization();
// ```
// **Expected output:**
// ```
// === RESULTS ===
// Manual Feed: fulfilled
// Scheduled Feed: rejected
// Scheduled Error: Feeding already in progress
//# sourceMappingURL=test.js.map