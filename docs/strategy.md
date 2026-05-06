# FestivalNavigator Strategy

## 현재 기준

- 현재 POC의 메인 기준 행사는 `The Glow 2026`
- 이벤트 메뉴는 `Festival` 중심으로 먼저 구현
- `Concerts`는 메뉴만 열어두고 후속 확장
- 이번 단계의 핵심은 `발견 -> 상세 탐색 -> 위치 확인 -> 예매 -> 추후 타임테이블 저장` 흐름 검증

## 제품 방향

### 이번 POC에서 검증할 가치

- 실제 페스티벌 한 개를 깊게 다루면 어떤 데이터 구조가 필요한지 빠르게 알 수 있다.
- 사용자는 단순 공연 목록보다 아래 흐름에서 가치를 느낀다.
  - 어떤 행사인지
  - 라인업이 어떤지
  - 어느 스테이지에서 보는지
  - 어떻게 가는지
  - 어디서 예매하는지
  - 나중에 내 일정으로 저장할 수 있는지

### 지금 서비스가 제공해야 할 핵심 정보

- 행사명 / 일정 / 장소 / 좌표
- 행사 설명 / 분위기 / 대표 라인업
- Day별 라인업
- Stage별 순서 또는 정확한 timetable
- 예매 링크 / 티켓 오픈 정보
- 현재 위치에서 길찾기
- 추후 확장용 개인화 포인트
  - 내 아티스트
  - 관심 행사
  - 타임테이블 저장
  - 공연 시작 / 티켓 오픈 알림

## 실데이터 전략

### 우선 자동 수집 가능한 항목

- 행사명
- 행사 기간
- 장소명
- 주소
- 좌표
- 예매처 이름
- 티켓 오픈 공지 메타데이터
- 장르 / 카테고리
- 일부 라인업 이름

### 초반에는 운영자 검수가 필요한 항목

- 스테이지별 exact timetable
- 헤드라이너 강조 방식
- 최신 예매 URL 정합성
- 셔틀 / 입장 / 물품보관 / 푸드존 같은 운영 정보
- 동선 팁 / 추천 하이라이트

### 추천 데이터 소스 조합

- 공공/카탈로그 소스
  - 한국문화정보원 공연/전시/행사 계열 OpenAPI
  - 한국관광공사 행사/축제 계열 OpenAPI
- 공식 판매 / 공식 공지
  - 멜론티켓 같은 실제 판매처
  - 공식 홈페이지 / 공식 SNS / 운영사 공지
- 운영자 수동 입력
  - 라인업 검수
  - timetable 확정 입력
  - 추천 동선 및 하이라이트 큐레이션

### 실제 우선순위 제안

1. `Melon Ticket`
   일정, 장소, 권종, 가격, 티켓 오픈 시각, 판매 상태
2. `공식 Instagram / 공식 공지`
   라인업 공개, timetable 이미지, 운영 변경 공지
3. `공식 사이트`
   보조 검증
4. `아티스트 공식 일정 / 준공식 집계`
   검수 대기 데이터로만 활용

### 현실적인 수집 방식

1. 자동 수집
   일정, 장소, 주소, 좌표, 판매처, 오픈일
2. 운영자 검수
   라인업과 예매 링크 정리
3. 운영자 확정 입력
   stage별 timetable, 하이라이트, 이동 팁

추가 원칙:
- timetable은 완전 자동 게시하지 않는다.
- 이미지/OCR 기반 수집 결과는 반드시 검수 후 반영한다.
- 재판매 링크나 비공식 블로그는 운영 데이터 소스로 쓰지 않는다.

## 데이터 모델 초안

- `events`
  - 행사 기본 정보
- `venues`
  - 장소, 주소, 좌표, 지도 링크
- `artists`
  - 아티스트 기본 정보
- `event_artists`
  - 행사와 라인업 연결
- `schedule_slots`
  - day, stage, start/end time, order
- `ticket_links`
  - 판매처, 권종 메모, 상태, 오픈일
- `user_followed_artists`
  - 추후 개인화 알림용
- `saved_timetable_slots`
  - 사용자가 저장한 세트

## 배포 전략

### 권장 스택

- 프론트엔드: `Next.js` + `Vercel`
- DB/Auth/Storage: `Supabase`
- 알림: 추후 `OneSignal`
- 배치/동기화:
  - 초반: `Vercel Cron + Route Handler`
  - 이후: `Supabase Edge Functions`

### 환경 분리

- `local`
  - mock data 또는 개발용 Supabase
- `preview`
  - 브랜치별 Vercel Preview
  - staging Supabase 연결
- `production`
  - 실제 도메인
  - production Supabase 분리

### 비밀값 관리 원칙

- `NEXT_PUBLIC_*` 값은 브라우저 노출 가능한 값만 사용
- service role key, 외부 수집 API 키, OneSignal REST 키는 서버 전용
- preview / production 환경변수는 반드시 분리

### 배포 순서

1. 현재 Next.js 앱을 Vercel에 배포
2. preview 환경변수 연결
3. production 환경변수 분리
4. Supabase staging / production 프로젝트 분리
5. 사용자 기능 공개 전 RLS 적용
6. 이후 알림 발송 파이프라인 연결

## 자동화 전략

### 배치 대상

- 신규 행사 카탈로그 수집
- 변경된 일정 / 장소 / 예매 정보 동기화
- 알림 대상 스캔

### 권장 파이프라인

1. 외부 소스 fetch
2. staging 테이블에 적재
3. 운영자 검수
4. 승인된 데이터만 publish

### 알림 전략

- 지금은 intent 저장만 먼저
  - 티켓 오픈 알림
  - 공연 시작 알림
  - 내 아티스트 관련 행사 알림
- 이후 production에서만 cron dispatch 실행
- 발송 이력은 반드시 자체 DB에 저장

## 현재 The Glow 2026 기준 다음 단계

1. `artists`, `event_artists`, `schedule_slots`, `ticket_links` 스키마 초안 추가
   구현 초안: `docs/20260319_festival_core.sql`
2. admin에서 lineup / timetable 입력 구조 설계
   - 직접 입력 편집
   - drag and drop 기반 lineup time board
   - 시간이 없는 TBD 상태에서도 `보기 우선순위`를 관리할 수 있는 fallback UX
   - stage 컬럼 순서 조정
   - day별 `visible start/end` 조절
   - 기본 5분 간격 timeline board
   - 카드가 실제 시간을 점유하는 block형 layout
   - 카드 리사이즈로 시간이 바로 반영되는 편집 UX
   - 블록 상단/하단 양방향 리사이즈
   - 우측 drawer형 metadata inspector 패널
   - 하단 긴 inline 편집 폼 제거, block-first 편집으로 단순화
   - 빈 artist row 때문에 생기는 ghost stage는 board에서 숨김
   - per-stage `TBD Queue` 대신 day 단위 `Unscheduled Blocks` dock 사용
   - unscheduled block을 stage timeline에 직접 드롭하면 날짜/stage/start/end를 한 번에 반영
   - day header와 metadata drawer에서 `+ Stage 추가` 가능
   - 빈 lineup 상태에서도 day 단위 stage 컬럼을 먼저 만들 수 있는 editor UX 제공
   - metadata drawer의 stage는 자유 입력보다 선택형 + quick add 중심으로 단순화
   - stage 컬럼 헤더에서 이름 변경 가능
   - admin 저장값은 `/events` 상세 조립 로직과 같은 DB 소스를 통해 public에 반영
   - 시간이 없는 lineup row도 stage/stage order metadata를 잃지 않도록 저장
   - public lineup / timetable은 admin stage order를 우선 반영
   - timeline drop은 날짜 / stage / start / end를 한 번의 상태 변경으로 반영해 day별 동작 차이를 줄임
   - block metadata drawer는 보드 왼쪽 쪽에 두어 timeline 가림을 줄임
   - metadata drawer에서 Start / End를 `±5분` 단위로 미세 조정 가능
   - stage timeline 컬럼 전체를 drop target으로 사용해, 선 위가 아니라 컬럼 아무 위치에 놓아도 가장 가까운 5분 슬롯으로 반영
   - timed block은 가운데 콘텐츠를 클릭할 때만 metadata drawer가 열리도록 해 edge 클릭 오작동을 줄임
   - 저장/편집 피드백은 시스템 alert 대신 자동 소멸 toast와 알림 히스토리 패널로 제공
   - 자잘한 보드 편집 알림은 숨기고 저장/오류 같은 중요한 알림만 toast로 유지
   - admin 상단 메뉴 순서는 Event Basics에서 브라우저 기준으로 조정 가능
   - admin lineup / timetable 모두 Day selector로 하루씩 전환해 편집
   - `+ Day 추가`로 end date 범위를 안전하게 늘리고, 선택한 Day를 곧바로 편집 대상으로 전환
   - 선택한 Day 기준으로 artist block / timetable row를 바로 생성
   - Day 삭제는 현재 마지막 Day에서만 허용하고, 데이터가 있으면 날짜를 직접 입력해야 삭제되도록 보호
   - 빈 stage는 admin에서 안전하게 삭제하고, 저장 후 public stage 집계에도 반영
   - 다음 단계에서 `stage order`, `visible start/end`, stage metadata를 DB에 영구 저장
   - 이후 단계에서 유저용 `/events/[id]` 편집 화면에 같은 보드 모델 재사용
3. 사용자 타임테이블 저장 UX 추가
   - 데이터 계층은 `admin event = canonical source`, `public event = read-only projection`, `user planner = personal override layer`로 고정
   - 별도 `My Timetable` 메뉴뿐 아니라 `/events/[id]` 라인업에서 바로 활성화/편집
   - 사용자가 손댄 버전은 개인 타임테이블 초안으로 이어받기
   - performance block은 클릭 한 번으로 planner에 담기/해제
   - 활성 블록은 색으로 구분하고, 부분 관람은 블록 안에서 5분 단위로 범위 조절
   - 불필요한 상세 팝업은 줄이고, meal/rest/move/custom도 즉시 추가
   - public timetable에서는 별도 요약 카드 대신 같은 day sheet 안의 `My Plan` lane에서 manual block을 바로 편집
   - 유저가 손대지 않은 performance selection은 public 원본 변경을 따라가고, 조정한 block만 개인 override로 유지
   - reset은 block / day / event 세 레벨로 제공해 언제든 원본 timetable 기준으로 되돌릴 수 있게 설계
   - 첫 annotation 단계에서는 선택된 일정 block과 manual sticker에 `from/to + gap minutes` 라벨을 직접 붙여 동선 맥락을 시각화
   - active performance block의 상태는 색 위주로 보여주고, 중복 시간 텍스트는 줄인다
   - 시간 조절은 입력창보다 block 상단/하단 drag handle로 색 영역 자체를 조정하는 쪽을 우선
   - manual asset은 `MEAL / REST / MOVE / NOTE` 타입 라벨과 shape 차이로 더 빨리 식별되게 정리
   - `MOVE`는 화살표형 block과 timetable overlay arrow를 함께 써서 어디서 어디로 이동하는지 보이게 한다
   - 다음 polish 후보는 색칠된 관람 범위를 블록 상단/하단 micro handle로 조절하는 direct manipulation UX
   - 그 다음 단계 후보는 timetable 위에 화살표, 이동시간 라벨, meal sticker, 자유 메모를 얹는 annotation overlay layer
4. 내 아티스트 기반 하이라이트 표시 추가
5. 공공 API + 공식 링크 조합의 ingestion 실험 시작

## 바로 다음 작업

1. admin 사용성 보강 마무리
   - import preview / diff
   - empty state 액션 버튼 강화
   - stage 삭제 / 숨김 / 복구
   - stage lifecycle은 `hide` 기본, `hard delete`는 빈 stage일 때만 허용
   - public 반영 우선순위는 `event_stages > schedule_slots > legacy note metadata`
2. public `/events/[id]` polish
   - 시간축 기반 read-only lineup / timetable board 유지
   - day selector로 하루씩 전환해 3일 이상 행사에서도 스크롤 부담 줄이기
   - day selector를 상단 segmented control처럼 다듬기
   - 각 day 버튼에 날짜/스테이지 수/하이라이트 요약 붙이기
   - overview에 read-only mini timetable preview 추가
   - overview의 stage badge는 실제 act가 있는 stage만 표시
   - 모바일 hero 정보 밀도 줄이기
   - 모바일 탭 sticky bar 검토
   - 내부용 문구 제거
   - 개인 planner 활성화 흐름으로 자연스럽게 연결
   - lineup / timetable 카드에서 planner 상태와 CTA를 더 직접적으로 보여주기
3. 개인 timetable 충돌 감지와 이동/식사/rest asset 편집 강화
   - 현재는 겹침 검증과 부분 관람 범위 조절까지 반영
   - 다음은 이동시간 부족 경고와 추천 로직
4. `artist follow`를 `artists` 축으로 추가하고, 이후 notifications를 같은 모델 위에 연결
5. `event_source_links`, `uploaded_assets`, `analysis_runs`, `proposed_*` 기반 staging-review ingest 계층 추가
