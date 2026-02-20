import type { Request, Response, NextFunction } from "express";
/**
 * 1) GET /api/v1/devices/options?type=FEEDER|CAMERA&unassigned=true
 * Minimal select for select-options (id + label + thingName)
 */
export declare const getDeviceOptions: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * 2) GET /api/v1/devices/my/feeders?page=1&limit=10
 *
 * If req.user.role === "ADMIN" => this route is not meant for him (403)
 * else => use req.user.id and return feeders assigned to THIS user's horses
 * (includes horse name so user can edit morning/day/night times)
 */
export declare const getMyFeeders: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getMyFeeder: (req: Request, res: Response, next: NextFunction) => Promise<void | Response<any, Record<string, any>>>;
export declare const updateMyFeeder: (req: Request, res: Response, next: NextFunction) => Promise<void | Response<any, Record<string, any>>>;
/**
 * 3) GET /api/v1/devices?type=FEEDER|CAMERA&page=1&limit=20
 * Admin devices table with pagination + optional filters.
 */
export declare const getAllDevices: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * POST /api/v1/devices
 * Body:
 *  - thingLabel (unique)
 *  - deviceType: CAMERA | FEEDER
 *  - location
 *  - feederType/morningTime/dayTime/nightTime (only for FEEDER)
 *
 */
export declare const createDevice: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=deviceController.d.ts.map