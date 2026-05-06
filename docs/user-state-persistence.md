# User State Persistence Plan

FestivalNavigator의 개인화 상태는 현재 브라우저 `localStorage`에 저장됩니다.
이 문서는 나중에 `Supabase`로 옮길 때의 기준선을 먼저 고정하기 위한 초안입니다.

관련 SQL 초안:
- [20260506_user_state_persistence.sql](/Users/sanhahwang/Documents/Sideproject/FestivalNavigator/docs/20260506_user_state_persistence.sql)

## Scope

이번 문서가 다루는 개인화 상태는 아래 두 가지입니다.

1. `followed_artists`
2. `planner_items`

리뷰, 알림, 관리자 입력 데이터는 별도 테이블과 정책을 따릅니다.

## Current Mode

- 현재 앱 런타임 모드: `local-only`
- 현재 원본 저장소: 브라우저 `localStorage`
- 현재 목적: 기능 검증과 UX 고도화
- 현재 원칙: DB가 없어도 앱은 그대로 동작해야 함

## Future Source Of Truth

서버 저장이 활성화되면 아래를 기준으로 삼습니다.

- `followed_artists`: 서버를 장기 원본으로 사용
- `planner_items`: 서버를 장기 원본으로 사용
- `localStorage`: 캐시 / 임시 fallback / 첫 마이그레이션 소스로만 사용

중요:
- 서버 전환 이후에도 `localStorage`를 장기 원본으로 유지하지 않습니다.
- 서버와 로컬의 양방향 상시 sync는 이번 단계의 목표가 아닙니다.

## Migration Rule

서버 저장을 붙이는 첫 버전의 정책은 아래처럼 고정합니다.

1. 사용자가 로그인하지 않은 상태에서는 계속 `localStorage`만 사용합니다.
2. 사용자가 로그인하고, 서버 테이블이 준비되어 있으면 `1회 이관`을 시도합니다.
3. `1회 이관`은 “서버에 아직 해당 사용자 데이터가 없을 때만” 실행합니다.
4. 서버에 이미 데이터가 있으면, 서버 데이터를 우선 표시하고 로컬 데이터는 자동 병합하지 않습니다.
5. 자동 병합 대신, 필요하면 이후 버전에서 `로컬 초안 가져오기` 같은 명시적 액션을 추가합니다.

이 스프린트 기준 결론:
- 기본 정책은 `one-time upload if remote is empty`
- 기본 정책은 `always-on bidirectional sync`가 아닙니다.

이 규칙을 쓰는 이유:
- 중복 생성 리스크를 줄이기 쉽습니다.
- 덮어쓰기 사고를 줄일 수 있습니다.
- QA 관점에서 복구 시나리오가 단순해집니다.

## Identity Rules

### Followed Artists

- `artist_slug`: 식별자
- `artist_name`: 표시값

규칙:
- 팔로우 중복 판별은 `artist_slug` 기준입니다.
- UI 표시와 사용자 문구는 `artist_name` 기준입니다.
- 나중에 `artists.id`가 안정적으로 연결되더라도, 초기에 수집된 팔로우는 `artist_slug`를 fallback 식별자로 유지합니다.

즉:
- `slug`는 비교용
- `name`은 렌더링용

### Planner Items

- `client_item_id`: 로컬에서 생성된 항목 키
- `id`: 서버 row id
- `linked_slot_id`: public performance block과 연결된 식별자

규칙:
- 클라이언트와 서버 사이의 동일 항목 판별은 `client_item_id`를 기준으로 합니다.
- 성능 블록 연결 여부는 `linked_slot_id`를 기준으로 추가 검증합니다.

## Time Format Rules

시간 관련 값은 아래 규칙을 따릅니다.

- `planner_date`: `YYYY-MM-DD`
- `planned_start`, `planned_end`, `default_start`, `default_end`: 저장 시 `timestamptz`
- 브라우저 내부 helper는 당분간 `YYYY-MM-DDTHH:mm` 로컬 문자열을 계속 사용할 수 있음

중요:
- 저장 직전에는 항상 서버용 timestamp 포맷으로 정규화해야 합니다.
- 정렬과 validation은 저장 전후 모두 `planned_end > planned_start`를 만족해야 합니다.
- `HH:mm`, `datetime-local`, ISO 문자열을 섞어 쓰더라도 서버 경계에서는 하나의 포맷으로 강제 변환해야 합니다.

## Partial Failure Rule

서버 저장이 붙으면, `followed_artists`와 `planner_items`는 서로 다른 저장 단위로 봅니다.

즉:
- 팔로우 저장 성공 / 플래너 저장 실패 가능
- 플래너 저장 성공 / 팔로우 저장 실패 가능

첫 버전 원칙:
- 각 도메인은 독립 저장
- 한쪽 실패가 다른 쪽 성공을 롤백하지 않음
- 실패한 도메인만 재시도 가능해야 함

필수 UX:
- 어떤 저장이 실패했는지 구분된 문구
- 재시도 액션 또는 다음 진입 시 재시도 가능 상태
- 혼합 상태에서 “현재는 이 기기에만 저장됨” 또는 “계정에 저장됨” 같은 안내

## Empty State Rule

서버 저장 전환 이후에는 빈 상태도 구분해서 보여줘야 합니다.

1. 로그인 안 함
   - 개인화 데이터는 이 기기에서만 유지된다고 안내
2. 로그인했지만 서버 데이터 없음
   - 새 계정이거나 아직 이관 전 상태로 안내
3. 서버 저장 불가 / 테이블 미준비 / 네트워크 실패
   - local fallback 상태임을 안내

## QA Checklist

서버 저장을 실제로 붙일 때 최소 확인 항목은 아래입니다.

1. 로컬 데이터가 서버 빈 계정으로 한 번만 이관되는가
2. 서버에 기존 데이터가 있을 때 로컬 데이터가 자동으로 덮어쓰지 않는가
3. 같은 아티스트를 표기 흔들림이 있어도 중복 팔로우하지 않는가
4. `planned_start`, `planned_end`가 저장 후에도 같은 순서와 validation을 유지하는가
5. 일부 저장 실패 시 사용자에게 저장 위치와 실패 범위가 보이는가
