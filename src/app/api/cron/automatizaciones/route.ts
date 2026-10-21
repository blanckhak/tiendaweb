import { revalidateTag } from "next/cache";
import { runDueJobs } from "@/server/automations";
import { PRODUCTS_TAG } from "@/server/catalog";

export const maxDuration = 60;

/** Lo llama Vercel Cron (o cualquier cron externo) con "Authorization: Bearer <CRON_SECRET>". */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const results = await runDueJobs();
  // Un pedido vencido libera stock: la tienda debe mostrarlo.
  if (results.some((r) => r.type === "pedido_vencido")) revalidateTag(PRODUCTS_TAG, "max");
  return Response.json({ processed: results.length, results });
}
