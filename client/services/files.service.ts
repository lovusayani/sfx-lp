import { API_BASE, getPublicAssetUrl } from "./api";
import { getSession } from "./session.service";

export const isPrivateRef = (ref?: string | null): boolean => Boolean(ref && ref.startsWith("private/"));

/** Fetches a private file with the signed-in user's token and returns a temporary blob: URL. */
export const fetchPrivateFileUrl = async (ref: string): Promise<string> => {
  const token = getSession()?.accessToken;
  const name = ref.slice("private/".length);
  const response = await fetch(`${API_BASE}/files/private/${encodeURIComponent(name)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: "include",
  });
  if (!response.ok) throw new Error("File unavailable");
  return URL.createObjectURL(await response.blob());
};

/** Legacy public paths ("uploads/x" or "/uploads/x") still resolve to the public URL. */
export const publicFileUrl = (ref: string): string => getPublicAssetUrl(ref.startsWith("/") ? ref : `/${ref}`);

export const openFile = async (ref: string): Promise<void> => {
  const win = window.open("", "_blank", "noopener");
  try {
    const url = isPrivateRef(ref) ? await fetchPrivateFileUrl(ref) : publicFileUrl(ref);
    if (win) win.location.href = url;
    else window.location.href = url;
  } catch {
    win?.close();
    alert("This file could not be opened.");
  }
};
