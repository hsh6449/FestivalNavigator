# FestivalNavigator Plan

## Resume Snapshot

- 현재 기준 제품 축: `admin canonical editor -> public /events/[id] -> planner overlay`
- 지금 바로 이어서 할 일:
  1. planner interaction polish 마감
  2. admin redo / history polish
  3. artist follow / highlight / notifications 연결
- 확인된 안정성:
  - `npm run lint` 경고 0
  - `npm run build` 통과
  - build 뒤에는 dev 서버 재기동 필요
- 주의할 점:
  - `event_stages`, `event_board_settings` migration이 없는 Supabase 환경은 fallback 경로로 동작
  - public 반영은 realtime이 아니라 저장 후 새로고침/재진입 기준
  - undo는 action sequence가 아니라 snapshot history 기반

## Immediate Next Actions

1. planner interaction polish 마감
   - partial selection handle 감도 다듬기
   - sticker snap/생성 위치 polish
   - move 표현을 색/라벨 중심으로 더 단순화할지 검토
   - planner message/toast 밀도 줄이기
2. admin redo / history polish
   - undo 다음 단계로 redo 검토
   - snapshot 범위를 더 세분화해 drag/resize/import 되돌리기 품질 향상
3. artist follow 기반 하이라이트와 notifications 연결
4. ingest/review 계층 추가
   - `event_source_links`
   - `uploaded_assets`
   - `analysis_runs`
   - `proposed_*`

## Current Focus

- `festival-first` POC를 실제 행사 `The Glow 2026` 기준으로 고도화
- admin에서 입력한 데이터가 public `/events` 상세와 자연스럽게 연결되도록 canonical data 흐름 정리
- planner를 event 상세 안에서 직접 짜는 흐름으로 더 자연스럽게 다듬기
- 같은 구조를 user planner, artist follow, notifications로 재사용

## Progress Check

### Completed

- `events`, `event_artists`, `schedule_slots`, `ticket_links` 기반 public event detail 조립
- admin `block-first` lineup timeline board
- 5분 grid, drag/drop, 상단/하단 resize
- metadata drawer 기반 block 편집
- `Unscheduled Blocks` dock으로 미배치 카드 관리
- `event_stages`로 stage 컬럼 순서와 빈 stage 컬럼 독립 저장
- `event_board_settings`로 day별 visible start/end 저장 준비
- admin 탭별 `저장 중 / 미저장 변경 / 마지막 저장` 상태 표시
- stage 컬럼 헤더에서 이름 변경 가능
- timeline drop 시 날짜/stage/start/end를 한 번의 상태 변경으로 반영하도록 정리
- Day1 / Day2 board normalization을 같은 기준으로 정리
- block metadata drawer를 보드 왼쪽 쪽으로 옮겨 보드 가림을 줄임
- metadata drawer에서 Start / End를 `±5분` 버튼으로 미세 조정 가능
- stage timeline 컬럼 전체를 drop target으로 확장해 선 위에 정확히 놓지 않아도 시간 반영 가능
- timed block은 가운데 콘텐츠를 클릭할 때만 metadata drawer가 열리도록 조정
- 저장/편집 피드백은 자동으로 사라지는 공지형 toast와 알림 히스토리로 정리
- 자잘한 admin 알림은 숨기고, 중요한 저장/오류 알림만 toast로 유지
- admin 탭 순서를 Event Basics에서 조정 가능하도록 보강
- public event lineup/timetable은 시간축 기반 read-only board로 표시
- public event에서는 빈 stage 컬럼과 내부용 안내 문구를 숨김
- public event lineup/timetable은 Day selector로 하루씩 전환해서 보도록 개선
- public event Day selector에 날짜/요약 정보를 붙여 segmented control처럼 강화
- public 상세 탭을 모바일에서 sticky하게 유지
- lineup/timetable 카드에서 planner CTA와 활성 상태를 더 직접적으로 노출
- admin lineup/timetable도 Day selector 기반으로 하루씩 전환해서 편집 가능
- admin에서 `+ Day 추가`로 Day 템플릿을 확장하고, 선택한 Day 기준으로 artist/timetable row를 바로 추가 가능
- admin day 삭제는 마지막 Day에만 허용하고, 데이터가 있으면 날짜 직접 입력 후 삭제하도록 보호
- admin에서 빈 stage를 안전하게 삭제할 수 있는 초기 stage lifecycle 반영
- public overview에 선택한 Day 기준 미니 timetable preview 추가
- public overview의 stage badge는 실제 act가 있는 stage만 노출하도록 정리
- `/events/[id]`에서는 블록 클릭으로 바로 내 일정에 담고, 활성 블록 안에서 부분 관람 범위를 5분 단위로 조정 가능
- planner 저장 검증은 `마지막 뒤에만 추가`가 아니라 `겹치지 않는지` 기준으로 정리
- public timetable은 별도 planner 요약 카드 대신 같은 day sheet 위의 overlay layer에서 meal/rest/move/custom block을 바로 다루도록 정리
- public lineup/timetable에서는 `클릭해 담기` 보조 CTA를 걷어내고 block click 중심의 더 깔끔한 planner UX로 단순화
- planner 데이터 모델은 `admin event = canonical source`, `public event = read-only projection`, `user planner = copy-on-write personal override layer`로 정리
- 유저가 손대지 않은 performance selection은 public 원본 변경을 따라가고, 유저가 범위를 조정한 block만 개인 override로 유지
- `day reset / event reset / block reset`으로 언제든 public 원본 기준으로 복귀 가능
- public timetable 첫 annotation 단계로 선택된 일정 block과 manual sticker에 `from/to + gap minutes` 라벨을 직접 붙여 동선을 읽기 쉽게 정리
- public timetable active block의 `내 일정 HH:mm-HH:mm` 텍스트는 제거하고, 상태는 색으로만 표현
- planner 시간 조절은 `±5분` 버튼 대신 block 상단/하단 drag handle 중심으로 전환
- manual planner asset은 `MEAL / REST / MOVE / NOTE` 타입 라벨을 갖고, `MOVE`는 화살표형 block으로 먼저 구분
- `MOVE` asset은 block 라벨뿐 아니라 timetable 위의 overlay arrow로 이전/다음 일정과 연결해 표시
- manual asset은 block 단위 삭제가 항상 가능해야 한다
- planner manual asset은 더 이상 grid 컬럼이나 lane 박스를 차지하지 않고, board 위 absolute overlay item으로 떠 있어야 한다
- manual planner asset은 자동으로 맨 아래 append되지 않고, 기본적으로 day의 첫 빈 시간대에 생성되어야 한다
- manual planner asset은 stage 선택이 가능해야 하며, 선택된 경우 해당 stage column 위에 overlay로 붙어야 한다
- public overview의 stage count와 stage badge는 `event_stages` entity가 있으면 그 기준을 우선 따라야 하고, stale fallback stage 이름은 다시 끌고 오지 않아야 한다
- admin 메뉴 순서는 localStorage 복원 전에 기본값으로 다시 덮어쓰지 않도록 hydrate 이후에만 저장해야 한다
- planner block 선택 시 `buildPerformancePlannerItem`가 사용하는 helper import는 런타임 참조가 끊기지 않도록 유지해야 한다
- admin dead code, OneSignal 전역 타입, public planner helper를 정리해 `npm run build`가 다시 green으로 통과하도록 안정화했다
- Google font fetch 의존을 제거해 제한된 네트워크 환경에서도 production build가 막히지 않도록 정리했다
- planner sticker는 drag 중 stage/time 프리뷰를 바로 보여주고, 빈 gap을 더 똑똑하게 선택하는 방향으로 polish를 계속 진행한다
- 부분 관람 범위는 drag handle뿐 아니라 block 안의 흰 마스크 영역 클릭으로도 빠르게 조정할 수 있어야 한다
- planner feedback은 차단보다 `Overlap`과 `Tight move`를 분리해 읽기 쉽게 보여주는 방향으로 정리한다
- planner interaction은 `문제만 보기`처럼 수정이 필요한 block만 빠르게 집중할 수 있는 모드가 필요하다
- planner interaction에서는 stage 강조와 issue 강조의 역할을 분리해, 어디가 문제인지와 어떤 문제인지가 겹치지 않게 읽혀야 한다
- public event 상세는 `개요 확인 -> 날짜 선택 -> 세트 확인 -> planner 진입` 흐름으로 더 일관되게 읽혀야 한다
- planner는 `전체 보기 / 문제만 보기 / 선택한 것만 보기`처럼 상황별 집중 모드를 갖고 있어야 한다
- planner selection은 겹침 때문에 막지 않고, `선택은 자유롭게 / 충돌은 나중에 조정` 원칙으로 가져가야 한다
- The Glow planner active tone은 흰색 원본 위에 회색 selection으로 보이도록 유지한다
- soft conflict badge는 저장 차단이 아니라 겹침 상태를 시각적으로만 알려주는 경고 레이어여야 한다
- `move`는 일반 block보다 overlay arrow가 주인공이 되도록 계속 비중을 옮겨가야 한다
- `+ Move`는 manual block 추가가 아니라 `move mode`를 켜는 버튼이어야 하고, block 2개를 클릭해 연결하는 흐름이 우선이다
- `move` overlay는 정렬된 앞뒤 item 추론이 아니라, 사용자가 고른 source-target block id를 직접 참조해 그려야 한다
- source-target move metadata parser는 public timetable overlay 경로에서 정확히 같은 형식으로 읽혀야 한다
- move note parser는 planner item id에 `::`가 포함되어도 깨지지 않게 후보 item 매칭 기반으로 해석되어야 한다
- move overlay path는 source/target column 상대 위치에 따라 좌우 방향이 동적으로 바뀌어야 한다
- move 라벨은 block 이름보다 `n분 이동` 같은 짧은 중간 메시지를 우선한다
- backward나 2칸 이상 건너뛰는 move는 block을 덜 침범하도록 위쪽 detour elbow path를 우선 사용한다
- move overlay는 좌표 계산 실패 시에도 SVG가 깨지지 않도록 finite guard를 유지한다
- move 정보는 block 내부 pill이 아니라 얇은 외부 overlay annotation으로만 남겨야 한다
- `next/image` 전환과 hook dependency 정리를 마쳐 build/lint 기준선을 깨끗하게 유지한다
- `next build` 이후 dev 서버는 다시 재기동해 `.next` 충돌로 인한 localhost 500을 피하는 운영 흐름을 유지한다
- `문제만 보기`와 `선택한 것만 보기`는 관련 있는 stage만 남겨 실제 수정 범위를 바로 좁혀주는 방식이 더 유용하다
- 집중 모드에서 관련 stage가 없을 때는 빈 보드 대신 안내 상태와 빠른 복귀 액션을 제공해야 한다

### In Progress

- planner 핵심 UX polish
- admin redo / history polish

### Next

1. planner interaction polish 마감
   - partial selection handle과 sticker snap 감도를 계속 polish
   - move 표현을 색/라벨 중심으로 더 단순하게 실험할지 검토
   - planner message/toast 밀도를 더 줄일지 검토
2. admin redo / history polish
   - undo 다음 단계로 redo 검토
   - snapshot 범위를 더 세분화해 drag/resize/import 되돌리기 품질 향상
3. `artist follow` 기반 하이라이트와 notifications 연결
4. `event_source_links`, `uploaded_assets`, `analysis_runs`, `proposed_*` 기반 ingest/review 계층 추가

## Current Risks

- `event_stages`, `event_board_settings` migration을 아직 적용하지 않은 Supabase 환경에서는 fallback 경로로만 동작
- public 반영은 실시간 subscription이 아니라 저장 후 새로고침/재진입 기준
- undo를 붙일 때 action별 역연산보다 snapshot history를 택하지 않으면 drag/resize/import 같은 복합 편집 흐름에서 구현 복잡도가 크게 올라갈 수 있음
- dev 환경에서는 `next build` 이후 기존 dev 서버를 재기동하지 않으면 `.next` 충돌로 `localhost:3000`이 500을 낼 수 있음
