export declare function startFeeding(horseId: string, amountKg: number, userId: string): Promise<{
    feeding: {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        deviceId: string;
        horseId: string;
        status: import("@prisma/client").$Enums.FeedingStatus;
        requestedKg: number;
        startedAt: Date | null;
        completedAt: Date | null;
        isScheduled: boolean;
        timeSlot: string | null;
    };
    horse: {
        feeder: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            location: string;
            thingName: string;
            streamToken: string | null;
            deviceType: import("@prisma/client").$Enums.DeviceType;
            feederType: import("@prisma/client").$Enums.FeederType;
            morningTime: string | null;
            dayTime: string | null;
            nightTime: string | null;
            streamTokenIsValid: boolean | null;
        } | null;
    } & {
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        age: number;
        breed: string;
        image: string | null;
        location: string;
        ownerId: string | null;
        feederId: string | null;
        cameraId: string | null;
        defaultAmountKg: number | null;
        lastFeedAt: Date | null;
    };
    device: {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        location: string;
        thingName: string;
        streamToken: string | null;
        deviceType: import("@prisma/client").$Enums.DeviceType;
        feederType: import("@prisma/client").$Enums.FeederType;
        morningTime: string | null;
        dayTime: string | null;
        nightTime: string | null;
        streamTokenIsValid: boolean | null;
    };
}>;
/**
 * Start camera streaming for horse
 */
export declare function startStreaming(horseId: string, userId: string): Promise<{
    horse: {
        camera: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            location: string;
            thingName: string;
            streamToken: string | null;
            deviceType: import("@prisma/client").$Enums.DeviceType;
            feederType: import("@prisma/client").$Enums.FeederType;
            morningTime: string | null;
            dayTime: string | null;
            nightTime: string | null;
            streamTokenIsValid: boolean | null;
        } | null;
    } & {
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        age: number;
        breed: string;
        image: string | null;
        location: string;
        ownerId: string | null;
        feederId: string | null;
        cameraId: string | null;
        defaultAmountKg: number | null;
        lastFeedAt: Date | null;
    };
    device: {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        location: string;
        thingName: string;
        streamToken: string | null;
        deviceType: import("@prisma/client").$Enums.DeviceType;
        feederType: import("@prisma/client").$Enums.FeederType;
        morningTime: string | null;
        dayTime: string | null;
        nightTime: string | null;
        streamTokenIsValid: boolean | null;
    };
}>;
//# sourceMappingURL=deviceService.d.ts.map