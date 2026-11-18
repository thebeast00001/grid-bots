import { redirect } from "next/navigation";
import { listProviders } from "@/lib/models/providers-repo";

export const dynamic = "force-dynamic";

/** First run → connect a model; otherwise make a bot (Task 7 sends returning users to their bots). */
export default async function Home() {
  const providers = await listProviders();
  redirect(providers.length === 0 ? "/welcome" : "/new");
}
