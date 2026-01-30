import type WebSocket from "ws";
import type { RequestHandler } from "express";
import "express-serve-static-core";

declare module "express-serve-static-core" {
  interface Application {
    ws: (
      path: string,
      handler: (ws: WebSocket, req: any, next?: () => void) => void,
    ) => Application;
  }
}

declare module "express-serve-static-core" {
  interface Request {
    user: {
      id: string;
      role: "ADMIN" | "USER";
      email: string;
    };
  }
}
