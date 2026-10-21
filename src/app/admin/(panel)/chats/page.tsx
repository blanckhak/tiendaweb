import Link from "next/link";
import { Suspense } from "react";
import { Card, Loading, PageTitle, dateTime } from "@/components/admin/ui";
import { displayPhone } from "@/lib/phone";
import { requireAdmin } from "@/server/auth";
import { query } from "@/server/db";

export default function ChatsPage({ searchParams }: PageProps<"/admin/chats">) {
  return (
    <>
      <PageTitle>Chats de WhatsApp</PageTitle>
      <Suspense fallback={<Loading />}>
        <Chats searchParams={searchParams} />
      </Suspense>
    </>
  );
}

type Row = {
  id: number;
  phone: string;
  first_name: string;
  last_name: string;
  bot_paused: boolean;
  body: string;
  kind: string;
  direction: "in" | "out";
  author: string;
  created_at: Date;
};

async function Chats({ searchParams }: Pick<PageProps<"/admin/chats">, "searchParams">) {
  await requireAdmin();
  const onlyHuman = (await searchParams).filtro === "humano";
  const rows = await query<Row>(
    `select c.id, c.phone, c.first_name, c.last_name, c.bot_paused, m.body, m.kind, m.direction, m.author, m.created_at
     from customers c
     join lateral (select * from wa_messages where customer_id = c.id order by id desc limit 1) m on true
     ${onlyHuman ? "where c.bot_paused" : ""}
     order by m.created_at desc limit 100`,
  );

  return (
    <>
      <div className="mb-4 flex gap-2">
        <Link href="/admin/chats" className={`rounded-full border px-3 py-1 text-sm ${!onlyHuman ? "border-ink bg-ink text-white" : "border-line bg-white"}`}>
          Todos
        </Link>
        <Link href="/admin/chats?filtro=humano" className={`rounded-full border px-3 py-1 text-sm ${onlyHuman ? "border-ink bg-ink text-white" : "border-line bg-white"}`}>
          Esperan a una persona
        </Link>
      </div>
      <Card>
        {rows.length === 0 ? (
          <p className="text-sm text-neutral-500">
            Aún no hay conversaciones. Prueba el <Link href="/admin/simulador" className="underline">simulador de WhatsApp</Link>.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((r) => (
              <li key={r.id}>
                <Link href={`/admin/chats/${r.id}`} className="flex items-start gap-3 py-3 hover:bg-neutral-50">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-neutral-200 text-sm font-semibold">
                    {(r.first_name || "?").slice(0, 1).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium">
                        {r.first_name || r.last_name ? `${r.first_name} ${r.last_name}` : displayPhone(r.phone)}
                        {r.bot_paused && <span className="ml-2 rounded bg-amber-100 px-1.5 text-xs text-amber-800">atiende una persona</span>}
                      </span>
                      <span className="shrink-0 text-xs text-neutral-500">{dateTime(r.created_at)}</span>
                    </span>
                    <span className="block truncate text-sm text-neutral-600">
                      {r.direction === "out" ? `${r.author === "bot" ? "🤖" : r.author === "humano" ? "Tú" : "⚙️"}: ` : ""}
                      {r.body || `[${r.kind}]`}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
