// src/iot/mockMqtt.ts
import { EventEmitter } from "events";
import { setWeight } from "../services/weightCache.js";
import { emitToRoom } from "../ws/clientWs.js";
import type {
  FeedEventMessage,
  CameraEventMessage,
  DeviceEventHandler,
} from "../types/globalTypes.js";

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

class MockMqttClient extends EventEmitter {
  private weightSimulators = new Map<string, NodeJS.Timeout>();
  private feedingSimulators = new Map<string, NodeJS.Timeout>();
  private streamSimulators = new Map<string, NodeJS.Timeout>();
  private activeFeedings = new Map<string, string>();
  private deviceEventHandler: DeviceEventHandler | null = null;

  constructor() {
    super();
    this.connected = false;
  }

  connected: boolean;

  connect() {
    console.log("🔌 Mock MQTT: Simulating connection...");
    setTimeout(() => {
      this.connected = true;
      this.emit("connect");
      console.log("✅ Mock MQTT: Connected (simulated)");
    }, 1000);
    return this;
  }

  /**
   * Set the device event handler (called during initialization)
   */
  setDeviceEventHandler(handler: DeviceEventHandler) {
    this.deviceEventHandler = handler;
    console.log("🔗 Device event handler registered with mock client");
  }

  // ============================================================================
  // WEIGHT SIMULATION
  // ============================================================================

  startWeightSimulation(thingName: string, baseWeight: number = 15.0) {
    if (this.weightSimulators.has(thingName)) {
      console.warn(`⚠️ Weight simulator for ${thingName} already running`);
      return;
    }

    let iteration = 0;

    const interval = setInterval(() => {
      const weight = this.generateWeight(baseWeight, iteration);

      setWeight(thingName, weight);

      emitToRoom(`feeder-weight:${thingName}`, "FEEDER_WEIGHT", {
        type: "FEEDER_WEIGHT",
        thingName,
        weight,
      });

      iteration++;
    }, 5000);

    this.weightSimulators.set(thingName, interval);
  }

  stopWeightSimulation(thingName: string) {
    const interval = this.weightSimulators.get(thingName);
    if (interval) {
      clearInterval(interval);
      this.weightSimulators.delete(thingName);
      console.log(`🛑 Stopped weight simulation for: ${thingName}`);
    }
  }

  private generateWeight(baseWeight: number, iteration: number): number {
    const cycleLength = 100;
    const cyclePosition = iteration % cycleLength;

    if (cyclePosition < 70) {
      const decrease = (cyclePosition / 70) * 0.3 * baseWeight;
      return Math.max(0.5, baseWeight - decrease);
    } else {
      return baseWeight;
    }
  }

  // ============================================================================
  // FEEDING SIMULATION
  // ============================================================================

  startFeedingSimulation(config: FeedingSimulationConfig) {
    const { thingName, feedingId, horseId } = config;

    if (this.feedingSimulators.has(feedingId)) {
      console.warn(`⚠️ Feeding simulator for ${feedingId} already running`);
      return;
    }

    this.activeFeedings.set(thingName, feedingId);

    console.log(
      `🍽️  Starting feeding simulation for: ${thingName} (feedingId: ${feedingId}, horseId: ${horseId})`,
    );

    const startTimeout = setTimeout(() => {
      this.emitFeedingEvent(thingName, feedingId, horseId, "FEEDING_STARTED");
    }, 10000);

    const runningTimeout = setTimeout(() => {
      if (this.feedingSimulators.has(feedingId)) {
        this.emitFeedingEvent(thingName, feedingId, horseId, "FEEDING_RUNNING");
      }
    }, 15000);

    const completedTimeout = setTimeout(() => {
      if (this.feedingSimulators.has(feedingId)) {
        this.emitFeedingEvent(
          thingName,
          feedingId,
          horseId,
          "FEEDING_COMPLETED",
        );
        this.feedingSimulators.delete(feedingId);
        this.activeFeedings.delete(thingName);
      }
    }, 20000);

    this.feedingSimulators.set(feedingId, startTimeout);
    (startTimeout as any)._other = [runningTimeout, completedTimeout];
  }

  stopFeedingSimulation(feedingId: string) {
    const timeout = this.feedingSimulators.get(feedingId);
    if (timeout) {
      clearTimeout(timeout);
      if ((timeout as any)._other) {
        (timeout as any)._other.forEach((t: NodeJS.Timeout) => clearTimeout(t));
      }
      this.feedingSimulators.delete(feedingId);
      console.log(`🛑 Stopped feeding simulation for: ${feedingId}`);
    }
  }

  /**
   * Emit feeding event + route through device handler
   */
  private async emitFeedingEvent(
    thingName: string,
    feedingId: string,
    horseId: string,
    eventType:
      | "FEEDING_STARTED"
      | "FEEDING_RUNNING"
      | "FEEDING_COMPLETED"
      | "FEEDING_ERROR",
  ) {
    const message: FeedEventMessage = {
      type: eventType,
      feedingId,
      horseId,
    };

    if (eventType === "FEEDING_ERROR") {
      message.errorMessage = "Simulated feeder error";
    }

    const topic = `feeders/${thingName}/events`;
    const payload = JSON.stringify(message);

    console.log(
      `📤 [Mock Feeding] ${eventType} -> ${topic} | feedingId: ${feedingId}, horseId: ${horseId}`,
    );

    // Route through device event handler
    if (this.deviceEventHandler) {
      try {
        await this.deviceEventHandler({
          topic,
          thingName,
          msg: message,
        });
      } catch (error) {
        console.error(`❌ Device event handler error:`, error);
      }
    }
  }

  triggerFeedingError(thingName: string, feedingId: string, horseId: string) {
    this.emitFeedingEvent(thingName, feedingId, horseId, "FEEDING_ERROR");
    this.stopFeedingSimulation(feedingId);
  }

  // ============================================================================
  // STREAM SIMULATION
  // ============================================================================

  startStreamSimulation(config: StreamSimulationConfig) {
    const { cameraThingName, horseId, shouldError = false } = config;
    const streamId = `${cameraThingName}-${horseId}`;

    if (this.streamSimulators.has(streamId)) {
      console.warn(`⚠️ Stream simulator for ${streamId} already running`);
      return;
    }

    console.log(
      `📹 Starting stream simulation for: ${cameraThingName} (horseId: ${horseId})`,
    );

    const startTimeout = setTimeout(() => {
      this.emitStreamEvent(cameraThingName, horseId, "STREAM_STARTED");

      if (shouldError) {
        const errorTimeout = setTimeout(() => {
          if (this.streamSimulators.has(streamId)) {
            this.emitStreamEvent(cameraThingName, horseId, "STREAM_ERROR");
            this.streamSimulators.delete(streamId);
          }
        }, 8000);

        (startTimeout as any)._errorTimeout = errorTimeout;
      }
    }, 500);

    this.streamSimulators.set(streamId, startTimeout);
  }

  stopStreamSimulation(cameraThingName: string, horseId: string) {
    const streamId = `${cameraThingName}-${horseId}`;
    const timeout = this.streamSimulators.get(streamId);

    if (timeout) {
      clearTimeout(timeout);
      if ((timeout as any)._errorTimeout) {
        clearTimeout((timeout as any)._errorTimeout);
      }
      this.streamSimulators.delete(streamId);
      console.log(`🛑 Stopped stream simulation for: ${streamId}`);
    }
  }

  /**
   * Emit stream event + route through device handler
   */
  private async emitStreamEvent(
    cameraThingName: string,
    horseId: string,
    eventType: "STREAM_STARTED" | "STREAM_ERROR",
  ) {
    const message: CameraEventMessage = {
      type: eventType,
      horseId,
    };

    if (eventType === "STREAM_ERROR") {
      message.errorMessage = "Simulated stream connection error";
    }

    const topic = `cameras/${cameraThingName}/events`;
    const payload = JSON.stringify(message);

    console.log(
      `📤 [Mock Stream] ${eventType} -> ${topic} | horseId: ${horseId}`,
    );

    // Route through device event handler
    if (this.deviceEventHandler) {
      try {
        await this.deviceEventHandler({
          topic,
          thingName: cameraThingName,
          msg: message,
        });
      } catch (error) {
        console.error(`❌ Device event handler error:`, error);
      }
    }
  }

  triggerStreamError(cameraThingName: string, horseId: string) {
    this.emitStreamEvent(cameraThingName, horseId, "STREAM_ERROR");
    this.stopStreamSimulation(cameraThingName, horseId);
  }

  // ============================================================================
  // LIFECYCLE
  // ============================================================================

  stopAllSimulations() {
    this.weightSimulators.forEach((interval) => {
      clearInterval(interval);
    });
    this.weightSimulators.clear();

    this.feedingSimulators.forEach((timeout) => {
      clearTimeout(timeout);
      if ((timeout as any)._other) {
        (timeout as any)._other.forEach((t: NodeJS.Timeout) => clearTimeout(t));
      }
    });
    this.feedingSimulators.clear();

    this.streamSimulators.forEach((timeout) => {
      clearTimeout(timeout);
      if ((timeout as any)._errorTimeout) {
        clearTimeout((timeout as any)._errorTimeout);
      }
    });
    this.streamSimulators.clear();

    this.activeFeedings.clear();
    console.log("🛑 All simulations stopped");
  }

  subscribe() {
    // Mock implementation
  }

  publish(
    topic: string,
    payload: string,
    options?: any,
    callback?: (err?: Error) => void,
  ) {
    // Mock implementation - just call callback
    if (callback) {
      callback();
    }
  }

  end(force?: boolean, callback?: () => void) {
    this.stopAllSimulations();
    this.connected = false;
    if (callback) {
      callback();
    }
  }
}

let mockClient: MockMqttClient | null = null;

/**
 * Initialize mock MQTT with device event handler
 */
export function initMockMqtt(onDeviceEvent?: DeviceEventHandler) {
  if (mockClient) {
    console.warn("⚠️ Mock MQTT already initialized");
    return mockClient;
  }

  mockClient = new MockMqttClient();

  // Register handler if provided
  if (onDeviceEvent) {
    mockClient.setDeviceEventHandler(onDeviceEvent);
  }

  mockClient.connect();

  // Auto-start simulations for known feeders
  mockClient.on("connect", () => {
    mockClient!.startWeightSimulation("FEEDER-BELLA-001", 15.0);
    mockClient!.startWeightSimulation("FEEDER-THUNDER-002", 20.0);
    mockClient!.startWeightSimulation("FEEDER-LUNA-007", 12.5);
  });

  return mockClient;
}

export function getMockMqttClient() {
  if (!mockClient) throw new Error("Mock MQTT not initialized");
  return mockClient;
}
