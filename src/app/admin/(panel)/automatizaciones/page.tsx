import { Suspense } from "react";
import { runJobsAction, saveAutomationAction } from "@/app/admin/actions";
import { ActionForm } from "@/components/admin/action-form";
import { Card, Loading, PageTitle, btn, btnGhost, dateTime, field } from "@/components/admin/ui";
import { automationInfo, getSettings, type AutomationType } from "@/server/automations";
import { requireAdmin } from "@/server/auth";
import { query } from "@/server/db";

export default function AutomationsPage() {
  return (
    <>
      <PageTitle
        aside={
          <ActionForm action={runJobsAction}>
            <button className={btnGhost}>Procesar pendientes ahora</button>
          </ActionForm>
        }
      >
        Automatizaciones
      </PageTitle>
      <Suspense fallback={<Loading />}>
        <Automations />
      </Suspense>
    </>
  );
}

const order: AutomationType[] = [
  "comprobante_recibido",
  "recordatorio_pago",
  "ultimo_aviso_pago",
  "pedido_vencido",
  "pago_validado",
  "pago_rechazado",
  "pedido_despachado",
  "pedido_entregado",
  "pedir_resena",
  "recompra",
  "stock_repuesto",
  "cotizacion_lista",
];

const humanDelay = (min: number) =>
  min === 0 ? "al instante" : min % 1440 === 0 ? `${min / 1440} días después` : min % 60 === 0 ? `${min / 60} h después` : `${min} min después`;

async function Automations() {
  await requireAdmin();
  const [settings, jobs] = await Promise.all([
    getSettings(),
    query<{ id: number; type: AutomationType; status: string; run_at: Date; result: string | null; code: string | null; first_name: string }>(
      `select j.id, j.type, j.status, j.run_at, j.result, o.code, c.first_name
       from automation_jobs j left join orders o on o.id = j.order_id left join customers c on c.id = j.customer_id
       order by j.run_at desc limit 40`,
    ),
  ]);
  const byType = new Map(settings.map((s) => [s.type, s]));

  return (
    <div className="space-y-6">
      <p className="max-w-3xl text-sm text-neutral-600">
        Variables disponibles: <code>{"{nombre}"}</code> <code>{"{codigo}"}</code> <code>{"{total}"}</code> <code>{"{metodo}"}</code>{" "}
        <code>{"{agencia}"}</code> <code>{"{guia}"}</code> <code>{"{perfume}"}</code> <code>{"{link}"}</code> <code>{"{vence}"}</code> (cotizaciones). WhatsApp solo entrega texto libre si el
        cliente escribió en las últimas 24 h; para escribir después necesitas una plantilla aprobada por Meta (pon su nombre abajo).
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        {order.map((type) => {
          const s = byType.get(type);
          if (!s) return null;
          const info = automationInfo[type];
          return (
            <Card key={type}>
              <ActionForm action={saveAutomationAction} className="space-y-3">
                <input type="hidden" name="type" value={type} />
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">
                      {info.label} {info.marketing && <span className="ml-1 rounded bg-violet-100 px-1.5 text-xs font-normal text-violet-800">promocional</span>}
                    </h3>
                    <p className="text-xs text-neutral-500">{info.when} · {humanDelay(s.delay_minutes)}</p>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="enabled" defaultChecked={s.enabled} /> Activa
                  </label>
                </div>
                <textarea name="template" rows={3} defaultValue={s.template} className={field} />
                <div className="flex flex-wrap items-end gap-3">
                  <label className="text-xs text-neutral-600">
                    Esperar (minutos)
                    <input name="delay" type="number" min="0" defaultValue={s.delay_minutes} className={`${field} mt-1 w-28`} />
                  </label>
                  <label className="flex-1 text-xs text-neutral-600">
                    Plantilla de Meta (opcional)
                    <input name="waTemplate" defaultValue={s.wa_template ?? ""} placeholder="ej. recordatorio_pago" className={`${field} mt-1`} />
                  </label>
                  <button className={btn}>Guardar</button>
                </div>
              </ActionForm>
            </Card>
          );
        })}
      </div>

      <Card title="Últimos mensajes programados">
        {jobs.length === 0 ? (
          <p className="text-sm text-neutral-500">Todavía no hay mensajes programados.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-neutral-500">
                <tr>
                  <th className="py-2 pr-4">Cuándo</th>
                  <th className="py-2 pr-4">Mensaje</th>
                  <th className="py-2 pr-4">Pedido / cliente</th>
                  <th className="py-2">Resultado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {jobs.map((j) => (
                  <tr key={j.id}>
                    <td className="py-2 pr-4 whitespace-nowrap text-neutral-500">{dateTime(j.run_at)}</td>
                    <td className="py-2 pr-4">{automationInfo[j.type]?.label ?? j.type}</td>
                    <td className="py-2 pr-4">{j.code ?? j.first_name}</td>
                    <td className="py-2">
                      <span className={j.status === "error" ? "text-red-700" : j.status === "pendiente" ? "text-amber-700" : ""}>{j.status}</span>
                      {j.result && <span className="block text-xs text-neutral-500">{j.result}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
