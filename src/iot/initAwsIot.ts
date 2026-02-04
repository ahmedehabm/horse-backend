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
import { emitToRoom } from "../ws/clientWs.js";

interface AwsIotEnv {
  AWS_IOT_ENDPOINT: string;
  AWS_IOT_CLIENT_ID: string;
  AWS_IOT_PRIVATE_KEY: string;
  AWS_IOT_CERTIFICATE: string;
  AWS_IOT_CA: string;
}

// ============================================================================
// CLIENT STATE
// ============================================================================
let client: MqttClient | null = null;
let deviceEventHandler: DeviceEventHandler | null = null;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export function getAwsMqttClient(): MqttClient {
  if (!client) throw new Error("AWS IoT client not initialized");
  return client;
}

function validateEnv(env: Partial<AwsIotEnv>): asserts env is AwsIotEnv {
  const required = [
    "AWS_IOT_ENDPOINT",
    "AWS_IOT_CLIENT_ID",
    "AWS_IOT_PRIVATE_KEY",
    "AWS_IOT_CERTIFICATE",
    "AWS_IOT_CA",
  ] as const;

  for (const key of required) {
    if (!env[key]) {
      throw new Error(`❌ Missing required AWS IoT env var: ${key}`);
    }
  }
}

function normalizePem(value: string) {
  return value.replace(/\\n/g, "\n");
}

function createClientOptions(): IClientOptions {
  const env = process.env as Partial<AwsIotEnv>;
  validateEnv(env);

  return {
    host: env.AWS_IOT_ENDPOINT,
    protocol: "mqtts",
    port: 8883,
    clientId: env.AWS_IOT_CLIENT_ID,
    clean: true,

    key: normalizePem(env.AWS_IOT_PRIVATE_KEY),
    cert: normalizePem(env.AWS_IOT_CERTIFICATE),
    ca: normalizePem(env.AWS_IOT_CA),

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

function setupConnectionHandlers(): void {
  if (!client) return;

  client.on("connect", () => {
    console.log("✅ AWS IoT connected");

    // Subscribe to all feeder/camera event topics
    client!.subscribe(
      ["feeders/#", "cameras/#"],
      { qos: 1 },
      (err, granted) => {
        if (err) {
          console.error("❌ Subscribe failed:", err);
          return;
        }
        console.log("✅ Subscribed:", granted);
      },
    );
  });

  client.on("error", (err) => {
    console.error("❌ AWS IoT error:", err);
  });

  client.on("reconnect", () => {
    console.warn("🔁 AWS IoT reconnecting...");
  });

  client.on("close", () => {
    console.warn("🔌 AWS IoT connection closed");
  });
}

function setupMessageHandlers(): void {
  if (!client) return;

  client.on("message", async (topic: string, payload: Buffer) => {
    try {
      const parts = topic.split("/");

      // Validate basic topic structure: {deviceType}/{thingName}/{action}
      if (parts.length < 3) {
        console.warn(`⚠️ Ignoring invalid topic: ${topic}`);
        return;
      }

      const deviceType = parts[0];
      const thingName = parts[1];
      const action = parts[2];

      if (!thingName) {
        console.warn(`⚠️ Missing thingName in topic: ${topic}`);
        return;
      }

      // ---- WEIGHT STREAM: feeders/{thingName}/weight-event ----
      if (deviceType === "feeders" && action === "weight-events") {
        const text = payload.toString("utf8").trim();

        let weightValue: number | null = null;

        // Accept both JSON payloads and plain numeric strings
        if (text.startsWith("{")) {
          const parsed = JSON.parse(text) as { weight?: number | string };
          if (parsed.weight !== undefined) {
            const n =
              typeof parsed.weight === "string"
                ? parseFloat(parsed.weight)
                : parsed.weight;
            if (Number.isFinite(n)) weightValue = n;
          }
        } else {
          const n = parseFloat(text);
          if (Number.isFinite(n)) weightValue = n;
        }

        if (weightValue === null) {
          console.warn("⚠️ Invalid weight payload", { topic, text });
          return;
        }

        emitToRoom(`feeder-weight:${thingName}`, "FEEDER_WEIGHT", {
          type: "FEEDER_WEIGHT",
          thingName,
          weight: weightValue,
        });

        return;
      }

      // ---- DEVICE EVENTS: feeders/{thingName}/events OR cameras/{thingName}/events ----
      if (action !== "events") {
        console.warn(`⚠️ Ignoring unknown action: ${topic}`);
        return;
      }

      if (deviceType !== "feeders" && deviceType !== "cameras") {
        console.warn(`⚠️ Ignoring unknown device type: ${topic}`);
        return;
      }

      // Parse polymorphic message
      const rawMsg = JSON.parse(payload.toString());

      // Route by device type
      let msg: FeedEventMessage | CameraEventMessage;

      if (deviceType === "feeders" && "feedingId" in rawMsg) {
        msg = rawMsg as FeedEventMessage;
      } else if (deviceType === "cameras") {
        msg = rawMsg as CameraEventMessage;
      } else {
        console.warn(`⚠️ Invalid message type from ${thingName}:`, rawMsg);
        return;
      }

      // Create complete DeviceEvent
      const event: DeviceEvent = {
        topic,
        thingName,
        msg,
      };

      if (deviceEventHandler) {
        await deviceEventHandler(event);
      }
    } catch (error) {
      console.error(`❌ Failed to process message from topic ${topic}:`, error);
    }
  });
}
async function publishFeederWeightCommand(
  thingName: string,
  command: CommandPayload,
): Promise<void> {
  if (!client?.connected) return;

  const topic = `feeders/${thingName}/weight-commands`;
  const payload = JSON.stringify(command);

  console.log("topic from loginnnn", topic);
  console.log("payload from loginnnn", payload);

  await new Promise<void>((resolve, reject) => {
    client!.publish(topic, payload, { qos: 1 }, (err) =>
      err ? reject(err) : resolve(),
    );
  });
}

/**
 * Tell many feeders to START publishing weight (device firmware must support this)
 * Publishes to: feeders/{thingName}/commands
 */
export async function publishWeightStreamStartMany(
  thingNames: string[],
): Promise<void> {
  await Promise.all(
    thingNames.map((thingName) =>
      publishFeederWeightCommand(thingName, {
        type: "WEIGHT_STREAM_START",
        thingName,
      } as any),
    ),
  );
}

/**
 * Tell many feeders to STOP publishing weight (device firmware must support this)
 * Publishes to: feeders/{thingName}/commands
 */
export async function publishWeightStreamStopMany(
  thingNames: string[],
): Promise<void> {
  await Promise.all(
    thingNames.map((thingName) =>
      publishFeederWeightCommand(thingName, {
        type: "WEIGHT_STREAM_STOP",
      } as any),
    ),
  );
}
