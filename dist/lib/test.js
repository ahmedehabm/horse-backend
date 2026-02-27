// src/scripts/stressTestFeedings.ts
import { PrismaClient, FeedingStatus, DeviceType, FeederType, } from "@prisma/client";
import { startFeeding, startScheduledFeeding, } from "../services/deviceService.js";
import AppError from "../utils/appError.js";
import { initMockMqtt } from "./test-weight.js";
import { handleDeviceEvent } from "../iot/deviceEventHandler.js";
const prisma = new PrismaClient({
    log: ["error", "warn"],
});
async function cleanupTestData(userIds) {
    console.log("\n🧹 Cleaning up test data...");
    try {
        await prisma.activeFeeding.deleteMany({
            where: {
                horse: { ownerId: { in: userIds } },
            },
        });
        await prisma.feeding.deleteMany({
            where: {
                horse: { ownerId: { in: userIds } },
            },
        });
        await prisma.horse.deleteMany({
            where: { ownerId: { in: userIds } },
        });
        await prisma.device.deleteMany({
            where: { thingLabel: { startsWith: "stress-test-" } },
        });
        await prisma.user.deleteMany({
            where: { username: { startsWith: "stress-user-" } },
        });
        console.log("✅ Cleanup complete");
    }
    catch (err) {
        console.error("❌ Cleanup failed:", err);
    }
}
async function createTestData(count) {
    console.log(`\n📦 Creating ${count} test users, devices, and horses...`);
    const userIds = [];
    const horseIds = [];
    const deviceIds = [];
    const startTime = Date.now();
    // Create users
    for (let i = 0; i < count; i++) {
        const user = await prisma.user.create({
            data: {
                username: `stress-user-${i}`,
                password: "test123",
            },
            select: { id: true },
        });
        userIds.push(user.id);
    }
    console.log(`  ✓ Created ${count} users`);
    // Create devices
    for (let i = 0; i < count; i++) {
        const device = await prisma.device.create({
            data: {
                deviceType: DeviceType.FEEDER,
                feederType: FeederType.SCHEDULED,
                thingLabel: `stress-test-feeder-${i}`,
                thingName: `stress-thing-${i}`,
                location: "Test Barn",
                morningTime: "08:00",
                dayTime: "14:00",
                nightTime: "20:00",
                scheduledAmountKg: 2.0,
            },
            select: { id: true },
        });
        deviceIds.push(device.id);
    }
    console.log(`  ✓ Created ${count} devices`);
    // Create horses - EACH HORSE GETS A FEEDER
    for (let i = 0; i < count; i++) {
        const horse = await prisma.horse.create({
            data: {
                name: `Test Horse ${i}`,
                age: 5,
                breed: "Arabian",
                location: "Test Barn",
                ownerId: userIds[i] || null,
                feederId: deviceIds[i] || null,
            },
            select: { id: true },
        });
        horseIds.push(horse.id);
    }
    console.log(`  ✓ Created ${count} horses`);
    const elapsed = Date.now() - startTime;
    console.log(`  📊 Data creation took ${elapsed}ms`);
    return { userIds, horseIds, deviceIds };
}
async function runRaceConditionTest(horseIds, deviceIds, userIds) {
    const results = [];
    const count = horseIds.length;
    console.log(`\n🚀 Running RACE CONDITION test...`);
    console.log(`   Each horse will receive BOTH manual AND scheduled feeding`);
    console.log(`   Total: ${count * 2} concurrent operations (${count} horses × 2)`);
    const startTime = Date.now();
    // Create array of concurrent operations - SAME HORSE GETS BOTH
    const operations = [];
    for (let i = 0; i < count; i++) {
        // Manual feeding for horse i
        const manualPromise = (async () => {
            const opStart = Date.now();
            try {
                await startFeeding(horseIds[i], 2.0, userIds[i]);
                return {
                    type: "manual",
                    status: "fulfilled",
                    duration: Date.now() - opStart,
                };
            }
            catch (err) {
                const message = err instanceof AppError
                    ? err.message
                    : err instanceof Error
                        ? err.message
                        : "Unknown error";
                return {
                    type: "manual",
                    status: "rejected",
                    error: message,
                    duration: Date.now() - opStart,
                };
            }
        })();
        // Scheduled feeding for SAME horse i (different process but same horse)
        const scheduledPromise = (async () => {
            const opStart = Date.now();
            try {
                await startScheduledFeeding(deviceIds[i], "morning");
                return {
                    type: "scheduled",
                    status: "fulfilled",
                    duration: Date.now() - opStart,
                };
            }
            catch (err) {
                const message = err instanceof AppError
                    ? err.message
                    : err instanceof Error
                        ? err.message
                        : "Unknown error";
                return {
                    type: "scheduled",
                    status: "rejected",
                    error: message,
                    duration: Date.now() - opStart,
                };
            }
        })();
        operations.push(manualPromise, scheduledPromise);
    }
    // Wait for all to complete
    const settled = await Promise.allSettled(operations);
    // Extract results
    for (const result of settled) {
        if (result.status === "fulfilled") {
            results.push(result.value);
        }
        else {
            results.push({
                type: "manual",
                status: "rejected",
                error: "Promise rejected unexpectedly",
                duration: 0,
            });
        }
    }
    return results;
}
function analyzeResults(results) {
    console.log("\n📊 RESULTS ANALYSIS");
    console.log("=".repeat(50));
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    console.log(`\nTotal operations: ${results.length}`);
    console.log(`✅ Fulfilled: ${fulfilled.length}`);
    console.log(`❌ Rejected: ${rejected.length}`);
    // Analyze by type
    const manualFulfilled = fulfilled.filter((f) => f.type === "manual").length;
    const manualRejected = rejected.filter((f) => f.type === "manual").length;
    const scheduledFulfilled = fulfilled.filter((f) => f.type === "scheduled").length;
    const scheduledRejected = rejected.filter((f) => f.type === "scheduled").length;
    console.log(`\n📋 By Type:`);
    console.log(`  Manual:    ${manualFulfilled} ✅ | ${manualRejected} ❌`);
    console.log(`  Scheduled: ${scheduledFulfilled} ✅ | ${scheduledRejected} ❌`);
    // Check for race condition errors
    const raceConditionErrors = rejected.filter((r) => r.error?.includes("already in progress"));
    const otherErrors = rejected.filter((r) => !r.error?.includes("already in progress"));
    console.log(`\n🎯 Race Condition Handling:`);
    console.log(`  Correct rejections (already in progress): ${raceConditionErrors.length}`);
    console.log(`  Unexpected errors: ${otherErrors.length}`);
    if (otherErrors.length > 0) {
        console.log(`\n⚠️  Unexpected Errors:`);
        const errorTypes = new Map();
        for (const err of otherErrors) {
            const key = err.error || "unknown";
            errorTypes.set(key, (errorTypes.get(key) || 0) + 1);
        }
        errorTypes.forEach((count, error) => {
            console.log(`  - ${error}: ${count}`);
        });
    }
    // Performance metrics
    if (fulfilled.length > 0) {
        const durations = fulfilled.map((f) => f.duration);
        const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
        const min = Math.min(...durations);
        const max = Math.max(...durations);
        console.log(`\n⏱️  Performance:`);
        console.log(`  Average: ${avg.toFixed(2)}ms`);
        console.log(`  Min: ${min}ms`);
        console.log(`  Max: ${max}ms`);
    }
    // Validation
    console.log(`\n✅ TEST VALIDATION:`);
    const expected = fulfilled.length;
    if (rejected.length === expected) {
        console.log(`  ✅ Race conditions handled correctly!`);
        console.log(`  ✅ ${fulfilled.length} succeeded, ${rejected.length} rejected (as expected)`);
    }
    else if (rejected.length === 0) {
        console.log(`  ⚠️  NO REJECTIONS - Race condition may not be working!`);
        console.log(`  ⚠️  Check: unique constraint on horseId in ActiveFeeding`);
    }
    else {
        console.log(`  ❌ UNEXPECTED: ${rejected.length} rejections for ${fulfilled.length} successes`);
    }
    return { fulfilled: fulfilled.length, rejected: rejected.length };
}
async function verifyDatabaseState(horseIds) {
    console.log("\n🔍 Verifying Database State...");
    const activeFeedings = await prisma.activeFeeding.count({
        where: {
            horse: { id: { in: horseIds } },
        },
    });
    const feedings = await prisma.feeding.count({
        where: {
            horse: { id: { in: horseIds } },
        },
    });
    console.log(`  Active feedings in DB: ${activeFeedings}`);
    console.log(`  Total feeding records: ${feedings}`);
    return { activeFeedings, feedings };
}
async function main() {
    console.log("=".repeat(50));
    console.log("🚀 RACE CONDITION STRESS TEST");
    console.log("=".repeat(50));
    const COUNT = 1000;
    console.log(`\nTarget: ${COUNT} horses, each receiving 2 concurrent feedings`);
    console.log(`Total operations: ${COUNT * 2}`);
    let userIds = [];
    let horseIds = [];
    let deviceIds = [];
    try {
        // ✅ CRITICAL: Initialize mock MQTT before running tests
        console.log("\n🔌 Initializing Mock MQTT client...");
        initMockMqtt(handleDeviceEvent);
        console.log("✅ Mock MQTT initialized");
        // Step 1: Create test data
        const data = await createTestData(COUNT);
        userIds = data.userIds;
        horseIds = data.horseIds;
        deviceIds = data.deviceIds;
        // Step 2: Run race condition test
        const results = await runRaceConditionTest(horseIds, deviceIds, userIds);
        // Step 3: Analyze results
        const analysis = analyzeResults(results);
        // Step 4: Verify database state
        const dbState = await verifyDatabaseState(horseIds);
        // Step 5: Summary
        console.log("\n" + "=".repeat(50));
        console.log("📋 SUMMARY");
        console.log("=".repeat(50));
        console.log(`Test data: ${COUNT} horses with feeders`);
        console.log(`Total operations: ${COUNT * 2} (each horse gets 2 feedings)`);
        console.log(`Successful feedings: ${analysis.fulfilled}`);
        console.log(`Rejected (race condition): ${analysis.rejected}`);
        console.log(`Active feedings in DB: ${dbState.activeFeedings}`);
        console.log(`Total feeding records: ${dbState.feedings}`);
        if (analysis.rejected > 0 && analysis.fulfilled > 0) {
            console.log("\n✅ RACE CONDITION TEST PASSED");
        }
        else if (analysis.rejected === 0) {
            console.log("\n⚠️  TEST PASSED BUT NO RACE CONDITIONS DETECTED");
            console.log("   This might mean unique constraint isn't working");
        }
        else {
            console.log("\n❌ TEST FAILED");
        }
    }
    catch (err) {
        console.error("\n❌ Test failed with error:", err);
    }
    finally {
        await cleanupTestData(userIds);
        await prisma.$disconnect();
    }
}
main()
    .then(() => {
    console.log("\n✨ Test complete");
    process.exit(0);
})
    .catch((err) => {
    console.error("💥 Fatal error:", err);
    process.exit(1);
});
//# sourceMappingURL=test.js.map