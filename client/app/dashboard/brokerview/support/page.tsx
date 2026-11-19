import { redirect } from "next/navigation";

/** Trading support now lives on the shared Support page. */
export default function TradeSupportPage() {
  redirect("/dashboard/support");
}
