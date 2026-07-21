import { Router } from "express";
import {
  markAttendance,
  getAttendance,
  getMemberAttendance,
} from "../controllers/attendance.controller.js";
import { protect } from "../middleware/auth.js";

const router = Router();

router.use(protect);

router.get("/",                          getAttendance);
router.get("/member/:memberId",          getMemberAttendance);
router.post("/",                         markAttendance);

export default router;
