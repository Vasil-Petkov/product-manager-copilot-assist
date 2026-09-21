import { Router, type IRouter, type Request, type Response } from "express";
import {
  createDemoSession,
  deleteDemoSession,
  DEMO_SESSION_COOKIE,
  getDemoSession,
} from "../lib/demoSession.ts";

const router: IRouter = Router();

const demoCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

router.post("/demo/session", (req: Request, res: Response) => {
  deleteDemoSession(req.cookies?.[DEMO_SESSION_COOKIE] as string | undefined);

  const sessionId = createDemoSession();
  res.cookie(DEMO_SESSION_COOKIE, sessionId, demoCookieOptions);
  res.status(201).json({ active: true });
});

router.post("/demo/session/exit", (req: Request, res: Response) => {
  deleteDemoSession(req.cookies?.[DEMO_SESSION_COOKIE] as string | undefined);
  res.clearCookie(DEMO_SESSION_COOKIE, { path: "/" });
  res.json({ active: false });
});

router.get("/demo/session", (req: Request, res: Response) => {
  const session = getDemoSession(
    req.cookies?.[DEMO_SESSION_COOKIE] as string | undefined,
  );
  res.json({ active: Boolean(session) });
});

export default router;