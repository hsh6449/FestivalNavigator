# Supabase Setup Guide

FestivalNavigator를 실제 Supabase 프로젝트에 연결하는 최소 절차입니다.

## 1. Supabase 프로젝트 생성

1. [Supabase Dashboard](https://supabase.com/dashboard) 에서 새 프로젝트를 만듭니다.
2. 프로젝트 생성이 끝나면 `Project Settings > API` 로 이동합니다.
3. 아래 값을 복사합니다.
   - `Project URL`
   - `anon public` key

## 2. 로컬 환경 변수 설정

프로젝트 루트에 `.env.local` 파일을 만들고 아래처럼 입력합니다.

```env
NEXT_PUBLIC_SUPABASE_URL=your_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
NEXT_PUBLIC_ONESIGNAL_APP_ID=
NEXT_PUBLIC_EVENTS_API_URL=
```

`NEXT_PUBLIC_ONESIGNAL_APP_ID` 와 `NEXT_PUBLIC_EVENTS_API_URL` 은 지금 단계에서는 비워도 됩니다.

## 3. SQL 적용 순서

Supabase `SQL Editor` 에서 아래 순서대로 실행하세요.

1. [20260319_festival_core.sql](/Users/sanhahwang/Documents/Side%20project/FestivalNavigator/docs/20260319_festival_core.sql)
2. [20260319_seed_the_glow_2026.sql](/Users/sanhahwang/Documents/Side%20project/FestivalNavigator/docs/20260319_seed_the_glow_2026.sql)
3. [20260319_support_tables.sql](/Users/sanhahwang/Documents/Side%20project/FestivalNavigator/docs/20260319_support_tables.sql)

이미 기존 core SQL을 적용한 프로젝트라면, stage 독립 저장용 마이그레이션도 추가로 실행하세요.

4. [20260320_event_stages.sql](/Users/sanhahwang/Documents/Side%20project/FestivalNavigator/docs/20260320_event_stages.sql)
5. [20260320_event_board_settings.sql](/Users/sanhahwang/Documents/Side%20project/FestivalNavigator/docs/20260320_event_board_settings.sql)

의도:
- `festival_core`: 이벤트, 아티스트, 라인업, 타임테이블, 티켓 링크
- `seed_the_glow_2026`: 실제 POC 이벤트 1건
- `support_tables`: 리뷰/알림 기능용 지원 테이블과 정책
- `event_stages`: stage 컬럼 순서와 빈 stage 컬럼까지 독립 데이터로 저장
- `event_board_settings`: day별 visible start/end와 board 설정 저장

## 4. 적용 후 확인할 것

SQL Editor에서 아래 쿼리로 바로 확인할 수 있습니다.

```sql
select id, title, event_type
from public.events
order by start_date asc;
```

```sql
select count(*) as lineup_count
from public.event_artists;
```

```sql
select provider_name, is_primary
from public.ticket_links;
```

```sql
select performance_date, stage_name, display_order
from public.event_stages
order by performance_date asc nulls first, display_order asc nulls last;
```

```sql
select day_key, visible_start_time, visible_end_time, interval_minutes
from public.event_board_settings
order by day_key asc;
```

## 5. 앱에서 확인할 것

1. `/events` 에서 `더 글로우 2026` 이 보이는지 확인
2. `/events/[id]` 상세에서 대표 이미지, 라인업, 티켓 링크가 붙는지 확인
3. `/admin/events` 에서 `더 글로우 2026` 이 보이는지 확인
4. admin에서 라인업 시간을 바꿔 저장할 수 있는지 확인

## 6. 현재 한계

- 이 저장소에는 아직 로그인/회원가입 UI가 없습니다.
- 그래서 `reviews`, `notifications`, `notification_history` 테이블은 지금 바로 생성해도, 실제 사용은 인증 UI를 붙인 뒤에 활성화됩니다.
- 현재 타임테이블 플래너는 브라우저 `localStorage` 기반입니다. 이후 `user_saved_slots` 또는 `planner_items` 테이블로 서버 저장을 붙일 예정입니다.

## 7. 나중에 개인화 저장을 붙일 때

개인화 저장(`planner_items`, `followed_artists`)은 아직 필수는 아니지만, 미리 스키마 초안을 적용해둘 수 있습니다.

선택 적용 SQL:

6. [20260506_user_state_persistence.sql](/Users/sanhahwang/Documents/Sideproject/FestivalNavigator/docs/20260506_user_state_persistence.sql)

정책 문서:
- [user-state-persistence.md](/Users/sanhahwang/Documents/Sideproject/FestivalNavigator/docs/user-state-persistence.md)

현재 기준 정책:
- 로그인 전에는 계속 `localStorage` 사용
- 서버 저장 첫 버전은 `one-time upload if remote is empty`
- 로컬과 서버의 상시 양방향 sync는 첫 버전 범위가 아님

이 문서를 먼저 보는 이유:
- 기존 로컬 데이터 이관 규칙
- `artist_slug`와 `artist_name` 역할 분리
- planner 시간 포맷 통일 기준
- 부분 실패와 빈 상태 UX 기준

## 8. 가장 흔한 실패 원인

- `.env.local` 이 아니라 `.env.local.example` 만 수정한 경우
- SQL 적용 순서를 바꾼 경우
- 브라우저를 새로고침하지 않아 이전 mock 상태를 보고 있는 경우
- `public.events.id` 타입을 임의로 바꿔 seed SQL과 맞지 않게 만든 경우
