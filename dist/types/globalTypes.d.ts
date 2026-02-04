/**
 * //FROM DEVICE
 * Complete device event with metadata
 *
 * IoT devices مستلمه من
 */
export interface DeviceEvent {
    topic: string;
    thingName: string;
    msg: FeedEventMessage | CameraEventMessage;
    timestamp: Date;
}
/**
 * Feeder event message types from IoT devices مستلمه من
 */
export interface FeedEventMessage {
    type: "FEEDING_STARTED" | "FEEDING_PROGRESS" | "FEEDING_COMPLETED" | "FEEDING_ERROR";
    feedingId: string;
    errorMessage?: string;
}
/**
 * Camer event message types from IoT devices مستلمه من
 */
export interface CameraEventMessage {
    type: "STREAM_STARTED" | "STREAM_STOPPED" | "STREAM_ERROR";
    streamId?: string;
    errorMessage?: string;
}
/**
 *
 * TO DEVICE
 * Feed command payload sent to devices
 *  زايحه للجهاز
 */
export interface CommandPayload {
    type: "FEED_COMMAND" | "STREAM_COMMAND";
    feedingId?: string;
    targetKg?: number;
    horseId: string;
}
/**
 * Callback for handling incoming device events
 */
export type DeviceEventHandler = (event: DeviceEvent) => Promise<void> | void;
/**
 * FROM FRONT END
 * WebSocket message types from frontend
 */
export interface FeedNowMessage {
    type: "FEED_NOW";
    horseId: string;
    amountKg: number;
}
export interface StartStreamMessage {
    type: "START_STREAM";
    horseId: string;
}
export type ClientMessage = FeedNowMessage | StartStreamMessage;
/**
 *
 * TO FRONT END
 * Feeding status payload
 *
 * which will be send to the client
 */
export type FeedingStatusPayload = {
    horseId: string;
    status: string;
    feedingId: string;
    deviceName?: string;
    errorMessage?: string;
};
/**
 * Camera status payload
 *
 * which will be send to the client
 */
export type StreamStatusPayload = {
    horseId: string;
    status: string;
    deviceName?: string;
    streamUrl: string;
    errorMessage?: string;
};
export type BroadcastPayload = ({
    type: "FEEDING_STATUS";
} & FeedingStatusPayload) | ({
    type: "STREAM_STATUS";
} & StreamStatusPayload);
//# sourceMappingURL=globalTypes.d.ts.map