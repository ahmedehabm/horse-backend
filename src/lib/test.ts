// test-realistic-queries.ts

import { prisma } from "./prisma.js";

async function testRealisticQueries() {
  // Create minimal test data
  const user = await prisma.user.create({
    data: {
      username: `test-${new Date().getMilliseconds()}`,
      password: "hashed",
    },
  });

  const device = await prisma.device.create({
    data: {
      deviceType: "FEEDER",
      feederType: "MANUAL",
      thingLabel: `feeder-${new Date().getMilliseconds()}`,
      thingName: `thing-${new Date().getMilliseconds()}`,
      location: "Test",
    },
  });

  const horses = await Promise.all(
    Array.from({ length: 100 }, (_, i) =>
      prisma.horse.create({
        data: {
          name: `Horse ${i}`,
          age: 5,
          breed: "Test",
          location: "Test",
          ownerId: user.id,
          feederId: i === 0 ? device.id : null, // Only first horse has feeder
        },
      }),
    ),
  );

  console.log("🚀 Testing 100 concurrent realistic feeding transactions...\n");

  const start = Date.now();

  const results = await Promise.allSettled(
    horses.map(async (horse, i) => {
      return prisma.$transaction(async (tx) => {
        // Your actual startFeeding logic
        const horseData = await tx.horse.findUnique({
          where: { id: horse.id, ownerId: user.id },
          select: { id: true, name: true, feederId: true },
        });

        if (!horseData?.feederId) {
          throw new Error("No feeder assigned");
        }

        const feeder = await tx.device.findUnique({
          where: { id: horseData.feederId },
          select: { id: true, thingName: true, deviceType: true },
        });

        if (!feeder) {
          throw new Error("Feeder not found");
        }

        const activeFeeding = await tx.activeFeeding.findUnique({
          where: { horseId: horse.id },
        });

        if (activeFeeding) {
          throw new Error("Already feeding");
        }

        // Only first horse succeeds (has feeder)
        if (i === 0) {
          const feeding = await tx.feeding.create({
            data: {
              horseId: horse.id,
              deviceId: feeder.id,
              requestedKg: 2.5,
              status: "PENDING",
            },
          });

          await tx.activeFeeding.create({
            data: {
              horseId: horse.id,
              deviceId: feeder.id,
              feedingId: feeding.id,
              status: "PENDING",
              requestedKg: 2.5,
            },
          });
        }

        return horseData.id;
      });
    }),
  );

  const duration = Date.now() - start;
  const succeeded = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;

  console.log("=".repeat(50));
  console.log(`⏱️  Duration: ${duration}ms (${(duration / 1000).toFixed(2)}s)`);
  console.log(`✅ Succeeded: ${succeeded}/100`);
  console.log(`❌ Failed: ${failed}/100 (expected: 99 "No feeder")`);
  console.log(`📈 Average: ${(duration / 100).toFixed(2)}ms per transaction`);
  console.log(`🚀 Throughput: ${((100 / duration) * 1000).toFixed(2)} TPS`);
  console.log("=".repeat(50));

  // Cleanup
  await prisma.activeFeeding.deleteMany({ where: { horseId: horses[0]!.id } });
  await prisma.feeding.deleteMany({
    where: { horseId: { in: horses.map((h) => h.id) } },
  });
  await prisma.horse.deleteMany({ where: { ownerId: user.id } });
  await prisma.device.delete({ where: { id: device.id } });
  await prisma.user.delete({ where: { id: user.id } });

  await prisma.$disconnect();
}

testRealisticQueries();
