import { Router } from "express";
import { body } from "express-validator";

import {
  changePassword,
  forgotPassword,
  login,
  logout,
  me,
  refresh,
  register,
  resendOtp,
  resetPassword,
  setTwoFactorEmail,
  verifyOtp,
} from "../controllers/auth.controller";
import { protect } from "../middlewares/auth.middleware";
import { validateRequest } from "../middlewares/validate.middleware";

const router = Router();

router.get("/login", (_req, res) => {
  return res.status(405).json({
    message: "Use POST /api/auth/login with email and password.",
  });
});

router.post(
  "/login",
  [body("email").isEmail(), body("password").isString().isLength({ min: 8 })],
  validateRequest,
  login
);

router.post("/refresh", refresh);
router.post("/logout", protect, logout);
router.get("/me", protect, me);
router.post(
  "/change-password",
  protect,
  [
    body("currentPassword").isString().isLength({ min: 8 }),
    body("newPassword").isString().isLength({ min: 8 }),
  ],
  validateRequest,
  changePassword
);

router.post(
  "/register",
  [
    body("fullName").isString().trim().isLength({ min: 2, max: 80 }),
    body("email").isEmail(),
    body("phone").isString().trim().isLength({ min: 6, max: 20 }),
    body("password").isString().isLength({ min: 12, max: 128 }),
  ],
  validateRequest,
  register
);
router.post(
  "/verify-otp",
  [body("email").isEmail(), body("code").isString().matches(/^\d{6}$/), body("purpose").isIn(["register", "login"])],
  validateRequest,
  verifyOtp
);
router.post("/resend-otp", [body("email").isEmail(), body("purpose").isIn(["register", "login"])], validateRequest, resendOtp);
router.post("/forgot-password", [body("email").isEmail()], validateRequest, forgotPassword);
router.post(
  "/reset-password",
  [body("token").isString(), body("newPassword").isString().isLength({ min: 12, max: 128 })],
  validateRequest,
  resetPassword
);
router.post("/two-factor", protect, [body("enabled").isBoolean()], validateRequest, setTwoFactorEmail);

export default router;
