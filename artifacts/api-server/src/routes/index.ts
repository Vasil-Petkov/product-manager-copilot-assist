import { Router, type IRouter } from "express";
import healthRouter from "./health";
import dashboardRouter from "./dashboard";
import opportunitiesRouter from "./opportunities";
import signalsRouter from "./signals";
import competitorsRouter from "./competitors";
import meetingsRouter from "./meetings";
import feedbackRouter from "./feedback";
import insightsRouter from "./insights";
import prioritizationRouter from "./prioritization";
import openaiConversationsRouter from "./openai-conversations";

const router: IRouter = Router();

router.use(healthRouter);
router.use(dashboardRouter);
router.use(opportunitiesRouter);
router.use(signalsRouter);
router.use(competitorsRouter);
router.use(meetingsRouter);
router.use(feedbackRouter);
router.use(insightsRouter);
router.use(prioritizationRouter);
router.use(openaiConversationsRouter);

export default router;
