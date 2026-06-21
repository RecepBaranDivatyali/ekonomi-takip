-- Drop existing tables to ensure clean schema recreation
drop table if exists public.debts cascade;
drop table if exists public.transactions cascade;
drop table if exists public.categories cascade;
drop table if exists public.wallets cascade;

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. WALLETS TABLE (Accounts)
create table if not exists public.wallets (
    id uuid default uuid_generate_v4() primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    name text not null,
    type text not null default 'Vadesiz' check (type in ('Vadesiz', 'Vadeli', 'Dolar', 'Euro', 'Altın', 'Gümüş', 'Borsa_TRY', 'Borsa_USD')),
    color text not null default '#3B82F6',
    balance numeric not null default 0,
    interest_rate numeric not null default 0,
    maturity_days integer not null default 30,
    last_interest_date date default current_date,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for wallets
alter table public.wallets enable row level security;

create policy "Users can perform all actions on their own wallets"
on public.wallets for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- 2. CATEGORIES TABLE
create table if not exists public.categories (
    id uuid default uuid_generate_v4() primary key,
    user_id uuid references auth.users(id) on delete cascade, -- Null user_id means default system categories
    name text not null,
    emoji text not null,
    color text not null,
    type text not null check (type in ('Gelir', 'Gider')),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for categories
alter table public.categories enable row level security;

create policy "Users can view default categories and their own categories"
on public.categories for select
using (user_id is null or auth.uid() = user_id);

create policy "Users can insert/update/delete their own categories"
on public.categories for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- 3. TRANSACTIONS TABLE
create table if not exists public.transactions (
    id uuid default uuid_generate_v4() primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    wallet_id uuid references public.wallets(id) on delete cascade not null,
    category_id uuid references public.categories(id) on delete set null,
    amount numeric not null check (amount > 0),
    description text,
    date date not null default current_date,
    time_range text not null default '05:00 - 18:15', -- for compounding interest/time logic
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for transactions
alter table public.transactions enable row level security;

create policy "Users can perform all actions on their own transactions"
on public.transactions for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- 4. DEBTS TABLE
create table if not exists public.debts (
    id uuid default uuid_generate_v4() primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    wallet_id uuid references public.wallets(id) on delete cascade not null,
    category_id uuid references public.categories(id) on delete set null,
    type text not null check (type in ('Alınacak', 'Verilecek')),
    amount numeric not null check (amount > 0),
    name text not null,
    due_date date,
    status text not null check (status in ('Bekliyor', 'Ödendi')) default 'Bekliyor',
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for debts
alter table public.debts enable row level security;

create policy "Users can perform all actions on their own debts"
on public.debts for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- 5. SEED DEFAULT SYSTEM CATEGORIES (user_id is null)
insert into public.categories (name, emoji, color, type, user_id) values
('Yiyecek & İçecek', '🍔', '#EF4444', 'Gider', null),
('Kira & Ev', '🏠', '#3B82F6', 'Gider', null),
('Ulaşım', '🚗', '#F59E0B', 'Gider', null),
('Eğlence', '🎮', '#8B5CF6', 'Gider', null),
('Alışveriş', '🛒', '#EC4899', 'Gider', null),
('Maaş & Gelir', '💵', '#10B981', 'Gelir', null),
('Faiz & Yatırım', '📈', '#84CC16', 'Gelir', null),
('Diğer', '🪙', '#64748B', 'Gider', null);

-- 6. TAGS TABLE (Etiketler)
create table if not exists public.tags (
    id uuid default uuid_generate_v4() primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    name text not null,
    emoji text not null default '🏷️',
    color text not null default '#3B82F6',
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for tags
alter table public.tags enable row level security;

create policy "Users can perform all actions on their own tags"
on public.tags for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Add tag_id to transactions table
alter table public.transactions add column if not exists tag_id uuid references public.tags(id) on delete set null;
