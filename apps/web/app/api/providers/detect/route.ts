import { detectLocal } from "@/lib/models/detect";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(await detectLocal());
}
