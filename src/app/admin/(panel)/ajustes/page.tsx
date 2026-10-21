import { Suspense } from "react";
import { saveSettingsAction } from "@/app/admin/actions";
import { ActionForm } from "@/components/admin/action-form";
import { Card, Loading, PageTitle, btn, field } from "@/components/admin/ui";
import { displayPhone } from "@/lib/phone";
import { waLink } from "@/lib/wa-link";
import { requireAdmin } from "@/server/auth";
import { aiEnabled } from "@/server/bot";
import { getStoreSettings } from "@/server/settings";

export default function SettingsPage() {
  return (
    <>
      <PageTitle>Ajustes</PageTitle>
      <Suspense fallback={<Loading />}>
        <Settings />
      </Suspense>
    </>
  );
}

async function Settings() {
  await requireAdmin();
  const s = await getStoreSettings();
  const cloudApi = !!process.env.WHATSAPP_PHONE_NUMBER_ID;

  return (
    <ActionForm action={saveSettingsAction} className="max-w-2xl space-y-6">
      <Card title="WhatsApp de pedidos">
        <label className="block text-sm">
          <span className="mb-1 block text-neutral-600">Número que recibe los pedidos del carrito</span>
          <input name="whatsappNumber" required inputMode="tel" defaultValue={s.whatsappNumber} className={field} />
        </label>
        <p className="mt-2 text-xs text-neutral-500">
          Celular peruano (987654321) o número internacional con código de país, sin &quot;+&quot;. Actual:{" "}
          <a href={waLink(s.whatsappNumber)} target="_blank" rel="noopener noreferrer" className="underline">
            {displayPhone(s.whatsappNumber)} ↗
          </a>
        </p>
        <p className="mt-3 rounded-md bg-neutral-50 p-3 text-xs text-neutral-600">
          Al tocar &quot;Finalizar pedido&quot; el cliente abre un chat con este número y el mensaje del pedido ya escrito.
          {cloudApi && (
            <>
              {" "}
              <b>Importante:</b> el bot y las automatizaciones solo leen los mensajes del número conectado a la API de
              WhatsApp de Meta. Si pones aquí otro número, los pedidos llegarán a ese chat pero el bot no los procesará.
            </>
          )}
        </p>
      </Card>

      <Card title="Asistente con IA en la web">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="assistantEnabled" defaultChecked={s.assistantEnabled} className="accent-ink" />
          Mostrar el asesor de perfumes en la tienda
        </label>
        <p className="mt-2 text-xs text-neutral-500">
          {aiEnabled()
            ? "Recomienda perfumes del catálogo según notas, ocasión y presupuesto, con precios y stock reales."
            : "Falta ANTHROPIC_API_KEY (o BOT_AI=off): el asesor responde con búsquedas simples del catálogo, sin IA."}
        </p>
      </Card>

      <button className={btn}>Guardar ajustes</button>
    </ActionForm>
  );
}
