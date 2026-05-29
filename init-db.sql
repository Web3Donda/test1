-- Чистая схема для PostgreSQL на VDS (без Supabase-специфики).
-- Запускается один раз после создания БД `elizaveta`.

create table if not exists products (
  id text primary key,
  name text not null,
  description text,
  price numeric not null,
  "imageSrc" text,
  category text,
  composition jsonb default '[]',
  tags jsonb default '[]',
  rating numeric default 5.0,
  popular boolean default false,
  "imageClassName" text default 'object-cover',
  "order" integer default 0
);

create table if not exists orders (
  order_id text primary key,
  customer_name text,
  customer_phone text,
  delivery_type text,
  address text,
  date text,
  time text,
  card_message text,
  total_price numeric,
  items jsonb default '[]',
  status text default 'pending',
  status_log jsonb default '[]',
  payment_method text,
  payment_status text,
  payment_id text,
  created_at timestamp default now()
);

create table if not exists reviews (
  id serial primary key,
  author text,
  rating integer,
  comment text,
  date text
);

create table if not exists categories (
  id text primary key,
  label text
);

insert into categories (id, label) values
  ('flowers', 'Цветы поштучно'),
  ('greens', 'Декоративная зелень'),
  ('balloons', 'Гелиевые шары'),
  ('author', 'Авторские букеты'),
  ('roses', 'Пионовидные розы'),
  ('spring', 'Весенняя коллекция'),
  ('boxes', 'Шляпные коробки')
on conflict (id) do nothing;
