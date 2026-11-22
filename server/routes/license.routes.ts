import { Router } from "express";

import { getLicense, toPublic } from "../services/license.service";

const router = Router();

/** Public: lets the app show the payment notice and payment page. Never exposes the sheet URL. */
router.get("/status", async (_req, res, next) => {
  try {
    res.setHeader("Cache-Control", "no-store");
    res.json({ license: toPublic(await getLicense()) });
  } catch (e) {
    next(e);
  }
});

export default router;
