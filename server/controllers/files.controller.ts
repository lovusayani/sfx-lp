import fs from "fs";
import { Request, Response } from "express";

import { Deposite } from "../models/Deposite";
import { storageService } from "../services/storage.service";
import { asyncHandler } from "../utils/asyncHandler";

const KYC_FIELDS = ["companyProof", "panCard", "aadhaarCard", "selfie"] as const;

/**
 * GET /api/files/private/:name — streams a private file (KYC document or deposit proof).
 * Allowed for admins, or for the user the file belongs to. Everyone else gets 404.
 */
export const getPrivateFile = asyncHandler(async (req: Request, res: Response) => {
  const ref = `private/${String(req.params.name || "")}`;
  const absolutePath = storageService.resolvePrivate(ref);
  const notFound = () => res.status(404).json({ message: "Not found" });

  if (!req.user || !absolutePath || !fs.existsSync(absolutePath)) return notFound();

  let allowed = req.user.role === "admin";
  if (!allowed) {
    const docs = req.user.kycDocuments as Record<string, string | undefined> | undefined;
    allowed = KYC_FIELDS.some((f) => docs?.[f] === ref);
  }
  if (!allowed) {
    allowed = Boolean(await Deposite.exists({ user: req.user._id, screenshot: ref }));
  }
  // Same response whether the file is missing or not yours, so existence never leaks.
  if (!allowed) return notFound();

  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Disposition", "inline");
  return res.sendFile(absolutePath);
});
