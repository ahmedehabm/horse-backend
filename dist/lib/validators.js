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
        .string({ error: "Horse name is required" })
        .min(2, "Horse name must be at least 2 characters")
        .max(50),
    breed: z
        .string({ error: "breed is required" })
        .min(2, "Breed must be at least 2 characters")
        .max(50),
    age: z.coerce
        .number({ error: "age is required" })
        .int("Age must be an integer")
        .min(1, "Age must be 1 or greater")
        .max(40, "Age must be 40 or less"),
    location: z
        .string({ error: "location" })
        .min(2, "Location must be at least 2 characters")
        .max(100),
    // ✅ NEW: REQUIRED feederId & cameraId (1:1 relationship)
    feederId: z.string().uuid("Must be a valid Device UUID").optional(),
    cameraId: z.string().uuid("Must be a valid Device UUID").optional(),
    ownerId: z.string().uuid("Must be a valid Device UUID"),
});
export const updateHorseSchema = createHorseSchema.partial();
// ========== DEVICE VALIDATORS ==========
export const createDeviceSchema = z
    .object({
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
    scheduledAmountKg: z
        .number()
        .min(0.1, "Amount must be at least 0.1 kg")
        .max(50, "Amount cannot exceed 50 kg")
        .optional(),
    morningTime: z
        .string()
        .regex(/^([0-1]?[0-9]|2[0-3]):00$/, "Must be on the hour (e.g., 04:00, 05:00, 16:00)")
        .or(z.literal(""))
        .optional(),
    dayTime: z
        .string()
        .regex(/^([0-1]?[0-9]|2[0-3]):00$/, "Must be on the hour (e.g., 04:00, 05:00, 16:00)")
        .or(z.literal(""))
        .optional(),
    nightTime: z
        .string()
        .regex(/^([0-1]?[0-9]|2[0-3]):00$/, "Must be on the hour (e.g., 04:00, 05:00, 16:00)")
        .or(z.literal(""))
        .optional(),
})
    .refine((data) => {
    // If SCHEDULED feeder, scheduledAmountKg is required
    if (data.deviceType === "FEEDER" && data.feederType === "SCHEDULED") {
        return data.scheduledAmountKg !== undefined;
    }
    return true;
}, {
    message: "scheduledAmountKg is required for SCHEDULED feeders",
    path: ["scheduledAmountKg"],
})
    .refine((data) => {
    // If SCHEDULED feeder, at least one time must be set
    if (data.deviceType === "FEEDER" && data.feederType === "SCHEDULED") {
        return data.morningTime || data.dayTime || data.nightTime;
    }
    return true;
}, {
    message: "At least one feeding time must be set for SCHEDULED feeders",
    path: ["morningTime"],
})
    .refine((data) => {
    // Check for duplicate times
    const times = [data.morningTime, data.dayTime, data.nightTime].filter((t) => t && t !== "");
    const uniqueTimes = new Set(times);
    return times.length === uniqueTimes.size;
}, {
    message: "Feeding times cannot be duplicated",
    path: ["dayTime"],
});
//for admin to update devices in general
export const updateDeviceSchema = z
    .object({
    thingLabel: z
        .string()
        .min(5, "Device name must be at least 5 characters")
        .max(50),
    location: z
        .string()
        .min(2, "Location must be at least 2 characters")
        .max(100),
    // ❌ No deviceType — cannot change device type after creation
    // FEEDER-SPECIFIC
    feederType: z.enum(["MANUAL", "SCHEDULED"]).optional(),
    scheduledAmountKg: z
        .number()
        .min(0.1, "Amount must be at least 0.1 kg")
        .max(50, "Amount cannot exceed 50 kg")
        .optional(),
    morningTime: z
        .string()
        .regex(/^([0-1]?[0-9]|2[0-3]):00$/, "Must be on the hour (e.g., 04:00, 05:00, 16:00)")
        .or(z.literal(""))
        .optional(),
    dayTime: z
        .string()
        .regex(/^([0-1]?[0-9]|2[0-3]):00$/, "Must be on the hour (e.g., 04:00, 05:00, 16:00)")
        .or(z.literal(""))
        .optional(),
    nightTime: z
        .string()
        .regex(/^([0-1]?[0-9]|2[0-3]):00$/, "Must be on the hour (e.g., 04:00, 05:00, 16:00)")
        .or(z.literal(""))
        .optional(),
})
    .refine((data) => {
    // If switching to SCHEDULED, scheduledAmountKg is required
    if (data.feederType === "SCHEDULED") {
        return data.scheduledAmountKg !== undefined;
    }
    return true;
}, {
    message: "scheduledAmountKg is required for SCHEDULED feeders",
    path: ["scheduledAmountKg"],
})
    .refine((data) => {
    // If switching to SCHEDULED, at least one time must be set
    if (data.feederType === "SCHEDULED") {
        return data.morningTime || data.dayTime || data.nightTime;
    }
    return true;
}, {
    message: "At least one feeding time must be set for SCHEDULED feeders",
    path: ["morningTime"],
})
    .refine((data) => {
    // Check for duplicate times
    const times = [data.morningTime, data.dayTime, data.nightTime].filter((t) => t && t !== "");
    const uniqueTimes = new Set(times);
    return times.length === uniqueTimes.size;
}, {
    message: "Feeding times cannot be duplicated",
    path: ["dayTime"],
});
// for USER to update his feeders
export const updateFeederSchema = z
    .object({
    feederType: z.enum(["MANUAL", "SCHEDULED"]).default("MANUAL"),
    scheduledAmountKg: z
        .number()
        .min(0.1, "Amount must be at least 0.1 kg")
        .max(50, "Amount cannot exceed 50 kg")
        .optional(),
    morningTime: z
        .string()
        .regex(/^([0-1]?[0-9]|2[0-3]):00$/, "Must be on the hour (e.g., 04:00, 05:00, 16:00)")
        .or(z.literal(""))
        .optional(),
    dayTime: z
        .string()
        .regex(/^([0-1]?[0-9]|2[0-3]):00$/, "Must be on the hour (e.g., 04:00, 05:00, 16:00)")
        .or(z.literal(""))
        .optional(),
    nightTime: z
        .string()
        .regex(/^([0-1]?[0-9]|2[0-3]):00$/, "Must be on the hour (e.g., 04:00, 05:00, 16:00)")
        .or(z.literal(""))
        .optional(),
})
    .refine((data) => {
    // If SCHEDULED feeder, scheduledAmountKg is required
    if (data.feederType === "SCHEDULED") {
        return data.scheduledAmountKg !== undefined;
    }
    return true;
}, {
    message: "scheduledAmountKg is required for SCHEDULED feeders",
    path: ["scheduledAmountKg"],
})
    .refine((data) => {
    // If SCHEDULED feeder, at least one time must be set
    if (data.feederType === "SCHEDULED") {
        return data.morningTime || data.dayTime || data.nightTime;
    }
    return true;
}, {
    message: "At least one feeding time must be set for SCHEDULED feeders",
    path: ["morningTime"],
})
    .refine((data) => {
    // Check for duplicate times
    const times = [data.morningTime, data.dayTime, data.nightTime].filter((t) => t && t !== "");
    const uniqueTimes = new Set(times);
    return times.length === uniqueTimes.size;
}, {
    message: "Feeding times cannot be duplicated",
    path: ["dayTime"],
});
// ========== FEEDING VALIDATORS ==========
export const FeedNowSchema = z.object({
    horseId: z.uuid("Not Valid UUID"),
    amountKg: z.number().positive(),
});
export const StartStreamSchema = z.object({
    horseId: z.uuid("Not a Valid UUID"),
});
// export type UpdateDeviceInput = z.infer<typeof updateDeviceSchema>;
//# sourceMappingURL=validators.js.map