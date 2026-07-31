-- Migration: grupos de contatos + name_locked
-- Run in Supabase SQL Editor

-- Proteção de nome editado manualmente
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS name_locked bool default false;

-- Grupos de contatos (BIOSOL, família, equipe, etc.)
CREATE TABLE IF NOT EXISTS contact_groups (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid references instances(id) on delete cascade,
  name text not null,
  description text,
  color text default '#6b7280',
  created_at timestamptz default now(),
  unique(instance_id, name)
);

-- Membros dos grupos
CREATE TABLE IF NOT EXISTS contact_group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references contact_groups(id) on delete cascade,
  contact_id uuid references contacts(id) on delete cascade,
  added_at timestamptz default now(),
  unique(group_id, contact_id)
);
