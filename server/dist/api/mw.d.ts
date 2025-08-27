import { Request, Response, NextFunction } from "express";
export declare function apiAuth(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
export declare function logApiUsage(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function ok<T>(res: Response, data: T): Response<any, Record<string, any>>;
export declare function fail(res: Response, status: number, error: string, details?: any): Response<any, Record<string, any>>;
//# sourceMappingURL=mw.d.ts.map