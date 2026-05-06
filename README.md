# FestivalNavigator - 라이브 공연 관리 플랫폼

FestivalNavigator는 라이브 공연 정보를 관리하고 알림을 받을 수 있는 웹 애플리케이션입니다.

## 주요 기능

- 공연 목록 조회 및 검색
- 공연 상세 정보 확인
- 공연장 위치 지도 확인
- 리뷰 작성 및 관리
- 공연 알림 설정
- 알림 관리
- 관리자용 공연 등록

## 기술 스택

- Next.js 15
- TypeScript
- Tailwind CSS
- Supabase
- OneSignal

## 시작하기

### 필수 조건

- Node.js 18.0.0 이상
- npm
- Supabase 계정
- OneSignal 계정

### 설치

1. 저장소 클론
```bash
git clone https://github.com/your-username/FestivalNavigator.git
cd FestivalNavigator
```

2. 의존성 설치
```bash
npm install
```

3. 환경 변수 설정
`.env.local.example`를 복사해 `.env.local` 파일을 만들고 다음 변수들을 설정합니다:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_ONESIGNAL_APP_ID=your_onesignal_app_id
NEXT_PUBLIC_EVENTS_API_URL=optional_external_events_api_url
```

`NEXT_PUBLIC_EVENTS_API_URL`은 선택값입니다. 설정하지 않으면 앱은 Supabase의 `events` 테이블에서 데이터를 조회합니다.

- `NEXT_PUBLIC_SUPABASE_URL`: Supabase 대시보드의 `Project Settings > API`에 있는 프로젝트 URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: 같은 화면의 `anon public` 키
- `NEXT_PUBLIC_ONESIGNAL_APP_ID`: OneSignal 앱 생성 후 `Settings`에서 발급되는 App ID

Supabase를 아직 만들지 않았다면, 앱은 개발용 샘플 공연 데이터로 실행됩니다. 이 경우 공연 조회/상세는 확인할 수 있지만 리뷰, 알림 저장, 관리자 등록은 비활성화됩니다.

4. 개발 서버 실행
```bash
npm run dev
```

### 실제 Supabase에 The Glow 2026 넣기

1. `.env.local` 파일을 만들고 아래 값을 채웁니다.
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_ONESIGNAL_APP_ID=your_onesignal_app_id
```

2. Supabase SQL Editor에서 [docs/20260319_festival_core.sql](/Users/sanhahwang/Documents/Side%20project/FestivalNavigator/docs/20260319_festival_core.sql) 를 먼저 실행합니다.

3. 이어서 [docs/20260319_seed_the_glow_2026.sql](/Users/sanhahwang/Documents/Side%20project/FestivalNavigator/docs/20260319_seed_the_glow_2026.sql) 를 실행합니다.

4. stage를 독립 데이터로 저장하려면 [docs/20260320_event_stages.sql](/Users/sanhahwang/Documents/Side%20project/FestivalNavigator/docs/20260320_event_stages.sql) 도 실행합니다.

5. board의 visible start/end를 저장하려면 [docs/20260320_event_board_settings.sql](/Users/sanhahwang/Documents/Side%20project/FestivalNavigator/docs/20260320_event_board_settings.sql) 도 실행합니다.

6. 리뷰/알림용 지원 테이블까지 준비하려면 [docs/20260319_support_tables.sql](/Users/sanhahwang/Documents/Side%20project/FestivalNavigator/docs/20260319_support_tables.sql) 도 실행합니다.

7. 나중에 개인화 저장을 서버로 올릴 준비까지 해두려면 [docs/20260506_user_state_persistence.sql](/Users/sanhahwang/Documents/Sideproject/FestivalNavigator/docs/20260506_user_state_persistence.sql) 도 실행할 수 있습니다.

8. 개발 서버를 다시 띄운 뒤 `/events` 와 `/admin/events` 에서 `더 글로우 2026` 이 보이는지 확인합니다.

참고:
- 현재 seed는 `public.events.id` 가 `uuid` 인 구성을 기준으로 작성되어 있습니다.
- 이벤트 상세 POC 데이터는 이제 `id` 뿐 아니라 `title` 과 `ticket_url` 로도 매칭되므로, DB에 uuid 기반으로 넣어도 The Glow 상세 화면이 붙습니다.
- exact timetable은 공개 검증된 슬롯만 seed에 넣었고, 전체 순서는 라인업 데이터와 POC 콘텐츠에서 보강합니다.
- 전체 연결 절차는 [docs/supabase-setup.md](/Users/sanhahwang/Documents/Side%20project/FestivalNavigator/docs/supabase-setup.md) 에 정리해두었습니다.
- 개인화 저장 전환 정책은 [docs/user-state-persistence.md](/Users/sanhahwang/Documents/Sideproject/FestivalNavigator/docs/user-state-persistence.md) 에 정리해두었습니다.

### Supabase에 The Glow 2026 seed 넣기

실제 DB로 `The Glow 2026`를 올리려면 아래 순서로 진행합니다.

1. Supabase SQL Editor에서 기본 festival 테이블 초안을 먼저 적용합니다.
- `docs/20260319_festival_core.sql`

2. `public.events.id` 타입을 확인합니다.
- 현재 seed와 core SQL은 `uuid` 구성을 기준으로 작성되어 있습니다.
- 이벤트 상세 POC는 이제 `id` 뿐 아니라 `title`, `ticket_url` 기준으로도 fallback 매칭됩니다.

3. The Glow seed를 적용합니다.
- `docs/20260319_the_glow_seed.sql`

4. stage 독립 저장을 쓰려면 아래 migration도 적용합니다.
- `docs/20260320_event_stages.sql`

5. board settings 영속화를 쓰려면 아래 migration도 적용합니다.
- `docs/20260320_event_board_settings.sql`

6. `.env.local`에 Supabase 값을 넣고 개발 서버를 다시 실행합니다.

적용 후 기대 결과:
- `/events`에 `The Glow 2026`가 실제 DB 데이터로 표시됨
- `/admin/events`에서 같은 이벤트를 수정 가능
- `event_artists`, `ticket_links`, `schedule_slots`, `event_stages`, `event_board_settings`가 seed/관리 기준으로 채워짐

주의:
- 현재 seed의 타임테이블은 공개 검증된 슬롯만 넣습니다.
- 나머지 아티스트는 `event_artists` 라인업으로 먼저 관리하고, exact time 확보 후 `schedule_slots`를 추가하는 방식입니다.

## 데이터베이스 스키마

### events
- id: string
- title: string
- artist: string
- description: string
- start_date: string
- end_date: string
- venue: string
- venue_address: string | null
- venue_lat: number | null
- venue_lng: number | null
- genre: string
- image_url: string | null
- price_range: string | null
- ticket_url: string | null
- ticket_open_time: string | null
- age_limit: string | null
- artist_profile: string | null
- created_at: string
- updated_at: string

### reviews
- id: string
- event_id: string
- user_id: string
- rating: number
- content: string
- created_at: string
- updated_at: string

### notifications
- id: string
- user_id: string
- event_id: string
- type: 'ticketing' | 'start'
- created_at: string
- updated_at: string

### notification_history
- id: string
- notification_id: string
- user_id: string
- sent_at: string
- status: 'sent' | 'failed'
- created_at: string
- updated_at: string

### event_stages
- id: string
- event_id: string
- performance_date: string | null
- stage_name: string
- display_order: number | null
- is_hidden: boolean
- created_at: string
- updated_at: string

### event_board_settings
- id: string
- event_id: string
- day_key: string
- visible_start_time: string
- visible_end_time: string
- interval_minutes: number
- created_at: string
- updated_at: string

### followed_artists
- id: string
- user_id: string
- artist_id: string | null
- artist_slug: string
- artist_name: string
- last_event_id: string | null
- last_event_title: string | null
- last_seen_date: string | null
- last_seen_stage: string | null
- followed_at: string
- created_at: string
- updated_at: string

### planner_items
- id: string
- user_id: string
- client_item_id: string
- event_id: string
- event_title: string
- event_venue: string
- event_image_url: string | null
- planner_date: string
- day_label: string
- item_type: 'performance' | 'meal' | 'rest' | 'move' | 'custom'
- title: string
- stage: string | null
- artist: string | null
- default_start: string | null
- default_end: string | null
- planned_start: string
- planned_end: string
- order_index: number | null
- note: string | null
- source: 'festival-slot' | 'manual'
- linked_slot_id: string | null
- is_active: boolean
- migrated_from_local: boolean
- created_at: string
- updated_at: string

## 현재 구현 범위

- 인증 UI는 아직 구현되지 않았습니다.
- 비로그인 사용자는 공연 조회와 상세 확인은 가능하지만 리뷰 작성과 알림 저장은 할 수 없습니다.
- 관리자 페이지는 현재 내부 운영용 등록 화면입니다.
- 개인 플래너와 아티스트 팔로우는 현재 `localStorage` 기반이며, 서버 저장 전환 정책은 문서/SQL 초안까지만 준비된 상태입니다.

## 라이선스

MIT
