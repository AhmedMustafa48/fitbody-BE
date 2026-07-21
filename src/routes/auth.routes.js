import { Router } from "express";
import { login, me, logout } from "../controllers/auth.controller.js";
import { protect } from "../middleware/auth.js";

const router = Router();

router.post("/login", login);
router.get("/me", protect, me);
router.post("/logout", protect, logout);

export default router;
