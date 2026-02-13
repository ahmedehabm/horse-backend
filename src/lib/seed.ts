// prisma/seed.ts - Updated for Polymorphic Device Model
import {
  PrismaClient,
  Role,
  DeviceType,
  FeederType,
  FeedingStatus,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import { config } from "dotenv";
import path from "path";

config({ path: path.resolve(process.cwd(), ".env") });

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seed...");

  // Clear existing data (REVERSE ORDER for FK constraints)
  console.log("🗑️ Cleaning database...");
  await prisma.feeding.deleteMany();
  await prisma.horse.deleteMany();
  await prisma.device.deleteMany();
  await prisma.user.deleteMany();

  // ========================================
  // USERS
  // ========================================
  console.log("👤 Creating users...");
  const hashedPassword = await bcrypt.hash("password123", 12);

  const adminUser = await prisma.user.create({
    data: {
      name: "Admin User",
      username: "admin@horsefeeder.com",
      password: hashedPassword,
      role: Role.ADMIN,
    },
  });

  const user1 = await prisma.user.create({
    data: {
      name: "John Smith",
      username: "john@example.com",
      password: hashedPassword,
      role: Role.USER,
    },
  });

  const user2 = await prisma.user.create({
    data: {
      name: "Sarah Johnson",
      username: "sarah@example.com",
      password: hashedPassword,
      role: Role.USER,
    },
  });

  const user3 = await prisma.user.create({
    data: {
      name: "Michael Brown",
      username: "michael@example.com",
      password: hashedPassword,
      role: Role.USER,
    },
  });

  console.log(`✅ Created 4 users`);

  // ========================================
  // DEVICES - FEEDERS (deviceType: FEEDER)
  // ========================================
  console.log("🤖 Creating FEEDER devices...");

  const feeder1 = await prisma.device.create({
    data: {
      deviceType: DeviceType.FEEDER,
      thingName: "FEEDER-BELLA-001",
      thingLabel: "feeder bella",
      location: "North Barn - Stall 1",
      feederType: FeederType.SCHEDULED,
      morningTime: "07:00",
      dayTime: "13:00",
      nightTime: "19:00",
    },
  });

  const feeder2 = await prisma.device.create({
    data: {
      deviceType: DeviceType.FEEDER,
      thingName: "FEEDER-THUNDER-002",
      thingLabel: "feeder thunder",
      location: "North Barn - Stall 2",
      feederType: FeederType.MANUAL,
    },
  });

  const feeder3 = await prisma.device.create({
    data: {
      deviceType: DeviceType.FEEDER,
      thingName: "FEEDER-SPIRIT-003",
      thingLabel: "feeder spirit",
      location: "South Barn - Stall 1",
      feederType: FeederType.SCHEDULED,
      morningTime: "06:30",
      dayTime: "12:30",
      nightTime: "18:30",
    },
  });

  const feeder4 = await prisma.device.create({
    data: {
      deviceType: DeviceType.FEEDER,
      thingName: "FEEDER-MIDNIGHT-004",
      thingLabel: "feeder midnight",
      location: "South Barn - Stall 2",
      feederType: FeederType.MANUAL,
    },
  });

  const feeder5 = await prisma.device.create({
    data: {
      deviceType: DeviceType.FEEDER,
      thingName: "FEEDER-STAR-005",
      thingLabel: "feeder star",
      location: "Training Area - Bay 1",
      feederType: FeederType.SCHEDULED,
      morningTime: "07:30",
      dayTime: "13:30",
      nightTime: "19:30",
    },
  });

  const feeder6 = await prisma.device.create({
    data: {
      deviceType: DeviceType.FEEDER,
      thingName: "FEEDER-APOLLO-006",
      thingLabel: "feeder apollo",
      location: "Training Area - Bay 2",
      feederType: FeederType.MANUAL,
    },
  });

  const feeder7 = await prisma.device.create({
    data: {
      deviceType: DeviceType.FEEDER,
      thingName: "FEEDER-LUNA-007",
      thingLabel: "feeder luna",
      location: "East Pasture - Shelter 1",
      feederType: FeederType.SCHEDULED,
      morningTime: "06:00",
      dayTime: "12:00",
      nightTime: "18:00",
    },
  });

  console.log(`✅ Created 7 FEEDER devices`);

  // ========================================
  // DEVICES - CAMERAS (deviceType: CAMERA)
  // ========================================
  console.log("📹 Creating CAMERA devices...");

  const camera1 = await prisma.device.create({
    data: {
      deviceType: DeviceType.CAMERA,
      thingName: "CAMERA-BELLA-001",
      thingLabel: "camera bella",
      location: "North Barn - Stall 1 Ceiling",
      streamToken: "cam-stream-token-001",
      streamTokenIsValid: true,
    },
  });

  const camera2 = await prisma.device.create({
    data: {
      deviceType: DeviceType.CAMERA,
      thingName: "CAMERA-THUNDER-002",
      thingLabel: "camera thunder",
      location: "North Barn - Stall 2 Ceiling",
      streamToken: "cam-stream-token-002",
      streamTokenIsValid: true,
    },
  });

  const camera3 = await prisma.device.create({
    data: {
      deviceType: DeviceType.CAMERA,
      thingName: "CAMERA-SPIRIT-003",
      thingLabel: "camera spirit",
      location: "South Barn - Stall 1 Corner",
      streamToken: "cam-stream-token-003",
      streamTokenIsValid: true,
    },
  });

  const camera4 = await prisma.device.create({
    data: {
      deviceType: DeviceType.CAMERA,
      thingName: "CAMERA-MIDNIGHT-004",
      thingLabel: "camera midnight",
      location: "South Barn - Stall 2 Corner",
      streamToken: "cam-stream-token-004",
      streamTokenIsValid: false, // Example: expired token
    },
  });

  const camera5 = await prisma.device.create({
    data: {
      deviceType: DeviceType.CAMERA,
      thingName: "CAMERA-STAR-005",
      thingLabel: "camera star",
      location: "Training Area - Bay 1 Wall",
      streamToken: "cam-stream-token-005",
      streamTokenIsValid: true,
    },
  });

  const camera6 = await prisma.device.create({
    data: {
      deviceType: DeviceType.CAMERA,
      thingName: "CAMERA-APOLLO-006",
      thingLabel: "camera apollo",
      location: "Training Area - Bay 2 Wall",
      streamToken: "cam-stream-token-006",
      streamTokenIsValid: true,
    },
  });

  const camera7 = await prisma.device.create({
    data: {
      deviceType: DeviceType.CAMERA,
      thingName: "CAMERA-LUNA-007",
      thingLabel: "camera luna",
      location: "East Pasture - Shelter 1 Entrance",
      streamToken: "cam-stream-token-007",
      streamTokenIsValid: true,
    },
  });

  console.log(`✅ Created 7 CAMERA devices`);

  // ========================================
  // HORSES (Each horse MUST have 1 feeder + 1 camera)
  // ========================================
  console.log("🐴 Creating horses (1 feeder + 1 camera each)...");

  const horse1 = await prisma.horse.create({
    data: {
      name: "Bella",
      age: 12,
      breed: "Arabian",
      image: "https://images.unsplash.com/photo-1553284965-83fd3e82fa5a",
      location: "North Barn - Stall 1",

      ownerId: user1.id,
      feederId: feeder1.id, // Feeder device
      cameraId: camera1.id, // Camera device
    },
  });

  const horse2 = await prisma.horse.create({
    data: {
      name: "Thunder",
      age: 13,
      breed: "Thoroughbred",
      image: "https://images.unsplash.com/photo-1551884831-bbf3cdc6469e",
      location: "North Barn - Stall 2",

      ownerId: user1.id,
      feederId: feeder2.id,
      cameraId: camera2.id,
    },
  });

  const horse3 = await prisma.horse.create({
    data: {
      name: "Spirit",
      age: 15,
      breed: "Mustang",
      image: "https://images.unsplash.com/photo-1598978543601-d0141b3375e3",
      location: "South Barn - Stall 1",

      ownerId: user2.id,
      feederId: feeder3.id,
      cameraId: camera3.id,
    },
  });

  const horse4 = await prisma.horse.create({
    data: {
      name: "Midnight",
      age: 16,
      breed: "Friesian",
      image: "https://images.unsplash.com/photo-1568572933382-74d440642117",
      location: "South Barn - Stall 2",

      ownerId: user2.id,
      feederId: feeder4.id,
      cameraId: camera4.id,
    },
  });

  const horse5 = await prisma.horse.create({
    data: {
      name: "Star",
      age: 17,
      breed: "Quarter Horse",
      image: "https://images.unsplash.com/photo-1558873814-1da5a5c3e9fe",
      location: "Training Area - Bay 1",

      ownerId: user3.id,
      feederId: feeder5.id,
      cameraId: camera5.id,
    },
  });

  const horse6 = await prisma.horse.create({
    data: {
      name: "Apollo",
      age: 18,
      breed: "Andalusian",
      image: "https://images.unsplash.com/photo-1609712412893-2488b1ab9675",
      location: "Training Area - Bay 2",

      ownerId: user3.id,
      feederId: feeder6.id,
      cameraId: camera6.id,
    },
  });

  const horse7 = await prisma.horse.create({
    data: {
      name: "Luna",
      age: 19,
      breed: "Paint Horse",
      image: "https://images.unsplash.com/photo-1574158622682-e40e69881006",
      location: "East Pasture - Shelter 1",

      ownerId: user1.id,
      feederId: feeder7.id,
      cameraId: camera7.id,
    },
  });

  console.log(`✅ Created 7 horses (each with 1 feeder + 1 camera)`);

  // ========================================
  // FEEDINGS (Historical records)
  // ========================================
  console.log("🍽️ Creating feeding history...");

  // Bella's feedings (using feeder1)
  await prisma.feeding.create({
    data: {
      horseId: horse1.id,
      deviceId: feeder1.id,
      status: FeedingStatus.COMPLETED,
      requestedKg: 5.0,
      isScheduled: true,
      timeSlot: "morning",
      startedAt: new Date("2025-01-28T07:00:00"),
      completedAt: new Date("2025-01-28T07:15:00"),
    },
  });

  await prisma.feeding.create({
    data: {
      horseId: horse1.id,
      deviceId: feeder1.id,
      status: FeedingStatus.COMPLETED,
      requestedKg: 5.0,
      isScheduled: true,
      timeSlot: "day",
      startedAt: new Date("2025-01-28T13:00:00"),
      completedAt: new Date("2025-01-28T13:12:00"),
    },
  });

  // Thunder's manual feeding
  await prisma.feeding.create({
    data: {
      horseId: horse2.id,
      deviceId: feeder2.id,
      status: FeedingStatus.COMPLETED,
      requestedKg: 6.5,
      isScheduled: false,
      startedAt: new Date("2025-01-28T10:30:00"),
      completedAt: new Date("2025-01-28T10:45:00"),
    },
  });

  // Spirit's scheduled feedings
  await prisma.feeding.create({
    data: {
      horseId: horse3.id,
      deviceId: feeder3.id,
      status: FeedingStatus.COMPLETED,
      requestedKg: 5.5,
      isScheduled: true,
      timeSlot: "morning",
      startedAt: new Date("2025-01-28T06:30:00"),
      completedAt: new Date("2025-01-28T06:42:00"),
    },
  });

  // Midnight's feeding with FAILED status
  await prisma.feeding.create({
    data: {
      horseId: horse4.id,
      deviceId: feeder4.id,
      status: FeedingStatus.FAILED,
      requestedKg: 7.0,
      isScheduled: false,
      startedAt: new Date("2025-01-28T14:00:00"),
    },
  });

  // Star's RUNNING feeding (active now)
  await prisma.feeding.create({
    data: {
      horseId: horse5.id,
      deviceId: feeder5.id,
      status: FeedingStatus.RUNNING,
      requestedKg: 5.0,
      isScheduled: true,
      timeSlot: "day",
      startedAt: new Date(),
    },
  });

  // Apollo's PENDING feeding
  await prisma.feeding.create({
    data: {
      horseId: horse6.id,
      deviceId: feeder6.id,
      status: FeedingStatus.PENDING,
      requestedKg: 6.0,
      isScheduled: false,
    },
  });

  // Luna's completed feeding
  await prisma.feeding.create({
    data: {
      horseId: horse7.id,
      deviceId: feeder7.id,
      status: FeedingStatus.COMPLETED,
      requestedKg: 5.5,
      isScheduled: true,
      timeSlot: "morning",
      startedAt: new Date("2025-01-29T06:00:00"),
      completedAt: new Date("2025-01-29T06:10:00"),
    },
  });

  console.log(`✅ Created 8 feeding records`);

  // ========================================
  // SUMMARY
  // ========================================
  console.log("\n✨ Seed completed successfully!");
  console.log("═══════════════════════════════════════");
  console.log(`👤 Users: 4 (1 admin, 3 regular)`);
  console.log(`🤖 Feeder Devices: 7`);
  console.log(`📹 Camera Devices: 7`);
  console.log(`🐴 Horses: 7 (each with 1 feeder + 1 camera)`);
  console.log(`🍽️ Feedings: 8 (various statuses)`);
  console.log("═══════════════════════════════════════");
  console.log("\n🔐 Test Credentials:");
  console.log("   Admin: admin@horsefeeder.com / password123");
  console.log("   User1: john@example.com / password123");
  console.log("   User2: sarah@example.com / password123");
  console.log("   User3: michael@example.com / password123");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
