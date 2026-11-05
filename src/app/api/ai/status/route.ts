import { connection } from "next/server";
import { aiEnabled } from "@/lib/ai/server";

export async function GET() {
  // Evaluate at request time so the flag reflects the server's current env vars.
  await connection();
  return Response.json({ ai: aiEnabled(), shopping: Boolean(process.env.SERPAPI_API_KEY) });
}
