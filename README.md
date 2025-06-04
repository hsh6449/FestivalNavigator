# Encore - 라이브 공연 관리 플랫폼

Encore는 라이브 공연 정보를 관리하고 알림을 받을 수 있는 웹 애플리케이션입니다.

## 주요 기능

- 공연 목록 조회 및 검색
- 공연 상세 정보 확인
- 리뷰 작성 및 관리
- 공연 알림 설정
- 알림 관리

## 기술 스택

- Next.js 14
- TypeScript
- Tailwind CSS
- Supabase
- OneSignal

## 시작하기

### 필수 조건

- Node.js 18.0.0 이상
- npm 또는 yarn
- Supabase 계정
- OneSignal 계정

### 설치

1. 저장소 클론
```bash
git clone https://github.com/your-username/encore.git
cd encore
```

2. 의존성 설치
```bash
npm install
# 또는
yarn install
```

3. 환경 변수 설정
`.env.local` 파일을 생성하고 다음 변수들을 설정합니다:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_ONESIGNAL_APP_ID=your_onesignal_app_id
```

4. 개발 서버 실행
```bash
npm run dev
# 또는
yarn dev
```

## 데이터베이스 스키마

### events
- id: string
- title: string
- artist: string
- description: string
- start_date: string
- end_date: string
- venue: string
- genre: string
- image_url: string
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

## 라이선스

MIT
