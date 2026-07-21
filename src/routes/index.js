import { Router } from "express";
import authRoutes from "./auth.routes.js";
import memberRoutes from "./member.routes.js";
import attendanceRoutes from "./attendance.routes.js";
import feeRoutes from "./fee.routes.js";
import dashboardRoutes from "./dashboard.routes.js";

const router = Router();

router.get("/health", (_req, res) => res.json({ status: "ok" }));

router.use("/auth", authRoutes);
router.use("/members", memberRoutes);
router.use("/attendance", attendanceRoutes);
router.use("/fees", feeRoutes);
router.use("/dashboard", dashboardRoutes);

export default router;
