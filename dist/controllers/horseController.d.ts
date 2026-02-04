import { type NextFunction, type Request, type Response } from "express";
export declare const getAllHorses: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const getMyHorses: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const getHorse: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const createHorse: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const updateHorse: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const deleteHorse: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const restrictToHorseOwner: (req: any, res: any, next: NextFunction) => Promise<void>;
export declare const bulkAssignHorsesToUser: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getFeedingActiveStatus: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=horseController.d.ts.map