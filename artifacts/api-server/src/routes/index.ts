import { Router, type IRouter } from "express";
import healthRouter from "./health";
import projectsRouter from "./projects";
import membersRouter from "./members";
import issuesRouter from "./issues";
import activitiesRouter from "./activities";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(dashboardRouter);
router.use(projectsRouter);
router.use(membersRouter);
router.use(issuesRouter);
router.use(activitiesRouter);

export default router;
