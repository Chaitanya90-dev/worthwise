create table if not exists telegram_ingest_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  chat_id bigint,
  message_text text,
  parse_status text not null check (
    parse_status in ('unlinked_chat', 'parse_failed', 'insert_failed', 'success', 'error')
  ),
  error_text text,
  parsed_payload jsonb,
  transaction_id uuid references transactions(id) on delete set null,
  created_at timestamptz default now()
);

create index if not exists idx_telegram_ingest_events_user_created_at
  on telegram_ingest_events (user_id, created_at desc);

create index if not exists idx_telegram_ingest_events_status_created_at
  on telegram_ingest_events (parse_status, created_at desc);

alter table telegram_ingest_events enable row level security;

drop policy if exists "Telegram ingest events are user-owned" on telegram_ingest_events;
create policy "Telegram ingest events are user-owned" on telegram_ingest_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
