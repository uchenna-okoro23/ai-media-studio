create table if not exists users (
 id bigserial primary key,
 email text unique not null,
 password_hash text not null,
 created_at timestamptz not null default now()
);
create table if not exists generations (
 id bigserial primary key,
 user_id bigint references users(id) on delete cascade,
 type text not null,
 prompt text not null,
 status text not null default 'queued',
 output_url text,
 created_at timestamptz not null default now()
);
create index if not exists generations_user_id_idx on generations(user_id, created_at desc);