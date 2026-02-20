import { MqttClient } from "mqtt";
import type { DeviceEventHandler, FeedCommand, StreamCommand } from "../types/globalTypes.js";
export declare function getAwsMqttClient(): MqttClient;
/**
 * Initialize AWS IoT Core (FEEDERS + CAMERAS)
 */
export declare function initAwsIot(onDeviceEvent: DeviceEventHandler): void;
/**
 * Send FEED_COMMAND to feeder
 */
export declare function publishFeedCommand(thingName: string, command: FeedCommand): Promise<void>;
/**
 * Send STREAM command to camera
 */
export declare function publishStreamCommand(thingName: string, command: StreamCommand): Promise<void>;
export declare function disconnect(): Promise<void>;
/**
 * Tell many feeders to START publishing weight (device firmware must support this)
 * Publishes to: feeders/{thingName}/commands
 */
export declare function publishWeightStreamStartMany(thingNames: string[]): Promise<void>;
/**
 * Tell many feeders to STOP publishing weight (device firmware must support this)
 * Publishes to: feeders/{thingName}/commands
 */
export declare function publishWeightStreamStopMany(thingNames: string[]): Promise<void>;
//# sourceMappingURL=initAwsIot.d.ts.map