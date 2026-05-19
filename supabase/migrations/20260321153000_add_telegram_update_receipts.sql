create table if not exists telegram_update_receipts (
  update_id bigint primary key,
  chat_id bigint not null,
  message_id bigint not null,
  created_at timestamptz default now(),
  unique (chat_id, message_id)
);

alter table telegram_update_receipts enable row level security;
