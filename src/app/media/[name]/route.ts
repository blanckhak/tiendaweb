import { getFile } from "@/server/storage";

/** Fotos públicas de productos guardadas localmente (en Supabase se sirven desde su CDN). */
export async function GET(_request: Request, ctx: RouteContext<"/media/[name]">) {
  const { name } = await ctx.params;
  const file = await getFile(`public/${name}`);
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(file.data), {
    headers: { "Content-Type": file.contentType, "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
