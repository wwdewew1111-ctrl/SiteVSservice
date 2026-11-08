/*
# Create site content tables and seed demo content

Plain-English summary:
The website's content (news, roster, gallery, merch, settings) moves from the
visitor's browser into the cloud database. Visitors can read the content.
Only the website's server function can change it, after the admin enters the
password. Demo content is inserted once so the site looks populated.

## 1. New tables
- `news`: article title, date, tag, short excerpt, full text, cover image.
- `players`: roster members (nickname, name, role, photo, coach flag, social links).
- `gallery_photos`: gallery photos with captions.
- `merch_products`: merch items (title, price, image, purchase link).
- `merch_settings`: single row holding the merch mode ("shop" or "comingSoon").
- `site_settings`: single row with hero banner, social links and partners.
- `merch_subscribers`: emails of people waiting for the merch launch (private).
- `admin_config`: admin password stored as a SHA-256 hash (private).
- `admin_sessions`: short-lived admin login tokens stored as hashes (private).

## 2. Security
- Row level security is enabled on every table.
- Public tables (news, players, gallery, merch, settings) allow reading by
  anonymous visitors only. Nobody can write them directly from the browser.
- Private tables have no access for visitors at all.
- All writes go through the `site-admin` server function, which uses the
  service role and checks the admin password or session token first.

## 3. Important notes
1. Singleton tables use the id `main`.
2. Seed rows use ON CONFLICT DO NOTHING, so re-running this migration is safe.
3. `created_at` uses clock_timestamp() so seeded rows keep a stable order.
*/

CREATE TABLE IF NOT EXISTS news (
  id text PRIMARY KEY,
  title text NOT NULL,
  date date NOT NULL,
  tag text NOT NULL DEFAULT '',
  excerpt text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  cover text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE IF NOT EXISTS players (
  id text PRIMARY KEY,
  nickname text NOT NULL,
  name text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT '',
  photo text NOT NULL DEFAULT '',
  is_coach boolean NOT NULL DEFAULT false,
  socials jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE IF NOT EXISTS gallery_photos (
  id text PRIMARY KEY,
  src text NOT NULL,
  caption text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE IF NOT EXISTS merch_products (
  id text PRIMARY KEY,
  title text NOT NULL,
  price text NOT NULL DEFAULT '',
  image text NOT NULL DEFAULT '',
  url text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE IF NOT EXISTS merch_settings (
  id text PRIMARY KEY DEFAULT 'main',
  mode text NOT NULL DEFAULT 'comingSoon' CHECK (mode IN ('shop', 'comingSoon'))
);

CREATE TABLE IF NOT EXISTS site_settings (
  id text PRIMARY KEY DEFAULT 'main',
  hero_title text NOT NULL DEFAULT '',
  hero_subtitle text NOT NULL DEFAULT '',
  hero_image text NOT NULL DEFAULT '',
  socials jsonb NOT NULL DEFAULT '{}'::jsonb,
  partners jsonb NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS merch_subscribers (
  email text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_config (
  key text PRIMARY KEY,
  value text NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  token_hash text PRIMARY KEY,
  expires_at timestamptz NOT NULL
);

ALTER TABLE news ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE gallery_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE merch_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE merch_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE merch_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_sessions ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON news, players, gallery_photos, merch_products, merch_settings, site_settings TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON news, players, gallery_photos, merch_products, merch_settings, site_settings, merch_subscribers, admin_config, admin_sessions TO service_role;

DROP POLICY IF EXISTS "public_read_news" ON news;
CREATE POLICY "public_read_news" ON news FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public_read_players" ON players;
CREATE POLICY "public_read_players" ON players FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public_read_gallery_photos" ON gallery_photos;
CREATE POLICY "public_read_gallery_photos" ON gallery_photos FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public_read_merch_products" ON merch_products;
CREATE POLICY "public_read_merch_products" ON merch_products FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public_read_merch_settings" ON merch_settings;
CREATE POLICY "public_read_merch_settings" ON merch_settings FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public_read_site_settings" ON site_settings;
CREATE POLICY "public_read_site_settings" ON site_settings FOR SELECT TO anon, authenticated USING (true);

-- Configure admin_password_sha256 privately after provisioning; do not seed a shared password.

INSERT INTO news (id, title, date, tag, excerpt, content, cover) VALUES
('news-1', 'KAB6ANbl выходит в плей-офф регионального турнира', '2026-10-28', 'Турнир',
 'Уверенная серия из трёх побед вывела команду в решающую стадию турнира. Разбираем, что сработало в каждом раунде.',
 $t$Уверенная серия из трёх побед вывела KAB6ANbl в плей-офф регионального турнира. Команда показала стабильную игру в обеих половинах карты и не позволила соперникам выйти на серьёзное преимущество.

Ключевым стал слаженный розыгрыш на точках и дисциплина в позиционной игре. Капитан команды отметил, что подготовка к матчам строилась на разборе ошибок прошлых игр.

В следующем раунде команда встретится с сильным соперником. Тренировочный план на неделю уже составлен, и ребята настроены на результат.$t$,
 'https://images.pexels.com/photos/9072205/pexels-photo-9072205.jpeg?auto=compress&cs=tinysrgb&w=1200'),
('news-2', 'Команда усиливается: новый саппорт в основном составе', '2026-10-15', 'Состав',
 'Новый игрок проходит адаптацию в основном составе. Рассказываем, какую роль он будет выполнять на картах.',
 $t$KAB6ANbl объявляет о пополнении основного состава. Новый саппорт уже начал тренировки с командой и проходит адаптацию перед ближайшими турнирами.

Его задача - прикрывать фланги, помогать в открытии позиций и поддерживать коммуникацию в игре. Тренерский штаб рассчитывает, что это даст команде больше гибкости в тактиках.$t$,
 'https://images.pexels.com/photos/14266493/pexels-photo-14266493.jpeg?auto=compress&cs=tinysrgb&w=1200'),
('news-3', 'Интенсивный буткемп перед осенним сезоном', '2026-09-30', 'Буткемп',
 'Неделя совместных тренировок, разбор демо и игры на лане. Команда готовится к осеннему сезону на полную.',
 $t$Команда провела недельный буткемп, в течение которого тренировалась по восемь часов в день. Основной упор был сделан на отработку заготовок под разные стратегии соперников.

Каждый вечер проходил разбор демо-записей, а утром игроки отрабатывали механику стрельбы и работу с оружием.$t$,
 'https://images.pexels.com/photos/9071736/pexels-photo-9071736.jpeg?auto=compress&cs=tinysrgb&w=1200'),
('news-4', 'Чемпионский дубль на открытом кубке', '2026-09-12', 'Победа',
 'Две победы в одном турнире и первое место в общем зачёте. Болельщики поддержали команду на каждом матче.',
 $t$KAB6ANbl забрала первое место на открытом кубке, выиграв оба дня турнира. Финальный матч прошёл в напряжённой борьбе и был решён на последнем раунде.

Огромное спасибо болельщикам, которые поддерживали команду онлайн и на трибунах.$t$,
 'https://images.pexels.com/photos/34179719/pexels-photo-34179719.jpeg?auto=compress&cs=tinysrgb&w=1200')
ON CONFLICT (id) DO NOTHING;

INSERT INTO players (id, nickname, name, role, photo, is_coach, socials) VALUES
('player-1', 'Kolibri', 'Артём Волков', 'IGL / Капитан', 'https://images.pexels.com/photos/33535657/pexels-photo-33535657.jpeg?auto=compress&cs=tinysrgb&w=800', false, '{"twitch":"#","telegram":"#","steam":"#","faceit":"#"}'::jsonb),
('player-2', 'Rook', 'Денис Орлов', 'AWPer / Снайпер', 'https://images.pexels.com/photos/9071752/pexels-photo-9071752.jpeg?auto=compress&cs=tinysrgb&w=800', false, '{"twitch":"#","telegram":"#","steam":"#","faceit":"#"}'::jsonb),
('player-3', 'Shade', 'Кирилл Соколов', 'Рифлер', 'https://images.pexels.com/photos/7849521/pexels-photo-7849521.jpeg?auto=compress&cs=tinysrgb&w=800', false, '{"twitch":"#","telegram":"#","steam":"#","faceit":"#"}'::jsonb),
('player-4', 'Blitz', 'Максим Ветров', 'Энтри-фраггер', 'https://images.pexels.com/photos/15494942/pexels-photo-15494942.jpeg?auto=compress&cs=tinysrgb&w=800', false, '{"twitch":"#","telegram":"#","steam":"#","faceit":"#"}'::jsonb),
('player-5', 'Anchor', 'Роман Белов', 'Саппорт', 'https://images.pexels.com/photos/7887000/pexels-photo-7887000.jpeg?auto=compress&cs=tinysrgb&w=800', false, '{"twitch":"#","telegram":"#","steam":"#","faceit":"#"}'::jsonb),
('coach-1', 'Mira', 'Елена Кравцова', 'Тренер', 'https://images.pexels.com/photos/7862591/pexels-photo-7862591.jpeg?auto=compress&cs=tinysrgb&w=800', true, '{"twitch":"#","telegram":"#"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO gallery_photos (id, src, caption) VALUES
('photo-1', 'https://images.pexels.com/photos/9072205/pexels-photo-9072205.jpeg?auto=compress&cs=tinysrgb&w=1200', 'Финал регионального турнира'),
('photo-2', 'https://images.pexels.com/photos/14266493/pexels-photo-14266493.jpeg?auto=compress&cs=tinysrgb&w=1200', 'Атмосфера большой арены'),
('photo-3', 'https://images.pexels.com/photos/34179719/pexels-photo-34179719.jpeg?auto=compress&cs=tinysrgb&w=1200', 'Заслуженная награда'),
('photo-4', 'https://images.pexels.com/photos/9071736/pexels-photo-9071736.jpeg?auto=compress&cs=tinysrgb&w=1200', 'Командная работа на буткемпе'),
('photo-5', 'https://images.pexels.com/photos/9072293/pexels-photo-9072293.jpeg?auto=compress&cs=tinysrgb&w=1200', 'Групповой этап'),
('photo-6', 'https://images.pexels.com/photos/9071711/pexels-photo-9071711.jpeg?auto=compress&cs=tinysrgb&w=1200', 'Перед игрой'),
('photo-7', 'https://images.pexels.com/photos/9072317/pexels-photo-9072317.jpeg?auto=compress&cs=tinysrgb&w=1200', 'Концентрация на раунде'),
('photo-8', 'https://images.pexels.com/photos/7915522/pexels-photo-7915522.jpeg?auto=compress&cs=tinysrgb&w=1200', 'Победная эмоция')
ON CONFLICT (id) DO NOTHING;

INSERT INTO merch_products (id, title, price, image, url) VALUES
('merch-1', 'Джерси KAB6ANbl', '3 990 ₽', 'https://images.pexels.com/photos/19461583/pexels-photo-19461583.jpeg?auto=compress&cs=tinysrgb&w=900', ''),
('merch-2', 'Худи Black Edition', '6 490 ₽', 'https://images.pexels.com/photos/20248582/pexels-photo-20248582.jpeg?auto=compress&cs=tinysrgb&w=900', ''),
('merch-3', 'Худи Oversize Crimson', '6 990 ₽', 'https://images.pexels.com/photos/20248584/pexels-photo-20248584.jpeg?auto=compress&cs=tinysrgb&w=900', ''),
('merch-4', 'Коврик для мыши XL', '1 490 ₽', 'https://images.pexels.com/photos/12877898/pexels-photo-12877898.jpeg?auto=compress&cs=tinysrgb&w=900', '')
ON CONFLICT (id) DO NOTHING;

INSERT INTO merch_settings (id, mode) VALUES ('main', 'comingSoon')
ON CONFLICT (id) DO NOTHING;

INSERT INTO site_settings (id, hero_title, hero_subtitle, hero_image, socials, partners) VALUES (
  'main',
  'KAB6ANbl ESPORTS',
  'Сила в команде. Точность в каждом раунде.',
  'https://images.pexels.com/photos/9072394/pexels-photo-9072394.jpeg?auto=compress&cs=tinysrgb&w=1920',
  '{"twitch":"#","youtube":"#","instagram":"#","telegram":"#","steam":"#","faceit":"#"}'::jsonb,
  '[{"id":"partner-1","name":"NORTHLINE","logo":"","url":""},{"id":"partner-2","name":"VOLT GEAR","logo":"","url":""},{"id":"partner-3","name":"APEX PERIPHERALS","logo":"","url":""},{"id":"partner-4","name":"FRAG HOUSE","logo":"","url":""}]'::jsonb
)
ON CONFLICT (id) DO NOTHING;
