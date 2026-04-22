import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import usersRouter from "./users.js";
import jobsRouter from "./jobs.js";
import announcementsRouter from "./announcements.js";
import aiRouter from "./ai.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/users", usersRouter);
router.use("/jobs", jobsRouter);
router.use("/announcements", announcementsRouter);
router.use("/ai", aiRouter);

export default router;
