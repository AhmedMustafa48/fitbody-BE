import { Router } from "express";
import {
  getMembers,
  getMember,
  getMemberProfile,
  createMember,
  updateMember,
  deleteMember,
} from "../controllers/member.controller.js";
import { protect } from "../middleware/auth.js";

const router = Router();

router.use(protect);

router.get("/", getMembers);
router.get("/:id/profile", getMemberProfile);
router.get("/:id", getMember);
router.post("/", createMember);
router.put("/:id", updateMember);
router.delete("/:id", deleteMember);

export default router;
