-- Seed data for THE GLOW 2026.
-- Prerequisite: run docs/20260319_festival_core.sql first.
-- This seed assumes public.events.id is uuid.

begin;

insert into public.events (
  id,
  title,
  artist,
  description,
  start_date,
  end_date,
  venue,
  venue_address,
  venue_lat,
  venue_lng,
  genre,
  event_type,
  image_url,
  price_range,
  ticket_url,
  ticket_open_time,
  age_limit,
  artist_profile
) values (
  'c1b1d9e6-ff6d-4d4b-9f79-ef64a5f00026',
  '더 글로우 2026 (THE GLOW 2026)',
  'HYUKOH, Lee Seung Yoon, Lee Chan Hyuk, Se So Neon 외',
  'THE GLOW 2026은 원더로크가 운영하는 실제 실내형 뮤직 페스티벌입니다. 현재 seed는 공개 기사와 예매처 기준으로 일정, 장소, 라인업, 스테이지 구조, 예매 링크를 먼저 반영하고, 분 단위 타임테이블은 확인된 슬롯만 저장합니다.',
  '2026-03-21T00:00:00+09:00',
  '2026-03-22T23:59:00+09:00',
  'KINTEX 제2전시장 Hall 7·8·9·10A',
  '경기도 고양시 일산서구 킨텍스로 217-59',
  37.6674,
  126.7453,
  'indie',
  'festival',
  'https://www.art-culture.co.kr/data/editor/2602/e0a09f182bf20f291a39dd17ae967598_1770113820_534.png',
  '1일권 121,000원 / 2일권 193,000원',
  'https://ticket.melon.com/performance/index.htm?prodId=212651',
  '2026-01-29T16:00:00+09:00',
  '8세 이상',
  '원더로크가 운영하는 실내형 뮤직 페스티벌로, 2026년 행사에서는 3개 스테이지와 공개 라인업 기반 탐색 경험을 핵심 POC 시나리오로 삼습니다.'
) on conflict (id) do update
set
  title = excluded.title,
  artist = excluded.artist,
  description = excluded.description,
  start_date = excluded.start_date,
  end_date = excluded.end_date,
  venue = excluded.venue,
  venue_address = excluded.venue_address,
  venue_lat = excluded.venue_lat,
  venue_lng = excluded.venue_lng,
  genre = excluded.genre,
  event_type = excluded.event_type,
  image_url = excluded.image_url,
  price_range = excluded.price_range,
  ticket_url = excluded.ticket_url,
  ticket_open_time = excluded.ticket_open_time,
  age_limit = excluded.age_limit,
  artist_profile = excluded.artist_profile,
  updated_at = timezone('utc', now());

insert into public.artists (slug, name, artist_type)
values
  ('gimseungju', '김승주', 'solo'),
  ('dragon-pony', 'Dragon Pony', 'band'),
  ('redoor', '리도어', 'band'),
  ('mate', 'Mate', 'band'),
  ('hanroro', 'HANRORO', 'solo'),
  ('lee-seung-yoon', 'Lee Seung Yoon', 'solo'),
  ('gongwon', '공원', 'band'),
  ('wim', 'WIM', 'band'),
  ('yunmachi', '윤마치', 'solo'),
  ('the-walters', 'The Walters', 'band'),
  ('thornapple', '쏜애플', 'band'),
  ('jang-kiha', '장기하', 'solo'),
  ('decadent', '데카당', 'band'),
  ('playbook', '놀이도감', 'band'),
  ('the-dinosaurs-skin', 'The Dinosaur''s Skin', 'band'),
  ('nasanghyeon-band', '나상현씨밴드', 'band'),
  ('byebyebadman', '바이바이배드맨', 'band'),
  ('jisokuryclub', '지소쿠리클럽', 'band'),
  ('the-solutions', '솔루션스', 'band'),
  ('sininryu', '신인류', 'band'),
  ('song-sohee', '송소희', 'solo'),
  ('baek-hyunjin', '백현진', 'solo'),
  ('damons-year', 'Damons Year', 'solo'),
  ('se-so-neon', '새소년', 'band'),
  ('hyukoh', 'HYUKOH', 'band'),
  ('gogohak', '고고학', 'band'),
  ('kkachisan', '까치산', 'band'),
  ('kiro-akiyama', 'Kiro Akiyama', 'solo'),
  ('grentperez', 'grentperez', 'solo'),
  ('touched', '터치드', 'band'),
  ('lee-chan-hyuk', 'Lee Chan Hyuk', 'solo'),
  ('twenty-four', '이십사일', 'band'),
  ('gemini', 'GEMINI', 'solo'),
  ('youra', '유라', 'solo'),
  ('home', 'HOME', 'band'),
  ('bongjeingan', '봉제인간', 'band'),
  ('cafune', 'Cafune', 'band'),
  ('balming-tiger', 'Balming Tiger', 'collective')
on conflict (slug) do update
set
  name = excluded.name,
  artist_type = excluded.artist_type,
  updated_at = timezone('utc', now());

delete from public.schedule_slots
where event_id = 'c1b1d9e6-ff6d-4d4b-9f79-ef64a5f00026';

delete from public.event_artists
where event_id = 'c1b1d9e6-ff6d-4d4b-9f79-ef64a5f00026';

delete from public.ticket_links
where event_id = 'c1b1d9e6-ff6d-4d4b-9f79-ef64a5f00026';

with lineup(slug, performance_date, display_order, role, is_headliner, note) as (
  values
    ('gimseungju', '2026-03-21', 1, 'lineup', false, '오프닝'),
    ('dragon-pony', '2026-03-21', 2, 'lineup', false, null),
    ('redoor', '2026-03-21', 3, 'lineup', false, null),
    ('mate', '2026-03-21', 4, 'lineup', false, null),
    ('hanroro', '2026-03-21', 5, 'lineup', false, null),
    ('lee-seung-yoon', '2026-03-21', 6, 'headliner', true, '헤드라이너'),
    ('gongwon', '2026-03-21', 1, 'lineup', false, '오프닝'),
    ('wim', '2026-03-21', 2, 'lineup', false, null),
    ('yunmachi', '2026-03-21', 3, 'lineup', false, null),
    ('the-walters', '2026-03-21', 4, 'lineup', false, null),
    ('thornapple', '2026-03-21', 5, 'lineup', false, null),
    ('jang-kiha', '2026-03-21', 6, 'headliner', true, '헤드라이너'),
    ('decadent', '2026-03-21', 1, 'lineup', false, '오프닝'),
    ('playbook', '2026-03-21', 2, 'lineup', false, null),
    ('the-dinosaurs-skin', '2026-03-21', 3, 'lineup', false, null),
    ('nasanghyeon-band', '2026-03-21', 4, 'lineup', false, null),
    ('byebyebadman', '2026-03-21', 5, 'lineup', false, null),
    ('jisokuryclub', '2026-03-21', 6, 'lineup', false, null),
    ('the-solutions', '2026-03-21', 7, 'lineup', false, '스테이지 피날레'),
    ('sininryu', '2026-03-22', 1, 'lineup', false, '오프닝'),
    ('song-sohee', '2026-03-22', 2, 'lineup', false, null),
    ('baek-hyunjin', '2026-03-22', 3, 'lineup', false, null),
    ('damons-year', '2026-03-22', 4, 'lineup', false, null),
    ('se-so-neon', '2026-03-22', 5, 'lineup', false, null),
    ('hyukoh', '2026-03-22', 6, 'headliner', true, '헤드라이너'),
    ('gogohak', '2026-03-22', 1, 'lineup', false, '오프닝'),
    ('kkachisan', '2026-03-22', 2, 'lineup', false, null),
    ('kiro-akiyama', '2026-03-22', 3, 'lineup', false, 'Sony Music 공지 기준 확인된 슬롯'),
    ('grentperez', '2026-03-22', 4, 'lineup', false, null),
    ('touched', '2026-03-22', 5, 'lineup', false, null),
    ('lee-chan-hyuk', '2026-03-22', 6, 'headliner', true, '헤드라이너'),
    ('twenty-four', '2026-03-22', 1, 'lineup', false, '오프닝'),
    ('gemini', '2026-03-22', 2, 'lineup', false, null),
    ('youra', '2026-03-22', 3, 'lineup', false, null),
    ('home', '2026-03-22', 4, 'lineup', false, null),
    ('bongjeingan', '2026-03-22', 5, 'lineup', false, null),
    ('cafune', '2026-03-22', 6, 'lineup', false, null),
    ('balming-tiger', '2026-03-22', 7, 'lineup', false, '스테이지 피날레')
)
insert into public.event_artists (
  event_id,
  artist_id,
  role,
  display_order,
  is_headliner,
  announcement_status,
  performance_date,
  note
)
select
  'c1b1d9e6-ff6d-4d4b-9f79-ef64a5f00026'::uuid,
  artists.id,
  lineup.role,
  lineup.display_order,
  lineup.is_headliner,
  'confirmed',
  lineup.performance_date::date,
  lineup.note
from lineup
join public.artists on artists.slug = lineup.slug;

insert into public.event_stages (
  event_id,
  performance_date,
  stage_name,
  display_order,
  is_hidden
)
values
  ('c1b1d9e6-ff6d-4d4b-9f79-ef64a5f00026'::uuid, '2026-03-21', 'Stage37', 1, false),
  ('c1b1d9e6-ff6d-4d4b-9f79-ef64a5f00026'::uuid, '2026-03-21', 'Stage126', 2, false),
  ('c1b1d9e6-ff6d-4d4b-9f79-ef64a5f00026'::uuid, '2026-03-21', 'StageX', 3, false),
  ('c1b1d9e6-ff6d-4d4b-9f79-ef64a5f00026'::uuid, '2026-03-22', 'Stage37', 1, false),
  ('c1b1d9e6-ff6d-4d4b-9f79-ef64a5f00026'::uuid, '2026-03-22', 'Stage126', 2, false),
  ('c1b1d9e6-ff6d-4d4b-9f79-ef64a5f00026'::uuid, '2026-03-22', 'StageX', 3, false)
on conflict (event_id, performance_date, stage_name)
do update set
  display_order = excluded.display_order,
  is_hidden = excluded.is_hidden;

insert into public.schedule_slots (
  event_id,
  artist_id,
  event_artist_id,
  stage_name,
  slot_type,
  title,
  start_at,
  end_at,
  is_cancelled,
  source
)
select
  'c1b1d9e6-ff6d-4d4b-9f79-ef64a5f00026'::uuid,
  artists.id,
  event_artists.id,
  'Stage126',
  'performance',
  'Sony Music 공지 기준 확인된 슬롯',
  '2026-03-22T14:30:00+09:00',
  '2026-03-22T15:20:00+09:00',
  false,
  'sony-music-verified'
from public.artists
join public.event_artists
  on event_artists.artist_id = artists.id
 and event_artists.event_id = 'c1b1d9e6-ff6d-4d4b-9f79-ef64a5f00026'::uuid
 and event_artists.performance_date = '2026-03-22'
where artists.slug = 'kiro-akiyama';

insert into public.ticket_links (
  event_id,
  provider_name,
  provider_code,
  url,
  link_type,
  sales_status,
  opens_at,
  price_note,
  is_primary
)
values
  (
    'c1b1d9e6-ff6d-4d4b-9f79-ef64a5f00026',
    'Melon Ticket 예매',
    'melon-ticket',
    'https://ticket.melon.com/performance/index.htm?prodId=212651',
    'general',
    'open',
    '2026-01-29T16:00:00+09:00',
    '1일권 121,000원 / 2일권 193,000원',
    true
  ),
  (
    'c1b1d9e6-ff6d-4d4b-9f79-ef64a5f00026',
    '티켓 오픈 공지',
    'melon-ticket-notice',
    'https://ticket.melon.com/csoon/detail.htm?csoonId=11659',
    'official_info',
    'open',
    '2026-01-29T16:00:00+09:00',
    '오픈 공지와 권종 확인용 링크',
    false
  );

commit;
