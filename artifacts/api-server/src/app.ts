import express, { type Express } from "express";
import { rateLimitPool } from "@workspace/db";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import { authMiddleware } from "./middlewares/authMiddleware";
import { demoSessionMiddleware } from "./middlewares/demoSession";
import router from "./routes";
import { errorHandler } from "./middlewares/errorHandler";
import { logger } from "./lib/logger";
import { readSecurityConfig } from "./lib/security-config";
import { securityCors } from "./middlewares/security-cors";
import { securityRateLimit } from "./middlewares/security-rate-limit";
import { PostgresRateLimitStore } from "./lib/rate-limit-store";

const app: Express = express();
const security = readSecurityConfig();
const counterSecret = process.env.SESSION_SECRET ?? "";
const rateStore = new PostgresRateLimitStore(rateLimitPool);
const reportStoreFailure = () => logger.warn({ event: "rate_store_unavailable" }, "Request protection unavailable");
app.set("trust proxy", security.isTrustedProxy);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(securityCors(security.origins));
app.use("/api", securityRateLimit(rateStore, security.policies, "public", counterSecret, reportStoreFailure));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(demoSessionMiddleware);
app.use(authMiddleware);
app.use("/api", securityRateLimit(rateStore, security.policies, "authenticated", counterSecret, reportStoreFailure));

app.use("/api", router);

// Global error handler — must be last
app.use(errorHandler);

export default app;
