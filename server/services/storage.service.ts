import fs from "fs";
import path from "path";

import { env } from "../config/env";

/** Stored reference prefix for private files, e.g. "private/selfie-123.jpg". */
export const PRIVATE_PREFIX = "private/";

export interface FileStorageService {
  ensureStoragePath(): void;
  getRelativePath(filename: string): string;
  getPrivateRef(filename: string): string;
  isPrivateRef(ref: string | undefined | null): boolean;
  resolvePrivate(ref: string): string | null;
}

const absolute = (dir: string) => (path.isAbsolute(dir) ? dir : path.join(process.cwd(), dir));

class LocalStorageService implements FileStorageService {
  constructor(private readonly baseDir: string, private readonly privateDir: string) {}

  ensureStoragePath(): void {
    for (const dir of [absolute(this.baseDir), absolute(this.privateDir)]) {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true, mode: 0o750 });
    }
  }

  /** Public file (logos, QR codes, avatars) served from /uploads. */
  getRelativePath(filename: string): string {
    return path.join(this.baseDir, filename).replace(/\\/g, "/");
  }

  getPrivateRef(filename: string): string {
    return `${PRIVATE_PREFIX}${filename}`;
  }

  isPrivateRef(ref: string | undefined | null): boolean {
    return Boolean(ref && ref.startsWith(PRIVATE_PREFIX));
  }

  /** Absolute path for a private ref, or null if the ref is malformed or escapes the private dir. */
  resolvePrivate(ref: string): string | null {
    if (!this.isPrivateRef(ref)) return null;
    const name = ref.slice(PRIVATE_PREFIX.length);
    if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9]{2,5}$/.test(name)) return null;
    const root = absolute(this.privateDir);
    const full = path.resolve(root, name);
    return full.startsWith(root + path.sep) ? full : null;
  }

  get privateRoot(): string {
    return absolute(this.privateDir);
  }
}

export const localFileStorage = new LocalStorageService(env.uploadDir, env.privateUploadDir);
export const storageService: FileStorageService = localFileStorage;
