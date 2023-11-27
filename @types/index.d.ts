import { NextFunction, Request, Response } from "express";
import { ParamsDictionary } from "express-serve-static-core";
import QueryString from "qs";

//Chat Types
export type MessageObject = {
  timestamp: string | Date;
  type: "text" | "image" | "document" | "voice"; //TODO: More to be added later i.e. Video
  text: string;
  sender_id: string;
  id?: ObjectId;
  seenByRecipients?: ObjectId[];
  edited?: boolean;
  deletedFor?: ObjectId[];
} & (
  | {
      type: "image" | "document";
      attachments?: {
        name: string;
        size: number; //Size in bytes
        key: string;
      }[];
    }
  | {
      type: "voice";
      //TODO: Tend to include more values based on UI requirement
      source: string; //URL of audio source
    }
);

export type MessageUpdate = {
  text: string;
};

// API Types
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      emailAddress?: string;
    }
  }
}

export type MiddleWare = (
  req: Request<ParamsDictionary, any, any, QueryString.ParsedQs, Record<string, any>>,
  res: Response<any>,
  next: NextFunction,
) => void;

export type RequestHandler = (req: Request, res: Response) => void;
