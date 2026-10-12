import { CODER_TRACKER_HTML } from "@/lib/coder-tracker-html";

export const runtime = "nodejs";
export const dynamic = "force-static";

/**
 * Serves the Coder Coding Tracker tool document. Auth + role access are enforced
 * by middleware (path /coder-coding-tracker → capability "coder-tracker"), so
 * unlike a file in /public this is NOT reachable without signing in.
 */
export async function GET() {
  return new Response(CODER_TRACKER_HTML, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
