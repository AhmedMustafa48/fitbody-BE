import { Router } from "express";
import {
  getFeesOverview,
  collectFee,
  getMemberFees,
  deleteFee,
} from "../controllers/fee.controller.js";
import { protect } from "../middleware/auth.js";

const router = Router();

router.use(protect);

router.get("/", getFeesOverview);
router.get("/member/:memberId", getMemberFees);
router.post("/collect", collectFee);
router.delete("/:id", deleteFee);

export default router;
