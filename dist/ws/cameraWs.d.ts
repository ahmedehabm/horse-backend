import { WebSocketServer } from "ws";
export declare function setupCameraWs(wss: WebSocketServer): void;
export declare function getLatestFrame(horseId: string): Buffer | null;
export declare function disconnectCamera(thingName: string): boolean;
//# sourceMappingURL=cameraWs.d.ts.map