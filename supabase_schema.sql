-- Create a table for users
create table users (
  id uuid default gen_random_uuid() primary key,
  nickname text not null,
  username text unique,
  password_hash text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  last_login timestamp with time zone default timezone('utc'::text, now()) not null,
  credits integer default 5 not null,
  is_admin boolean default false not null,
  device_id text,
  referred_by uuid references users(id)
);

-- Table to track device usage for registration bonuses
create table device_usage (
  device_id text primary key,
  bonus_claimed_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Table to track redemption history (one per month per device)
create table redemption_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references users(id) not null,
  device_id text not null,
  code text not null,
  redeemed_month text not null, -- Format: 'YYYY-MM'
  redeemed_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(device_id, redeemed_month)
);

-- Table to track used redemption codes to ensure global uniqueness (if codes are unique string tokens)
create table used_redemption_codes (
  code text primary key,
  used_at timestamp with time zone default timezone('utc'::text, now()) not null,
  user_id uuid references users(id)
);

-- Table for payment configuration and global toggles
create table payment_config (
  key text primary key,
  value text,
  is_enabled boolean default true
);

-- Enable Row Level Security (RLS)
alter table users enable row level security;
alter table device_usage enable row level security;
alter table redemption_logs enable row level security;
alter table used_redemption_codes enable row level security;
alter table payment_config enable row level security;

-- Create a policy that allows anyone to insert users (registration)
create policy "Enable insert for all users" on users for insert with check (true);

-- Create a policy that allows users to SELECT themselves based on ID (we will use ID stored in localStorage)
-- FOR SIMPLICITY given the requirements (Nickname only), we might relax this or better yet, rely on the backend/client logic.
-- Since there is no "Auth" service user (user is anonymous), we'll do Public Select for now or match by ID.
create policy "Enable select for users based on id" on users for select using (true);

-- Create a policy that allows updating credits (in a real app this should be secure)
create policy "Enable update for users" on users for update using (true);

-- Policies for new tables (Simplified for now, real app needs strict RLS)
create policy "Enable read access for all users" on payment_config for select using (true);
create policy "Enable insert for all users" on payment_config for insert with check (true);
create policy "Enable update for all users" on payment_config for update using (true);
create policy "Enable all access for service role" on device_usage for all using (true);
create policy "Enable all access for service role" on redemption_logs for all using (true);
create policy "Enable all access for service role" on used_redemption_codes for all using (true);

-- Table for payment orders (用于支付宝充值订单)
create table if not exists payment_orders (
  id uuid default gen_random_uuid() primary key,
  order_id text unique not null,
  user_id uuid references users(id) not null,
  package_id text not null,
  amount decimal(10, 2) not null,
  credits integer not null,
  status text default 'pending' not null,
  trade_no text,
  paid_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table payment_orders enable row level security;
create policy "Enable all access for service role" on payment_orders for all using (true);
