create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  type text not null,
  prompt text not null,
  status text not null default 'processing',
  output_url text,
  created_at timestamptz not null default now()
);

create index if not exists idx_generations_user_created
  on generations(user_id, created_at desc);
