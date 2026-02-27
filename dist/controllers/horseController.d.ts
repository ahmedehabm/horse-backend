import { type NextFunction, type Request, type Response } from "express";
export declare const uploadImage: import("express").RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
export declare const getAllHorses: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getMyHorses: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getHorse: (req: Request, res: Response, next: NextFunction) => Promise<void | Response<any, Record<string, any>>>;
export declare const createHorse: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const updateHorse: (req: Request, res: Response, next: NextFunction) => Promise<void | Response<any, Record<string, any>>>;
/**
 * DELETE /horses/:id?deleteDevices=true|false
 *
 * - deleteDevices=false (default): delete horse only (devices remain)
 * - deleteDevices=true: delete horse + connected feeder/camera (transaction)
 */
export declare const deleteHorse: (req: Request, res: Response, next: NextFunction) => Promise<void | Response<any, Record<string, any>>>;
export declare function getHorsesStats(req: Request, res: Response, next: NextFunction): Promise<void>;
//# sourceMappingURL=horseController.d.ts.map