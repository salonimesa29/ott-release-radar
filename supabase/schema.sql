create table if not exists preferences (
  id text primary key default 'default',
  genres text[] not null,
  languages text[] not null,
  platforms text[] not null,
  window_days int not null default 7,
  telegram_chat_id text,
  updated_at timestamptz not null default now()
);

create table if not exists digests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  window_start date not null,
  window_end date not null,
  source text not null,
  items jsonb not null,
  sent boolean not null default false,
  sent_at timestamptz,
  telegram_error text
);

create index if not exists digests_created_at_idx on digests (created_at desc);

-- Only the server (service role) touches these tables.
alter table preferences enable row level security;
alter table digests enable row level security;
