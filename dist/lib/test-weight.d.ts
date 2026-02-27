import { EventEmitter } from "events";
import type { DeviceEventHandler } from "../types/globalTypes.js";
interface FeedingSimulationConfig {
    thingName: string;
    baseWeight: number;
    feedingId: string;
    horseId: string;
}
interface StreamSimulationConfig {
    cameraThingName: string;
    horseId: string;
    shouldError?: boolean;
}
declare class MockMqttClient extends EventEmitter {
    private weightSimulators;
    private feedingSimulators;
    private streamSimulators;
    private activeFeedings;
    private deviceEventHandler;
    constructor();
    connected: boolean;
    connect(): this;
    /**
     * Set the device event handler (called during initialization)
     */
    setDeviceEventHandler(handler: DeviceEventHandler): void;
    startWeightSimulation(thingName: string, baseWeight?: number): void;
    stopWeightSimulation(thingName: string): void;
    private generateWeight;
    startFeedingSimulation(config: FeedingSimulationConfig): void;
    stopFeedingSimulation(feedingId: string): void;
    /**
     * Emit feeding event + route through device handler
     */
    private emitFeedingEvent;
    triggerFeedingError(thingName: string, feedingId: string, horseId: string): void;
    startStreamSimulation(config: StreamSimulationConfig): void;
    stopStreamSimulation(cameraThingName: string, horseId: string): void;
    /**
     * Emit stream event + route through device handler
     */
    private emitStreamEvent;
    triggerStreamError(cameraThingName: string, horseId: string): void;
    stopAllSimulations(): void;
    subscribe(): void;
    publish(topic: string, payload: string, options?: any, callback?: (err?: Error) => void): void;
    end(force?: boolean, callback?: () => void): void;
}
/**
 * Initialize mock MQTT with device event handler
 */
export declare function initMockMqtt(onDeviceEvent?: DeviceEventHandler): MockMqttClient;
export declare function getMockMqttClient(): MockMqttClient;
export {};
//# sourceMappingURL=test-weight.d.ts.map