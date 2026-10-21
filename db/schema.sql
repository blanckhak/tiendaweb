-- Esquema de AURUM. Postgres estándar: se ejecuta igual en PGlite (local) y en Supabase.
-- Idempotente: se puede correr varias veces sin romper datos existentes.

create table if not exists products (
  id            serial primary key,
  slug          text not null unique,
  brand         text not null,
  name          text not null,
  gender        text not null check (gender in ('Hombre', 'Mujer', 'Unisex')),
  family        text not null,
  description   text not null default '',
  notes_top     text[] not null default '{}',
  notes_heart   text[] not null default '{}',
  notes_base    text[] not null default '{}',
  featured      boolean not null default false,
  is_new        boolean not null default false,
  active        boolean not null default true,
  colors        jsonb not null default '{"glass":"#222222","cap":"#c9a45c","liquid":"#444444"}',
  image_key     text,
  created_at    timestamptz not null default now()
);

create table if not exists product_variants (
  id                serial primary key,
  product_id        int not null references products(id) on delete cascade,
  ml                int not null check (ml > 0),
  sku               text not null unique,
  price_cents       int not null check (price_cents >= 0),
  compare_at_cents  int check (compare_at_cents >= 0),
  stock             int not null default 0 check (stock >= 0),
  reserved          int not null default 0 check (reserved >= 0),
  unique (product_id, ml)
);

create table if not exists customers (
  id               serial primary key,
  phone            text not null unique,          -- formato internacional sin "+", ej. 51987654321
  first_name       text not null default '',
  last_name        text not null default '',
  document         text,
  email            text,
  accepts_marketing boolean not null default false,
  bot_paused       boolean not null default false, -- true = atiende una persona, el bot no responde
  last_inbound_at  timestamptz,                    -- para la ventana de 24 h de WhatsApp
  created_at       timestamptz not null default now()
);

create sequence if not exists order_number_seq start 1001;

create table if not exists orders (
  id               serial primary key,
  code             text not null unique,
  customer_id      int not null references customers(id),
  status           text not null default 'pendiente_pago' check (status in
                     ('pendiente_pago', 'pago_en_revision', 'pagado', 'preparando', 'despachado', 'entregado', 'cancelado', 'vencido')),
  delivery_method  text not null check (delivery_method in ('domicilio', 'tienda')),
  departamento     text,
  provincia        text,
  distrito         text,
  address          text,
  reference        text,
  payment_method   text not null check (payment_method in ('yape', 'plin')),
  subtotal_cents   int not null,
  discount_cents   int not null default 0,
  shipping_cents   int,                            -- null = por confirmar
  reserved_until   timestamptz,
  courier          text,
  tracking_number  text,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists orders_status_idx on orders(status);
create index if not exists orders_customer_idx on orders(customer_id);

create table if not exists order_items (
  id          serial primary key,
  order_id    int not null references orders(id) on delete cascade,
  variant_id  int not null references product_variants(id),
  brand       text not null,
  name        text not null,
  ml          int not null,
  qty         int not null check (qty > 0),
  price_cents int not null
);

create table if not exists payments (
  id           serial primary key,
  order_id     int not null references orders(id) on delete cascade,
  method       text not null,
  receipt_key  text,                               -- archivo del comprobante en el almacenamiento
  status       text not null default 'en_revision' check (status in ('en_revision', 'aprobado', 'rechazado')),
  reviewed_at  timestamptz,
  created_at   timestamptz not null default now()
);

create table if not exists wa_messages (
  id           serial primary key,
  customer_id  int not null references customers(id),
  wa_id        text unique,                        -- id de Meta, evita procesar dos veces el mismo mensaje
  direction    text not null check (direction in ('in', 'out')),
  author       text not null default 'cliente' check (author in ('cliente', 'bot', 'humano', 'automatizacion')),
  kind         text not null default 'text',
  body         text not null default '',
  media_key    text,
  status       text not null default 'recibido',   -- recibido | enviado | simulado | error | omitido
  error        text,
  created_at   timestamptz not null default now()
);
create index if not exists wa_messages_customer_idx on wa_messages(customer_id, created_at);

create table if not exists automation_settings (
  type          text primary key,
  enabled       boolean not null default true,
  delay_minutes int not null default 0,
  template      text not null,                     -- texto con {nombre}, {codigo}, {total}, {perfume}, {guia}, {agencia}, {link}
  wa_template   text                               -- nombre de la plantilla aprobada por Meta (fuera de las 24 h)
);

create table if not exists automation_jobs (
  id           serial primary key,
  type         text not null,
  order_id     int references orders(id) on delete cascade,
  customer_id  int references customers(id),
  payload      jsonb not null default '{}',
  run_at       timestamptz not null,
  status       text not null default 'pendiente' check (status in ('pendiente', 'hecho', 'omitido', 'error')),
  attempts     int not null default 0,
  result       text,
  created_at   timestamptz not null default now()
);
create index if not exists automation_jobs_due_idx on automation_jobs(status, run_at);

create table if not exists stock_alerts (
  id          serial primary key,
  variant_id  int not null references product_variants(id) on delete cascade,
  customer_id int not null references customers(id),
  notified_at timestamptz,
  created_at  timestamptz not null default now(),
  unique (variant_id, customer_id)
);

create table if not exists newsletter (
  email      text primary key,
  created_at timestamptz not null default now()
);

-- ---------- Cuentas de clientes (ingreso con WhatsApp) ----------

alter table customers add column if not exists departamento text;
alter table customers add column if not exists provincia text;
alter table customers add column if not exists distrito text;
alter table customers add column if not exists address text;
alter table customers add column if not exists reference text;

-- El cliente envía "ACCESO <code>" por WhatsApp; eso prueba que el número es suyo.
create table if not exists login_requests (
  id           serial primary key,
  code         text not null unique,
  token_hash   text not null unique,              -- el token vive solo en una cookie del navegador
  customer_id  int references customers(id),      -- se llena al recibir el mensaje
  expires_at   timestamptz not null,
  verified_at  timestamptz,
  used_at      timestamptz,
  created_at   timestamptz not null default now()
);

-- ---------- Cotizaciones ----------

create sequence if not exists quote_number_seq start 1001;

create table if not exists quotes (
  id             serial primary key,
  code           text not null unique,
  customer_id    int not null references customers(id),
  status         text not null default 'solicitada' check (status in ('solicitada', 'enviada', 'aceptada', 'rechazada', 'vencida')),
  customer_note  text not null default '',
  admin_note     text not null default '',
  discount_cents int not null default 0,
  shipping_cents int,
  valid_until    timestamptz,
  order_id       int references orders(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists quotes_customer_idx on quotes(customer_id);

create table if not exists quote_items (
  id                serial primary key,
  quote_id          int not null references quotes(id) on delete cascade,
  variant_id        int not null references product_variants(id),
  brand             text not null,
  name              text not null,
  ml                int not null,
  qty               int not null check (qty > 0),
  list_price_cents  int not null,                  -- precio de la tienda al pedir la cotización
  unit_price_cents  int                            -- precio cotizado (lo pone el admin)
);

alter table orders add column if not exists quote_id int references quotes(id);

-- ---------- Ingreso con Google ----------
-- Una cuenta puede nacer con Google (sin teléfono) y luego vincular su WhatsApp.
alter table customers alter column phone drop not null;
alter table customers add column if not exists google_sub text unique;
alter table login_requests add column if not exists link_customer_id int references customers(id) on delete set null;

-- ---------- Ingreso con correo y contraseña ----------
-- login_email es el correo para entrar (único, en minúsculas); email es solo de contacto.
alter table customers add column if not exists login_email text unique;
alter table customers add column if not exists password_hash text;

create table if not exists password_failures (
  id          serial primary key,
  login_email text not null,
  created_at  timestamptz not null default now()
);
create index if not exists password_failures_idx on password_failures(login_email, created_at);

-- ---------- Libro de Reclamaciones virtual ----------
create sequence if not exists complaint_number_seq start 1;

create table if not exists complaints (
  id               serial primary key,
  code             text not null unique,            -- N° de hoja, p. ej. 0001-2026
  full_name        text not null,
  document_type    text not null check (document_type in ('DNI', 'CE', 'Pasaporte', 'RUC')),
  document_number  text not null,
  address          text not null,
  phone            text not null,
  email            text not null,
  is_minor         boolean not null default false,
  guardian_name    text,                            -- padre, madre o apoderado si es menor de edad
  good_type        text not null check (good_type in ('producto', 'servicio')),
  amount_cents     int,
  good_description text not null,
  order_code       text,
  kind             text not null check (kind in ('reclamo', 'queja')),
  detail           text not null,
  request          text not null,                   -- pedido del consumidor
  status           text not null default 'pendiente' check (status in ('pendiente', 'respondido')),
  response         text,                            -- acciones adoptadas por el proveedor
  responded_at     timestamptz,
  due_at           timestamptz not null,            -- plazo máximo de respuesta
  created_at       timestamptz not null default now()
);

-- ---------- Reseñas (solo compradores con pedido entregado) ----------
create table if not exists reviews (
  id          serial primary key,
  product_id  int not null references products(id) on delete cascade,
  customer_id int not null references customers(id),
  order_id    int not null references orders(id),
  rating      int not null check (rating between 1 and 5),
  body        text not null default '',
  photo_key   text,
  status      text not null default 'pendiente' check (status in ('pendiente', 'aprobada', 'rechazada')),
  created_at  timestamptz not null default now(),
  unique (order_id, product_id)
);
create index if not exists reviews_product_idx on reviews(product_id, status);

-- ---------- Ajustes editables desde el panel ----------
-- Clave → valor. Si una clave no existe, se usa el valor de las variables de entorno.
create table if not exists store_settings (
  key        text primary key,                   -- whatsapp_number | assistant_enabled
  value      text not null,
  updated_at timestamptz not null default now()
);

-- ---------- Asistente con IA de la web ----------
-- Una fila por pregunta: sirve para limitar el uso por IP y cuidar el saldo de la API.
create table if not exists assistant_requests (
  id         serial primary key,
  ip         text not null,
  created_at timestamptz not null default now()
);
create index if not exists assistant_requests_ip_idx on assistant_requests(ip, created_at);
