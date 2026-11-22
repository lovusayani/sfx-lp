import { Router } from "express";

import { requireLicense, requireSeat } from "../middlewares/license.middleware";
import { getChargeSummary, getTrades, getWalletOverview } from "../controllers/trades.controller";
import { protect } from "../middlewares/auth.middleware";

const router = Router();

router.use(protect, requireSeat);

router.get("/", requireLicense, getTrades);
router.get("/charges/summary", getChargeSummary);
router.get("/wallet-overview", getWalletOverview);

export default router;
