import { NextFunction, Request, Response } from "express";
import { ParamsDictionary } from "express-serve-static-core";
import QueryString from "qs";

declare global {
    namespace Express {
        interface Request {
            userId?: string;
            emailAddress?: string;
        }
    }
}

export type MiddleWare = (req: Request<ParamsDictionary, any, any, QueryString.ParsedQs, Record<string, any>>, res: Response<any>, next: NextFunction) => void

export type RequestHandler = (req: Request, res: Response) => void