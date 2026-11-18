import { redirect } from "next/navigation";
import { listBots } from "@/lib/bots/repo";
import { listProviders } from "@/lib/models/providers-repo";

export const dynamic = "force-dynamic";

/** First run → connect a model → make a bot; afterwards, straight to the most recent bot. */
export default async function Home() {
  if ((await listProviders()).length === 0) redirect("/welcome");
  const [latest] = await listBots();
  redirect(latest ? `/bots/${latest.id}` : "/new");
}
