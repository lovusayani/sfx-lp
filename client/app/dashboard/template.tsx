/** Re-mounts on every page change inside the signed-in app, so each screen eases in. */
export default function DashboardTemplate({ children }: { children: React.ReactNode }) {
  return <div className="sfx-page-in">{children}</div>;
}
