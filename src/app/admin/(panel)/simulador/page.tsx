import Link from "next/link";
import { Suspense } from "react";
import { simulateAction } from "@/app/admin/actions";
import { ActionForm } from "@/components/admin/action-form";
import { Card, Loading, PageTitle, btn, field } from "@/components/admin/ui";
import { requireAdmin } from "@/server/auth";
import { aiEnabled } from "@/server/bot";
import { query } from "@/server/db";
import { whatsappLive } from "@/server/whatsapp";

export default function SimulatorPage() {
  return (
    <>
      <PageTitle>Simulador de WhatsApp</PageTitle>
      <Suspense fallback={<Loading />}>
        <Simulator />
      </Suspense>
    </>
  );
}

async function Simulator() {
  await requireAdmin();
  const recent = await query<{ id: number; phone: string; first_name: string }>(
    `select distinct on (c.id) c.id, c.phone, c.first_name from customers c join wa_messages m on m.customer_id = c.id
     order by c.id desc limit 5`,
  );
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card title="Escribir como si fueras un cliente">
        <p className="mb-4 text-sm text-neutral-600">
          Prueba el bot y los pedidos sin conectar Meta. El mensaje entra igual que uno real de WhatsApp: si escribes el código de un pedido,
          el bot responde con los datos de pago; si adjuntas una imagen, se toma como comprobante.
          {whatsappLive() && <b className="text-amber-700"> Ojo: WhatsApp está conectado, las respuestas se enviarán de verdad a ese número.</b>}
        </p>
        <ActionForm action={simulateAction} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <input name="phone" required defaultValue="987654321" placeholder="Teléfono del cliente" className={field} />
            <input name="name" defaultValue="Cliente Prueba" placeholder="Nombre de perfil" className={field} />
          </div>
          <textarea name="text" rows={3} placeholder="Hola, busco un perfume dulce para mujer…" className={field} />
          <label className="block text-sm text-neutral-600">
            Adjuntar comprobante (opcional)
            <input name="file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="mt-1 block text-sm" />
          </label>
          <button className={btn}>Enviar al bot</button>
        </ActionForm>
        <p className="mt-4 text-xs text-neutral-500">
          {aiEnabled() ? "El bot responde con IA (Claude)." : "Sin ANTHROPIC_API_KEY el bot responde con un menú básico."}
        </p>
      </Card>
      <Card title="Ver la conversación">
        {recent.length === 0 ? (
          <p className="text-sm text-neutral-500">Envía un mensaje y aparecerá aquí.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {recent.map((c) => (
              <li key={c.id}>
                <Link href={`/admin/chats/${c.id}`} className="underline">
                  {c.first_name || "Cliente"} (+{c.phone})
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
