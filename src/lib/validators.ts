// src/validators/index.ts
import { z } from "zod";

// ========== USER VALIDATORS ==========
export const userSignupSchema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters").max(50),
    email: z.string().email("Please provide a valid email").toLowerCase(),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(100),
    passwordConfirm: z.string("Provide password confirm"),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: "Passwords do not match",
    path: ["passwordConfirm"],
  });

export const userLoginSchema = z.object({
  email: z.string().email("Please provide a valid email"),
  password: z.string().min(1, "Password is required"),
});

export const updatePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z
      .string()
      .min(8, "New password must be at least 8 characters")
      .max(100),
    passwordConfirm: z.string("Provide password confirm"),
  })
  .refine((data) => data.newPassword === data.passwordConfirm, {
    message: "Passwords do not match",
    path: ["passwordConfirm"],
  });

// ========== HORSE VALIDATORS ==========
export const createHorseSchema = z.object({
  name: z.string().min(2, "Horse name must be at least 2 characters").max(50),
  breed: z.string().min(2, "Breed must be at least 2 characters").max(50),
  age: z
    .number()
    .int("Age must be an integer")
    .min(1, "Age must be 1 or greater")
    .max(40, "Age must be 40 or less"),
  location: z
    .string()
    .min(2, "Location must be at least 2 characters")
    .max(100),

  // ✅ NEW: REQUIRED feederId & cameraId (1:1 relationship)
  feederId: z.string().uuid("Must be a valid Device UUID").optional(),
  cameraId: z.string().uuid("Must be a valid Device UUID").optional(),

  image: z.string().url("Must be a valid URL").optional(),
  defaultAmountKg: z
    .number()
    .min(0.1, "Amount must be greater than 0.1kg")
    .max(50, "Amount must be less than 50kg")
    .optional(),
});

export const updateHorseSchema = createHorseSchema.partial();

// ========== DEVICE VALIDATORS ==========
export const createDeviceSchema = z.object({
  // ✅ thingName replaces serialNumber (unique across all devices)
  thingName: z
    .string()
    .min(5, "Device name must be at least 5 characters")
    .max(50),

  deviceType: z.enum(["CAMERA", "FEEDER"]),
  location: z
    .string()
    .min(2, "Location must be at least 2 characters")
    .max(100),

  // ✅ FEEDER-SPECIFIC (only when deviceType = FEEDER)
  feederType: z.enum(["MANUAL", "SCHEDULED"]).default("MANUAL"),
  morningTime: z
    .string()
    .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "HH:MM format (08:00)")
    .optional(),
  dayTime: z
    .string()
    .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "HH:MM format (08:00)")
    .optional(),
  nightTime: z
    .string()
    .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "HH:MM format (08:00)")
    .optional(),
});

export const updateDeviceSchema = createDeviceSchema.partial();

// ========== FEEDING VALIDATORS ==========
export const createFeedingSchema = z.object({
  amountKg: z
    .number()
    .min(0.01, "Amount must be greater than 0.01kg")
    .max(100, "Amount must be less than 100kg"),
  notes: z.string().max(500).optional(),
  // ✅ deviceId instead of feederId (polymorphic)
  deviceId: z.string().uuid("Must be a valid Device UUID"),
});

export const updateFeedingSchema = createFeedingSchema.partial();

// Export TypeScript types (auto-inferred from Zod)
export type UserSignupInput = z.infer<typeof userSignupSchema>;
export type UserLoginInput = z.infer<typeof userLoginSchema>;
export type UpdatePasswordInput = z.infer<typeof updatePasswordSchema>;
export type CreateHorseInput = z.infer<typeof createHorseSchema>;
export type UpdateHorseInput = z.infer<typeof updateHorseSchema>;
export type CreateDeviceInput = z.infer<typeof createDeviceSchema>;
export type UpdateDeviceInput = z.infer<typeof updateDeviceSchema>;
export type CreateFeedingInput = z.infer<typeof createFeedingSchema>;
