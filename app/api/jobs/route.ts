import { timingSafeEqual } from "node:crypto";
import { runJobs } from "@/lib/jobs";
import { failure, json } from "@/lib/api";
export const maxDuration = 60;
export async function GET(req: Request) {
  const expected = `Bearer ${process.env.CRON_SECRET || ""}`;
  const actual = req.headers.get("authorization") || "";
  if (
    !process.env.CRON_SECRET ||
    actual.length !== expected.length ||
    !timingSafeEqual(Buffer.from(actual), Buffer.from(expected))
  )
    return json({ error: "Unauthorized" }, 401);
  try {
    return json(await runJobs());
  } catch (e) {
    return failure(e);
  }
}
