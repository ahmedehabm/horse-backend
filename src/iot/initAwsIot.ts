// src/iot/initAwsIot.ts
import fs from "fs";
import path from "path";
import mqtt, { MqttClient, type IClientOptions } from "mqtt";
import type {
  DeviceEvent,
  DeviceEventHandler,
  CommandPayload,
  FeedEventMessage,
  CameraEventMessage,
} from "../types/globalTypes.js";

interface AwsIotEnv {
  AWS_IOT_ENDPOINT: string;
  AWS_IOT_CLIENT_ID: string;
  AWS_IOT_KEY_PATH: string;
  AWS_IOT_CERT_PATH: string;
  AWS_IOT_CA_PATH: string;
}

// ============================================================================
// CLIENT STATE
// ============================================================================
let client: MqttClient | null = null;
let deviceEventHandler: DeviceEventHandler | null = null;
const connectionState = {
  connected: false,
  reconnecting: false,
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function validateEnv(env: Partial<AwsIotEnv>): asserts env is AwsIotEnv {
  const required = [
    "AWS_IOT_ENDPOINT",
    "AWS_IOT_CLIENT_ID",
    "AWS_IOT_KEY_PATH",
    "AWS_IOT_CERT_PATH",
    "AWS_IOT_CA_PATH",
  ] as const;

  for (const key of required) {
    if (!env[key]) {
      throw new Error(`❌ Missing required AWS IoT env var: ${key}`);
    }
  }
}

function createClientOptions(): IClientOptions {
  const env = process.env as Partial<AwsIotEnv>;
  validateEnv(env);

  return {
    host: env.AWS_IOT_ENDPOINT,
    protocol: "mqtt",
    port: 8883,
    clientId: env.AWS_IOT_CLIENT_ID || "horse-feeder-backend",
    clean: true,
    key: fs.readFileSync(path.resolve(env.AWS_IOT_KEY_PATH)),
    cert: fs.readFileSync(path.resolve(env.AWS_IOT_CERT_PATH)),
    ca: fs.readFileSync(path.resolve(env.AWS_IOT_CA_PATH)),
    reconnectPeriod: 2000,
    connectTimeout: 30 * 1000,
    keepalive: 60,
    protocolVersion: 4,
  };
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Initialize AWS IoT Core (FEEDERS + CAMERAS)
 */
export function initAwsIot(onDeviceEvent: DeviceEventHandler): void {
  if (client) {
    console.warn("⚠️ AWS IoT client already initialized");
    return;
  }

  deviceEventHandler = onDeviceEvent;

  try {
    client = mqtt.connect(createClientOptions());
    setupConnectionHandlers();
    setupMessageHandlers();
    console.log("🔌 AWS IoT client connecting...");
  } catch (error) {
    console.error("❌ Failed to initialize AWS IoT client:", error);
    throw error;
  }
}

/**
 * Send command to ANY device (FEEDER or CAMERA)
 */
export async function publishCommand(
  thingName: string,
  command: CommandPayload,
): Promise<void> {
  if (!client?.connected) {
    console.error(`❌ Cannot publish to ${thingName}: client not connected`);
    return;
  }

  const deviceType = command.type === "FEED_COMMAND" ? "feeders" : "cameras";
  const topic = `${deviceType}/${thingName}/commands`;
  const payload = JSON.stringify(command);

  client.publish(topic, payload, { qos: 1 }, (err?: Error) => {
    if (err) {
      console.error(`❌ Publish failed [${thingName}]:`, err.message);
    } else {
      console.log(`✅ ${command.type} sent to ${thingName}`);
    }
  });
}

/**
 * Send FEED_COMMAND to feeder (backwards compatible)
 */
export async function publishFeedCommand(
  thingName: string,
  command: Omit<CommandPayload, "type"> & { type: "FEED_COMMAND" },
): Promise<void> {
  await publishCommand(thingName, { ...command, type: "FEED_COMMAND" });
}

/**
 * Send STREAM_COMMAND to camera
 */
export async function publishStreamCommand(
  thingName: string,
  command: Omit<CommandPayload, "type"> & { type: "STREAM_COMMAND" },
): Promise<void> {
  await publishCommand(thingName, { ...command, type: "STREAM_COMMAND" });
}

export function getClientStatus(): {
  connected: boolean;
  reconnecting: boolean;
  subscribers: number;
} {
  return {
    connected: client?.connected || false,
    reconnecting: connectionState.reconnecting,
    subscribers: client ? (client as any).subscribersCount || 0 : 0,
  };
}

export function disconnect(): Promise<void> {
  return new Promise((resolve) => {
    if (!client) {
      console.log("ℹ️ No AWS IoT client to disconnect");
      return resolve();
    }

    client.end(true, () => {
      client = null;
      deviceEventHandler = null;
      console.log("✅ AWS IoT client disconnected");
      resolve();
    });
  });
}

// ============================================================================
// PRIVATE EVENT HANDLERS
// ============================================================================

function setupConnectionHandlers(): void {
  if (!client) return;

  client.on("connect", () => {
    connectionState.connected = true;
    connectionState.reconnecting = false;
    console.log("✅ Connected to AWS IoT Core");

    // ✅ Subscribe to ALL devices: feeders/*/events + cameras/*/events
    const topics = ["feeders/+/events", "cameras/+/events"];

    topics.forEach((topic) => {
      client!.subscribe(topic, { qos: 1 }, (err: any) => {
        if (err) {
          console.error(`❌ Failed to subscribe to ${topic}:`, err.message);
        } else {
          console.log(`📡 Subscribed to ${topic} (QoS 1)`);
        }
      });
    });
  });

  client.on("reconnect", () => {
    connectionState.reconnecting = true;
    console.log("🔄 AWS IoT reconnecting...");
  });

  client.on("close", () => {
    connectionState.connected = false;
    connectionState.reconnecting = false;
    console.log("🔌 AWS IoT connection closed");
  });

  client.on("offline", () => {
    connectionState.connected = false;
    connectionState.reconnecting = false;
    console.log("📴 AWS IoT client went offline");
  });

  client.on("error", (err: Error) => {
    console.error("❌ AWS IoT client error:", err.message);
  });
}

function setupMessageHandlers(): void {
  if (!client) return;

  client.on("message", async (topic: string, payload: Buffer) => {
    try {
      // Extract device type + thingName: feeders/{thingName}/events OR cameras/{thingName}/events
      const parts = topic.split("/");
      if (parts.length < 3 || parts[2] !== "events") {
        console.warn(`⚠️ Ignoring invalid topic: ${topic}`);
        return;
      }

      const deviceType = parts[0] as "feeders" | "cameras";
      const thingName = parts[1];

      if (!thingName) {
        console.warn(`⚠️ Missing thingName in topic: ${topic}`);
        return;
      }

      // ✅ Parse polymorphic message
      const rawMsg = JSON.parse(payload.toString());

      // ✅ Route by device type (type narrowing)
      let msg: FeedEventMessage | CameraEventMessage;
      if (deviceType === "feeders" && "feedingId" in rawMsg) {
        msg = rawMsg as FeedEventMessage;
      } else if (deviceType === "cameras") {
        msg = rawMsg as CameraEventMessage;
      } else {
        console.warn(`⚠️ Invalid message type from ${thingName}:`, rawMsg);
        return;
      }

      // ✅ Create complete DeviceEvent
      const event: DeviceEvent = {
        topic,
        thingName,
        msg,
        timestamp: new Date(),
      };

      if (deviceEventHandler) {
        await deviceEventHandler(event);
      }
    } catch (error) {
      console.error(`❌ Failed to process message from topic ${topic}:`, error);
    }
  });
}
