export const formatMoney = (value: number | undefined | null, opts: { sign?: boolean; decimals?: number } = {}): string => {
  const n = Number(value || 0);
  const decimals = opts.decimals ?? 2;
  const abs = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  const sign = n < 0 ? "−" : opts.sign && n > 0 ? "+" : "";
  return `${sign}$${abs}`;
};

export const formatDate = (value?: string): string => {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

export const greeting = (date = new Date()): string => {
  const h = date.getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
};

export const firstName = (fullName?: string): string => (fullName || "").trim().split(/\s+/)[0] || "there";
