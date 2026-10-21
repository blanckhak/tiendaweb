import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { respondComplaintAction } from "@/app/admin/actions";
import { ActionForm } from "@/components/admin/action-form";
import { Card, Loading, PageTitle, btn, btnGhost, field } from "@/components/admin/ui";
import { requireAdmin } from "@/server/auth";
import { complaintHtml, getComplaint } from "@/server/complaints";
import { emailEnabled } from "@/server/email";

export default function ComplaintPage({ params }: PageProps<"/admin/reclamaciones/[code]">) {
  return (
    <Suspense fallback={<Loading />}>
      <Complaint params={params} />
    </Suspense>
  );
}

async function Complaint({ params }: Pick<PageProps<"/admin/reclamaciones/[code]">, "params">) {
  await requireAdmin();
  const c = await getComplaint(decodeURIComponent((await params).code));
  if (!c) notFound();
  return (
    <>
      <PageTitle aside={<Link href="/admin/reclamaciones" className={btnGhost}>← Libro de Reclamaciones</Link>}>Hoja N° {c.code}</PageTitle>
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* HTML generado en el servidor con los datos del consumidor escapados. */}
        <Card><div className="text-sm" dangerouslySetInnerHTML={{ __html: complaintHtml(c) }} /></Card>
        <Card title={c.status === "pendiente" ? "Responder" : "Actualizar respuesta"}>
          <ActionForm action={respondComplaintAction} confirm="La respuesta se registrará con la fecha de hoy. ¿Continuar?" className="space-y-3">
            <input type="hidden" name="code" value={c.code} />
            <textarea
              name="response"
              rows={8}
              required
              defaultValue={c.response ?? ""}
              placeholder="Observaciones y acciones adoptadas por el proveedor…"
              className={field}
            />
            <button className={btn}>Registrar respuesta</button>
          </ActionForm>
          <p className="mt-3 text-xs text-neutral-500">
            {emailEnabled()
              ? `Se enviará por correo a ${c.email}.`
              : `El envío de correos no está configurado (RESEND_API_KEY): envía la respuesta manualmente a ${c.email}.`}
          </p>
        </Card>
      </div>
    </>
  );
}
