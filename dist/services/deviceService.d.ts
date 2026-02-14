export declare function startFeeding(horseId: string, amountKg: number, userId: string): Promise<{
    feeding: {
        id: string;
        horseId: string;
        deviceId: string;
        status: import("@prisma/client").$Enums.FeedingStatus;
    };
    horse: {
        name: string;
        id: string;
        feederId: string | null;
    };
    feeder: {
        id: string;
        deviceType: import("@prisma/client").$Enums.DeviceType;
        thingName: string;
    };
}>;
export declare function startStreaming(horseId: string, userId: string): Promise<{
    horse: {
        id: string;
        name: string;
    };
    device: {
        id: string;
        deviceType: import("@prisma/client").$Enums.DeviceType;
        thingName: string;
    };
    status: string;
}>;
export declare function stopStreaming(horseId: string, userId: string): Promise<{
    horse: {
        id: string;
        cameraId: string | null;
    };
    device: {
        id: string;
        deviceType: import("@prisma/client").$Enums.DeviceType;
        thingName: string;
    };
}>;
export declare function startScheduledFeeding(deviceId: string, timeSlot?: "morning" | "day" | "night"): Promise<{
    feeding: {
        id: string;
        horseId: string;
        deviceId: string;
        status: import("@prisma/client").$Enums.FeedingStatus;
    };
    horse: any;
    feeder: any;
}>;
//# sourceMappingURL=deviceService.d.ts.map