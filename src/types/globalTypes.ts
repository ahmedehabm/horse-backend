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
}

/**
 * Feeder event message types from IoT devices مستلمه من
 */
export interface FeedEventMessage {
  type:
    | "FEEDING_STARTED"
    | "FEEDING_RUNNING"
    | "FEEDING_COMPLETED"
    | "FEEDING_ERROR";
  feedingId: string;
  horseId: string;
  errorMessage?: string;
}

/**
 * Camer event message types from IoT devices مستلمه من
 */
export interface CameraEventMessage {
  type: "STREAM_STARTED" | "STREAM_ERROR";
  horseId: string;
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
  feedingId?: string; // in case of feeding
  targetKg?: number; //in case of feeding
  horseId: string; //this is a must in both
}

/**
 * Callback for handling incoming device events
 */
export type DeviceEventHandler = (event: DeviceEvent) => Promise<void> | void;

/////////////
////////////

/**
 * FROM FRONT END
 * WebSocket message types from frontend
 * FEED_NOW START_STREAM
 */
export interface FeedNowMessage {
  horseId: string;
  amountKg: number;
}

export interface StartStreamMessage {
  horseId: string;
}

export type ClientMessage = FeedNowMessage | StartStreamMessage;

///////

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
  streamUrl: string;
  errorMessage?: string;
};

export type BroadcastPayload =
  | ({ type: "FEEDING_STATUS" } & FeedingStatusPayload)
  | ({ type: "STREAM_STATUS" } & StreamStatusPayload);
