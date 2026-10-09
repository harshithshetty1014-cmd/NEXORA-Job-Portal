import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import jobsRouter from "./jobs";
import companiesRouter from "./companies";
import applicationsRouter from "./applications";
import dashboardRouter from "./dashboard";
import { requireDatabase } from "../lib/errors";

const router: IRouter = Router();

router.use(healthRouter);
router.use(requireDatabase);
router.use(authRouter);
router.use(jobsRouter);
router.use(companiesRouter);
router.use(applicationsRouter);
router.use(dashboardRouter);

export default router;
