import { Router, type IRouter, type Request, type Response } from "express";
import { recordSecurityEvent } from "../lib/security-events.ts";
import {
  createDemoSession,
  deleteDemoSession,
  DEMO_SESSION_COOKIE,
  getDemoSession,
  DemoCapacityError,
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

  let sessionId: string;
  try { sessionId = createDemoSession(); } catch (error) {
    if (!(error instanceof DemoCapacityError)) throw error;
    recordSecurityEvent("demo_capacity");
    res.setHeader("Retry-After", "60");
    res.status(429).json({ error: "Demo is temporarily at capacity. Please retry later." });
    return;
  }
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