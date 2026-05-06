import { seoulJazzFestival2026Event } from '@/lib/seoul-jazz-2026';
import { Event } from '@/types/database';

export const mockEvents: Event[] = [
  {
    id: 'festival-the-glow-2026',
    title: '더 글로우 2026 (THE GLOW 2026)',
    artist: 'HYUKOH, Lee Seung Yoon, Lee Chan Hyuk, Se So Neon 외',
    description:
      'THE GLOW 2026은 원더로크가 운영하는 실제 실내형 뮤직 페스티벌입니다. 현재 POC는 공개 기사와 예매처 기준으로 일정, 장소, 라인업, 스테이지 구조, 예매 링크를 먼저 반영하고, 분 단위 타임테이블과 운영 세부는 다음 단계에서 보강합니다.',
    start_date: '2026-03-21T00:00:00+09:00',
    end_date: '2026-03-22T23:59:00+09:00',
    venue: 'KINTEX 제2전시장 Hall 7·8·9·10A',
    venue_address: '경기도 고양시 일산서구 킨텍스로 217-59',
    venue_lat: 37.6674,
    venue_lng: 126.7453,
    genre: 'indie',
    event_type: 'festival',
    image_url: 'https://www.art-culture.co.kr/data/editor/2602/e0a09f182bf20f291a39dd17ae967598_1770113820_534.png',
    price_range: '1일권 121,000원 / 2일권 193,000원',
    ticket_url: 'https://ticket.melon.com/performance/index.htm?prodId=212651',
    ticket_open_time: '2026-01-29T16:00:00+09:00',
    age_limit: '8세 이상',
    artist_profile:
      '원더로크가 운영하는 실내형 뮤직 페스티벌로, 2026년 행사에서는 3개 스테이지와 공개 라인업 기반 탐색 경험을 핵심 POC 시나리오로 삼습니다.',
    created_at: '2026-03-19T00:00:00+09:00',
    updated_at: '2026-03-19T00:00:00+09:00',
  },
  seoulJazzFestival2026Event,
];
