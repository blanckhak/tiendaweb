import { after } from "next/server";
import { handleInbound, type Inbound } from "@/server/bot";
import { downloadMedia, verifySignature } from "@/server/whatsapp";

export const maxDuration = 60;

/** Verificación del webhook: Meta llama con hub.challenge al configurarlo. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const ok =
    url.searchParams.get("hub.mode") === "subscribe" &&
    !!process.env.WHATSAPP_VERIFY_TOKEN &&
    url.searchParams.get("hub.verify_token") === process.env.WHATSAPP_VERIFY_TOKEN;
  return ok ? new Response(url.searchParams.get("hub.challenge") ?? "") : new Response("Forbidden", { status: 403 });
}

type WaMessage = {
  id: string;
  from: string;
  type: string;
  text?: { body: string };
  image?: { id: string; mime_type: string; caption?: string };
  document?: { id: string; mime_type: string; caption?: string };
  button?: { text: string };
  interactive?: { button_reply?: { title: string }; list_reply?: { title: string } };
};

type WaPayload = {
  entry?: { changes?: { value?: { contacts?: { wa_id: string; profile?: { name?: string } }[]; messages?: WaMessage[] } }[] }[];
};

/** Mensajes entrantes. Se responde 200 enseguida y se procesa después (Meta reintenta si tardamos). */
export async function POST(request: Request) {
  const raw = await request.text();
  if (!verifySignature(raw, request.headers.get("x-hub-signature-256"))) {
    return new Response("Invalid signature", { status: 401 });
  }

  let payload: WaPayload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const messages = (payload.entry ?? []).flatMap((e) =>
    (e.changes ?? []).flatMap((c) => {
      const names = new Map((c.value?.contacts ?? []).map((ct) => [ct.wa_id, ct.profile?.name]));
      return (c.value?.messages ?? []).map((m) => ({ m, name: names.get(m.from) }));
    }),
  );

  after(async () => {
    for (const { m, name } of messages) {
      try {
        const file = m.image ?? m.document;
        const msg: Inbound = {
          from: m.from,
          name,
          waId: m.id,
          kind: m.type,
          text: m.text?.body ?? m.button?.text ?? m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? file?.caption,
          media: file ? (await downloadMedia(file.id)) ?? undefined : undefined,
        };
        await handleInbound(msg);
      } catch (e) {
        console.error("[whatsapp] error procesando mensaje", m.id, e);
      }
    }
  });

  return new Response("OK");
}
