import { Router } from "express";
import { param } from "express-validator";

import { getPrivateFile } from "../controllers/files.controller";
import { protect } from "../middlewares/auth.middleware";
import { validateRequest } from "../middlewares/validate.middleware";

const router = Router();

router.get(
  "/private/:name",
  protect,
  [param("name").matches(/^[A-Za-z0-9_-]+\.[A-Za-z0-9]{2,5}$/)],
  validateRequest,
  getPrivateFile
);

export default router;
