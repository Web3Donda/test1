-- ════════════════════════════════════════════════════════════════════
--  Схема БД для сайта «Цветы Елизавета» (Supabase / PostgreSQL)
--  Выполнить один раз в Supabase → SQL Editor → New query → Run.
-- ════════════════════════════════════════════════════════════════════

-- Таблица товаров
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

-- Таблица заказов
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
  created_at timestamp default now()
);

-- Таблица отзывов
create table if not exists reviews (
  id serial primary key,
  author text,
  rating integer,
  comment text,
  date text
);

-- Таблица категорий
create table if not exists categories (
  id text primary key,
  label text
);

-- Отключаем Row Level Security (доступ идёт через service_role в API)
alter table products   disable row level security;
alter table orders     disable row level security;
alter table reviews    disable row level security;
alter table categories disable row level security;

-- Начальные категории
insert into categories (id, label) values
  ('flowers', 'Цветы поштучно'),
  ('greens', 'Декоративная зелень'),
  ('balloons', 'Гелиевые шары'),
  ('author', 'Авторские букеты'),
  ('roses', 'Пионовидные розы'),
  ('spring', 'Весенняя коллекция'),
  ('boxes', 'Шляпные коробки')
on conflict (id) do nothing;

-- Сид товаров (из src/data.ts)
insert into products (id, name, description, price, "imageSrc", category, composition, tags, rating, popular, "imageClassName", "order") values
  ('flower-1', 'Роза Нина Эквадор', 'Элитная эквадорская роза премиального сорта Nina. Обладает крупным раскрывающимся бутоном огненного оранжево-красного оттенка, плотными лепестками с легкой волной на краях и потрясающей стойкостью.', 220, '/src/assets/images/roza_ekv.jpg', 'flowers', '["Роза Nina (Эквадор) — 1 шт","Высота стебля 60-70 см"]'::jsonb, '["роза","красная роза","поштучно","эквадор"]'::jsonb, 4.9, true, 'object-cover object-[center_15%]', 0),
  ('flower-2', 'Роза Гоча Эквадор', 'Невероятно сочная розовая роза сорта Gotcha с насыщенным неоновым малиновым оттенком. Обладает прочным стеблем и пышным бокалом, который раскрывается в огромную чашу.', 220, '/src/assets/images/gocha_roz.jpg', 'flowers', '["Роза Gotcha (Эквадор) — 1 шт","Высота стебля 65 см"]'::jsonb, '["роза","розовая роза","поштучно","Gotcha"]'::jsonb, 5, true, 'object-cover object-center', 1),
  ('flower-3', 'Роза красная Эксплорер', 'Знаменитый сорт Explorer — эталон классической глубоко-красной бархатной розы. Высокий бокал бутона, отсутствие шипов на верхней трети стебля и благородный темный оттенок лепестков.', 220, 'https://images.unsplash.com/photo-1606103983210-91bc7df84fb9?q=80&w=600&auto=format&fit=crop', 'flowers', '["Роза Explorer (Эквадор) — 1 шт","Высота стебля 70 см"]'::jsonb, '["роза","красная роза","бархатная","поштучно"]'::jsonb, 4.9, false, 'object-cover', 2),
  ('flower-4', 'Роза пионовидная Кантри Блюз', 'Эффектная садовая пионовидная роза Country Blues со сложным нежно-сиреневым и пепельно-розовым оттенком. Бутон густомахровый, раскрывается в пышную розетку.', 220, 'https://images.unsplash.com/photo-1496062031256-47a19d820f3c?q=80&w=600&auto=format&fit=crop', 'flowers', '["Роза Country Blues (Кения) — 1 шт","Высота стебля 50-60 см"]'::jsonb, '["роза","пионовидная","розово-сиреневая","поштучно"]'::jsonb, 5, true, 'object-cover', 3),
  ('flower-5', 'Лилия', 'Ароматная, крупная и величественная белая восточная лилия. На одной ветке располагается от 3 до 5 пышных бутонов, которые раскрываются по очереди, обеспечивая долгое присутствие нежности.', 650, '/src/assets/images/white_lily_flower_1779460190501.png', 'flowers', '["Ветка восточной лилии — 1 шт"]'::jsonb, '["лилия","белая","ароматная","поштучно"]'::jsonb, 4.8, false, 'object-cover', 4),
  ('flower-6', 'Орхидея', 'Экзотические и стойкие бутоны орхидеи Цимбидиум. Обладают плотными восковыми лепестками благородного салатно-зеленого или кремового оттенка с яркой бархатистой губой.', 150, 'https://images.unsplash.com/photo-1525310072745-f49212b5ac6d?q=80&w=600&auto=format&fit=crop', 'flowers', '["Соцветие орхидеи (Цимбидиум) — 1 шт","Подается в специальной флористической колбе с водой"]'::jsonb, '["орхидея","экзотика","стойкая","зеленая"]'::jsonb, 4.8, false, 'object-cover', 5),
  ('flower-7', 'Хризантема одноголовая', 'Гигантская шаровидная хризантема нежно-салатного или белоснежного цвета. Невероятно пышный, структурированный цветок, символизирующий благополучие и стойкость.', 350, 'https://images.unsplash.com/photo-1502977249166-824b3a8a4d6d?q=80&w=600&auto=format&fit=crop', 'flowers', '["Одноголовая шаровидная хризантема класса Премиум — 1 шт"]'::jsonb, '["хризантема","пышная","крупная","стойкая"]'::jsonb, 4.7, false, 'object-cover', 6),
  ('flower-8', 'Хризантема кустовая белая', 'Пышная кустовая хризантема с множеством аккуратных махровых бутонов. Дарит букету объем, тепло и ощущение весенней свежести. Прекрасно стоит в воде до 18-20 дней.', 250, 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?q=80&w=600&auto=format&fit=crop', 'flowers', '["Ветка кустовой махровой хризантемы — 1 шт"]'::jsonb, '["хризантема","кустовая","белая","объем"]'::jsonb, 4.9, false, 'object-cover', 7),
  ('flower-9', 'Хризантема кустовая ромашковая', 'Жизнерадостная кустовая хризантема, напоминающая крупные лесные ромашки со светлой сердцевиной. Идеальный выбор для создания легких, загородных и воздушных композиций.', 250, 'https://images.unsplash.com/photo-1560717789-0ac7c58ac90a?q=80&w=600&auto=format&fit=crop', 'flowers', '["Ветка ромашковой кустовой хризантемы — 1 шт"]'::jsonb, '["хризантема","кустовая","ромашка","яркая"]'::jsonb, 4.8, false, 'object-cover', 8),
  ('flower-10', 'Гипсофила', 'Стойкая и воздушная веточка гипсофилы, усыпанная сотнями крошечных белых соцветий. Похожа на невесомое зимнее или весеннее облако.', 250, '/src/assets/images/gypsophila_vase_1779456284717.png', 'flowers', '["Ветка свежей белой гипсофилы Люкс — 1 шт"]'::jsonb, '["гипсофила","стойкий","облако","сухоцвет"]'::jsonb, 5, true, 'object-cover', 9),
  ('flower-11', 'Альстромерия', 'Нежная перуанская лилия с яркими пестрыми лепестками. Практически лишена запаха, гипоаллергенна, а на одной ветке раскрывается до 7-8 небольших изящных бутонов.', 160, 'https://images.unsplash.com/photo-1582794543139-8ac9cb0f7b11?q=80&w=600&auto=format&fit=crop', 'flowers', '["Ветка разноцветной альстромерии — 1 шт"]'::jsonb, '["альстромерия","нежная","пестрая","стойкая"]'::jsonb, 4.8, false, 'object-cover', 10),
  ('flower-12', 'Статица', 'Очаровательный сухоцвет статицы (лимониум) насыщенно-фиолетового цвета. Создает красивую матовую фактуру в вазе, сохраняет яркий цвет даже после полного высыхания.', 150, '/src/assets/images/statice_flower_1779455841512.png', 'flowers', '["Ветка фиолетовой статицы люкс — 1 шт"]'::jsonb, '["статица","сухоцвет","фиолетовый","текстура"]'::jsonb, 4.9, false, 'object-cover', 11),
  ('flower-13', 'Гербера', 'Крупная, фактурная и очень позитивная гербера с яркими лепестками и плотным стеблем. Отлично держит геометрию и радует плотным, ровным цветением.', 150, '/src/assets/images/gerbera_flower_1779455788975.png', 'flowers', '["Крупный цветок сортовой герберы — 1 шт"]'::jsonb, '["гербера","крупный","солнечный","поштучно"]'::jsonb, 4.7, false, 'object-cover', 12),
  ('flower-14', 'Гвоздика', 'Пышная, кружевная одноголовая гвоздика (диантус) насыщенного благородного оттенка. Славится своей рекордной стойкостью и аристократичным видом.', 100, 'https://images.unsplash.com/photo-1589244159943-460088ed5c92?q=80&w=600&auto=format&fit=crop', 'flowers', '["Гвоздика одноголовая сортовая — 1 шт"]'::jsonb, '["гвоздика","диантус","суперстойкая","поштучно"]'::jsonb, 4.8, false, 'object-cover', 13),
  ('flower-15', 'Тюльпан', 'Отборный классический весенний тюльпан с сочным зеленым стеблем и плотно закрытым аккуратным бутоном, который раскрывается в тепле комнаты.', 80, 'https://images.unsplash.com/photo-1520763185298-1b434c919102?q=80&w=600&auto=format&fit=crop', 'flowers', '["Тюльпан сортовой (Россия/Голландия) — 1 шт"]'::jsonb, '["тюльпан","весна","свежий","классика"]'::jsonb, 4.8, false, 'object-cover', 14),
  ('green-1', 'Эвкалипт', 'Ароматные веточки серебряного итальянского эвкалипта Парвифолия с округлыми сизыми листьями. Наполняет комнату свежим хвойно-ментоловым благоуханием.', 150, '/src/assets/images/eucalyptus_branch_1779455808697.png', 'greens', '["Ветка итальянского эвкалипта — 1 шт"]'::jsonb, '["зелень","эвкалипт","ароматный","декор"]'::jsonb, 5, true, 'object-cover', 15),
  ('green-2', 'Фисташка', 'Густые и пышные веточки фисташки (зелень писташ). Идеальный материал для придания букету легкой растрепанности, лесного объема и сочной насыщенной фактуры.', 120, 'https://images.unsplash.com/photo-1533038590840-1cde6e668a91?q=80&w=600&auto=format&fit=crop', 'greens', '["Ветка декоративной зелени писташ — 1 шт"]'::jsonb, '["зелень","фисташка","объем","садовый"]'::jsonb, 4.7, false, 'object-cover', 16),
  ('green-3', 'Рускус Израиль', 'Благородный израильский рускус с плотными глянцевыми овальными листочками изумрудного цвета на прочном вертикальном стебле. Отлично выстраивает геометрию букета.', 120, 'https://images.unsplash.com/photo-1501004318641-b39e6451bec6?q=80&w=600&auto=format&fit=crop', 'greens', '["Ветка элитного рускуса (Израиль) — 1 шт"]'::jsonb, '["зелень","рускус","глянцевый","стойкий"]'::jsonb, 4.9, false, 'object-cover', 17),
  ('green-4', 'Аспидистра', 'Широкий, массивный и глянцевый лист аспидистры глубокого изумрудного тона. Часто используется как мягкий каркас под бутоны или закручивается в изящную петлю.', 120, 'https://images.unsplash.com/photo-1614594975525-e45190c55d0b?q=80&w=600&auto=format&fit=crop', 'greens', '["Лист аспидистры декоративный — 1 шт"]'::jsonb, '["зелень","аспидистра","широкий лист","каркас"]'::jsonb, 4.6, false, 'object-cover', 18),
  ('green-5', 'Чико', 'Крупный пальмовый лист Чико с выраженной тропической перистой формой. Прекрасно декорирует вертикальные, ампельные или экзотические мужские и женские букеты.', 120, '/src/assets/images/chiko_palm_1779402344221.png', 'greens', '["Пальмовый лист Чико — 1 шт"]'::jsonb, '["зелень","чико","пальма","экзотика"]'::jsonb, 4.8, false, 'object-cover', 19),
  ('accessory-1', 'Гелиевые шары', 'Красочные и праздничные шары с гелием в ассортименте по цветам (пастель, металлик, с поздравительными надписями). Отличный способ мгновенно дополнить цветочный сюрприз.', 150, 'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?q=80&w=600&auto=format&fit=crop', 'balloons', '["Гелиевый шар — 1 шт","Обработка для долгого полета"]'::jsonb, '["подарки","шары","гелий","день рождения"]'::jsonb, 4.9, true, 'object-cover', 20)
on conflict (id) do nothing;

-- Сид отзывов (из src/data.ts)
insert into reviews (author, rating, comment, date) values
  ('Елена К.', 5, 'Заказывала охапку роз Эксплорер на юбилей коллеге. Цветы свежайшие, крепкие бутоны, стояли почти три недели! Доставили вовремя прямо в ресторан. Огромное спасибо мастерской «Елизавета» за классный сервис!', '18 Мая 2026'),
  ('Дмитрий С.', 5, 'Цены на цветы поштучно невероятно радуют. Собрал сам огромный весенний букет из тюльпанов и фисташки с эвкалиптом вышло очень стильно и недорого! Бесплатная доставка привезла вовремя.', '12 Мая 2026'),
  ('Александра П.', 4, 'Свежая гипсофила здесь просто чудо. Обожаю заказывать ее поштучно ветками, дома разделяю в маленькие вазы по комнатам. Стоит вечно🤍', '05 Мая 2026')
on conflict do nothing;

-- ════════════════════════════════════════════════════════════════════
--  Storage: bucket для фото товаров (загрузка из админки)
-- ════════════════════════════════════════════════════════════════════
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

-- Публичное чтение и загрузка в bucket product-images
drop policy if exists "product-images read"   on storage.objects;
drop policy if exists "product-images upload" on storage.objects;

create policy "product-images read"
  on storage.objects for select
  using (bucket_id = 'product-images');

create policy "product-images upload"
  on storage.objects for insert
  with check (bucket_id = 'product-images');
