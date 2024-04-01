import { Session, SessionData } from "express-session";

declare module "express-session" {
  interface SessionData {
    userId: string;
  }
}

declare module 'http' {
  interface IncomingMessage {
    cookieHolder?: string;
    session: Session & Partial<SessionData>;
  }
}

export {};
