import { NextFunction, Request, Response } from "express";

import { claimOrCheckSeat, getLicense, LICENSE_ERROR_CODE, toPublic } from "../services/license.service";

const pending = async (res: Response) =>
  res.status(402).json({
    code: LICENSE_ERROR_CODE,
    message: "API payment pending",
    license: toPublic(await getLicense()),
  });

/** Blocks a whole route group while the licence is locked (used for selected admin sections). */
export const requireLicense = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    if ((await getLicense()).locked) return void (await pending(res));
    next();
  } catch (e) {
    next(e);
  }
};

/** After `protect`: while locked, only the single seated LP account may use the API. */
export const requireSeat = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return next();
    if (!(await claimOrCheckSeat(req.user._id, req.user.role))) return void (await pending(res));
    next();
  } catch (e) {
    next(e);
  }
};

export const sendLicensePending = pending;
