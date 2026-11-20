import { apiFetch } from "./api";

export type BrandingLogoVariant = "dark" | "light" | "mobile";

export interface BrandingAssets {
  appName?: string;
  shortName?: string;
  darkLogoPath: string;
  lightLogoPath: string;
  mobileLogoPath: string;
  appTheme?: "dark" | "light" | "system";
  allowUserTheme?: boolean;
}

export const getBrandingAssets = async (): Promise<BrandingAssets> => {
  const data = await apiFetch<{ branding: BrandingAssets }>("/branding/logos", {
    method: "GET",
    auth: false,
  });

  return data.branding;
};

export const uploadAdminBrandingLogo = async (
  variant: BrandingLogoVariant,
  file: File
): Promise<BrandingAssets> => {
  const formData = new FormData();
  formData.append("logo", file);

  const data = await apiFetch<{ branding: BrandingAssets }>(`/admin/setup/logos/${variant}`, {
    method: "POST",
    formData,
  });

  return data.branding;
};
export const updateAppTheme = async (appTheme: "dark" | "light" | "system", allowUserTheme: boolean): Promise<BrandingAssets> => {
  const data = await apiFetch<{ branding: BrandingAssets }>("/admin/setup/theme", {
    method: "PATCH",
    body: { appTheme, allowUserTheme },
  });
  return data.branding;
};

export const updateBrandingName = async (appName: string, shortName: string): Promise<BrandingAssets> => {
  const data = await apiFetch<{ branding: BrandingAssets }>("/admin/setup/branding-name", {
    method: "PATCH",
    body: { appName, shortName },
  });
  return data.branding;
};
