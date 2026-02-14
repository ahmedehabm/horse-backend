import { z } from "zod";
export declare const userSignupSchema: z.ZodObject<{
    name: z.ZodString;
    username: z.ZodString;
    password: z.ZodString;
    passwordConfirm: z.ZodString;
}, z.core.$strip>;
export declare const userLoginSchema: z.ZodObject<{
    username: z.ZodString;
    password: z.ZodString;
}, z.core.$strip>;
export declare const updatePasswordSchema: z.ZodObject<{
    currentPassword: z.ZodString;
    newPassword: z.ZodString;
    passwordConfirm: z.ZodString;
}, z.core.$strip>;
export declare const createHorseSchema: z.ZodObject<{
    name: z.ZodString;
    breed: z.ZodString;
    age: z.ZodCoercedNumber<unknown>;
    location: z.ZodString;
    feederId: z.ZodOptional<z.ZodString>;
    cameraId: z.ZodOptional<z.ZodString>;
    ownerId: z.ZodString;
}, z.core.$strip>;
export declare const updateHorseSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    breed: z.ZodOptional<z.ZodString>;
    age: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    location: z.ZodOptional<z.ZodString>;
    feederId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    cameraId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    ownerId: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const createDeviceSchema: z.ZodObject<{
    thingLabel: z.ZodString;
    deviceType: z.ZodEnum<{
        CAMERA: "CAMERA";
        FEEDER: "FEEDER";
    }>;
    location: z.ZodString;
    feederType: z.ZodDefault<z.ZodEnum<{
        MANUAL: "MANUAL";
        SCHEDULED: "SCHEDULED";
    }>>;
    morningTime: z.ZodOptional<z.ZodString>;
    dayTime: z.ZodOptional<z.ZodString>;
    nightTime: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const updateDeviceSchema: z.ZodObject<{
    thingLabel: z.ZodOptional<z.ZodString>;
    deviceType: z.ZodOptional<z.ZodEnum<{
        CAMERA: "CAMERA";
        FEEDER: "FEEDER";
    }>>;
    location: z.ZodOptional<z.ZodString>;
    feederType: z.ZodOptional<z.ZodDefault<z.ZodEnum<{
        MANUAL: "MANUAL";
        SCHEDULED: "SCHEDULED";
    }>>>;
    morningTime: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    dayTime: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    nightTime: z.ZodOptional<z.ZodOptional<z.ZodString>>;
}, z.core.$strip>;
export declare const createFeedingSchema: z.ZodObject<{
    amountKg: z.ZodNumber;
    notes: z.ZodOptional<z.ZodString>;
    deviceId: z.ZodString;
}, z.core.$strip>;
export declare const updateFeedingSchema: z.ZodObject<{
    amountKg: z.ZodOptional<z.ZodNumber>;
    notes: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    deviceId: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const FeedNowSchema: z.ZodObject<{
    horseId: z.ZodUUID;
    amountKg: z.ZodNumber;
}, z.core.$strip>;
export declare const StartStreamSchema: z.ZodObject<{
    horseId: z.ZodUUID;
}, z.core.$strip>;
export type UserSignupInput = z.infer<typeof userSignupSchema>;
export type UserLoginInput = z.infer<typeof userLoginSchema>;
export type UpdatePasswordInput = z.infer<typeof updatePasswordSchema>;
export type CreateHorseInput = z.infer<typeof createHorseSchema>;
export type UpdateHorseInput = z.infer<typeof updateHorseSchema>;
export type CreateDeviceInput = z.infer<typeof createDeviceSchema>;
export type UpdateDeviceInput = z.infer<typeof updateDeviceSchema>;
export type CreateFeedingInput = z.infer<typeof createFeedingSchema>;
//# sourceMappingURL=validators.d.ts.map