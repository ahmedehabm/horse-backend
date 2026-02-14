// src/validators/index.ts
import { z } from "zod";
// ========== USER VALIDATORS ==========
export const userSignupSchema = z
    .object({
    name: z.string().min(2, "Name must be at least 2 characters").max(50),
    username: z.string().min(3, "username must be at least 3 characters"),
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
    username: z.string().min(3, "username must be at least 3 characters"),
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
    name: z
        .string({ error: "NAMMM" })
        .min(2, "Horse name must be at least 2 characters")
        .max(50),
    breed: z
        .string({ error: "BReed" })
        .min(2, "Breed must be at least 2 characters")
        .max(50),
    age: z.coerce
        .number({ error: "AGE" })
        .int("Age must be an integer")
        .min(1, "Age must be 1 or greater")
        .max(40, "Age must be 40 or less"),
    location: z
        .string({ error: "location" })
        .min(2, "Location must be at least 2 characters")
        .max(100),
    // ✅ NEW: REQUIRED feederId & cameraId (1:1 relationship)
    feederId: z
        .string({ error: "fedeer" })
        .uuid("Must be a valid Device UUID")
        .optional(),
    cameraId: z
        .string({ error: "camera" })
        .uuid("Must be a valid Device UUID")
        .optional(),
    ownerId: z.string({ error: "ONWEr" }).uuid("Must be a valid Device UUID"),
    // image: z.string().url("Must be a valid URL").optional(),
});
export const updateHorseSchema = createHorseSchema.partial();
// ========== DEVICE VALIDATORS ==========
export const createDeviceSchema = z.object({
    thingLabel: z
        .string()
        .min(5, "Device name must be at least 5 characters")
        .max(50),
    deviceType: z.enum(["CAMERA", "FEEDER"]),
    location: z
        .string()
        .min(2, "Location must be at least 2 characters")
        .max(100),
    // FEEDER-SPECIFIC (only when deviceType = FEEDER)
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
export const FeedNowSchema = z.object({
    horseId: z.uuid("Not Valid UUID"),
    amountKg: z.number().positive().max(50),
});
export const StartStreamSchema = z.object({
    horseId: z.uuid("Not a Valid UUID"),
});
//# sourceMappingURL=validators.js.map