import { errorResponse } from "@/lib/http";
import { listNotifications, unreadCounts } from "@/lib/notifications/repo";

export const dynamic = "force-dynamic";

/** The inbox: newest 100, plus unread counts per bot. */
export async function GET() {
  try {
    const [notifications, unread] = await Promise.all([listNotifications(100), unreadCounts()]);
    return Response.json({ notifications, unread });
  } catch (e) {
    return errorResponse(e);
  }
}
