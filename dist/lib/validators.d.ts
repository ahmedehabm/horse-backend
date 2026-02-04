import { z } from "zod";
export declare const userSignupSchema: z.ZodObject<{
    name: z.ZodString;
    email: z.ZodString;
    password: z.ZodString;
    passwordConfirm: z.ZodString;
}, z.core.$strip>;
export declare const userLoginSchema: z.ZodObject<{
    email: z.ZodString;
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
    age: z.ZodNumber;
    location: z.ZodString;
    feederId: z.ZodOptional<z.ZodString>;
    cameraId: z.ZodOptional<z.ZodString>;
    image: z.ZodOptional<z.ZodString>;
    defaultAmountKg: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export declare const updateHorseSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    breed: z.ZodOptional<z.ZodString>;
    age: z.ZodOptional<z.ZodNumber>;
    location: z.ZodOptional<z.ZodString>;
    feederId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    cameraId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    image: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    defaultAmountKg: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
}, z.core.$strip>;
export declare const createDeviceSchema: z.ZodObject<{
    thingName: z.ZodString;
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
    thingName: z.ZodOptional<z.ZodString>;
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
export type UserSignupInput = z.infer<typeof userSignupSchema>;
export type UserLoginInput = z.infer<typeof userLoginSchema>;
export type UpdatePasswordInput = z.infer<typeof updatePasswordSchema>;
export type CreateHorseInput = z.infer<typeof createHorseSchema>;
export type UpdateHorseInput = z.infer<typeof updateHorseSchema>;
export type CreateDeviceInput = z.infer<typeof createDeviceSchema>;
export type UpdateDeviceInput = z.infer<typeof updateDeviceSchema>;
export type CreateFeedingInput = z.infer<typeof createFeedingSchema>;
//# sourceMappingURL=validators.d.ts.map