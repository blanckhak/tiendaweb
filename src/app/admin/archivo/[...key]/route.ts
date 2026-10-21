import { isAdmin } from "@/server/auth";
import { getFile } from "@/server/storage";

/** Comprobantes de pago: solo con sesión de admin. */
export async function GET(_request: Request, ctx: RouteContext<"/admin/archivo/[...key]">) {
  if (!(await isAdmin())) return new Response("Unauthorized", { status: 401 });
  const { key } = await ctx.params;
  const file = await getFile(key.join("/"));
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(file.data), {
    headers: { "Content-Type": file.contentType, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
}
