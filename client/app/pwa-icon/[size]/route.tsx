import { ImageResponse } from "next/og";

export const dynamic = "force-static";

const SIZES = [64, 180, 192, 512] as const;

export function generateStaticParams() {
  return SIZES.map((size) => ({ size: String(size) }));
}

/**
 * App icon (installable app, home screen, notifications): gold medallion with an "S" on the dark
 * background. Drawn in code so it stays sharp; the mark sits inside the safe zone for "maskable".
 */
export async function GET(_req: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size: raw } = await params;
  const size = SIZES.includes(Number(raw) as (typeof SIZES)[number]) ? Number(raw) : 192;
  const coin = Math.round(size * 0.62);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0b0c0a",
        }}
      >
        <div
          style={{
            width: coin,
            height: coin,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "radial-gradient(circle at 35% 30%, #fff1a8 0%, #f5d34f 45%, #a88c31 100%)",
            boxShadow: "inset 0 0 0 4px rgba(20,21,17,0.25)",
            color: "#141511",
            fontSize: Math.round(coin * 0.62),
            fontWeight: 800,
            lineHeight: 1,
          }}
        >
          S
        </div>
      </div>
    ),
    { width: size, height: size }
  );
}
