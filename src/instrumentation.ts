// En desarrollo procesa los mensajes programados cada minuto, sin necesitar un cron.
// En producción lo hace Vercel Cron llamando a /api/cron/automatizaciones (ver vercel.json).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NODE_ENV !== "development") return;
  const g = globalThis as unknown as { __aurumJobs?: NodeJS.Timeout };
  if (g.__aurumJobs) return;
  g.__aurumJobs = setInterval(async () => {
    try {
      const { runDueJobs } = await import("./server/automations");
      const done = await runDueJobs();
      if (done.length) console.log(`[automatizaciones] ${done.length} procesados`, done.map((d) => `${d.type}: ${d.result}`));
    } catch (e) {
      console.error("[automatizaciones]", e);
    }
  }, 60_000);
}
