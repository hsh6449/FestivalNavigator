import type { Event } from '@/types/database';
import { seoulJazzFestival2026Content } from '@/lib/seoul-jazz-2026';

export type FestivalTab = 'overview' | 'lineup' | 'timetable' | 'map' | 'tickets';

export type FestivalAct = {
  artist: string;
  start: string | null;
  end: string | null;
  stage: string;
  order: number;
  stagePosition?: number;
  highlight?: boolean;
  note?: string;
};

export type FestivalDaySchedule = {
  date: string;
  label: string;
  startTimeLabel: string;
  acts: FestivalAct[];
};

export type FestivalTicketLink = {
  label: string;
  url: string;
  status: 'open' | 'coming_soon' | 'sold_out';
  note: string;
};

export type FestivalFactCard = {
  label: string;
  value: string;
};

export type FestivalSource = {
  label: string;
  url: string;
  note: string;
};

export type FestivalTravelLink = {
  label: string;
  url: string;
  note: string;
};

export type FestivalPOCContent = {
  city: string;
  tagline: string;
  heroNote: string;
  lineupSummary: string[];
  stages: string[];
  factCards: FestivalFactCard[];
  transportTips: string[];
  plannerTips: string[];
  syncPlan: string[];
  daySchedules: FestivalDaySchedule[];
  ticketLinks: FestivalTicketLink[];
  travelLinks: FestivalTravelLink[];
  sources: FestivalSource[];
};

export const festivalContent: Record<string, FestivalPOCContent> = {
  'festival-the-glow-2026': {
    city: '고양',
    tagline:
      '실제 공개 정보로 검증하는 festival-first POC. 라인업, 스테이지, 예매, 위치, 이동 흐름을 하나의 상세 경험으로 묶습니다.',
    heroNote:
      '현재 POC는 2026년 3월 기준 공개 기사와 예매 페이지를 바탕으로 구성했습니다. 정확한 분 단위 타임테이블은 후속 수집 대상으로 두고, day/stage/order 중심으로 먼저 설계합니다.',
    lineupSummary: [
      '혁오',
      '이찬혁',
      '이승윤',
      '장기하',
      '새소년',
      'Balming Tiger',
      'The Walters',
      'grentperez',
    ],
    stages: ['Stage37', 'Stage126', 'StageX'],
    factCards: [
      { label: '일정', value: '2026.03.21 - 2026.03.22' },
      { label: '장소', value: 'KINTEX 제2전시장 Hall 7, 8, 9, 10A' },
      { label: '스테이지', value: '3개 스테이지 운영' },
      { label: '예매처', value: 'Melon Ticket 단독 예매' },
    ],
    transportTips: [
      '킨텍스역과 광역버스 접근성이 좋아 대중교통 기준 길찾기 CTA를 전면에 두는 편이 적합합니다.',
      '홀 7, 9, 10A로 스테이지가 분산되어 있어 헤드라이너 직전에는 미리 이동하는 UX가 필요합니다.',
      '공식 안내 기준 수도권 및 지방 주요 지역 유료 셔틀 운영 계획이 있어, 추후 셔틀 탭 또는 교통 카드가 유용합니다.',
    ],
    plannerTips: [
      '지금 단계에서는 exact time보다 Day > Stage > Order 구조가 중요합니다.',
      '사용자가 보고 싶은 아티스트를 저장하면 추후 타임테이블 공개 시 자동 하이라이트와 충돌 감지가 가능합니다.',
      '예매, 이동, 라인업 탐색을 같은 상세 페이지 안에서 이어주는 것이 이 서비스의 핵심 경험입니다.',
    ],
    syncPlan: [
      '공공/공식 소스로 이벤트명, 일정, 장소, 좌표, 예매처를 자동 수집합니다.',
      '라인업은 공식 공지 또는 기사 기반으로 1차 수집 후 운영자가 검수합니다.',
      '스테이지별 exact timetable은 공식 이미지/게시물 확인 후 운영자가 확정 입력합니다.',
      '길찾기는 좌표 기반 외부 지도 링크로 먼저 제공하고, 이후 내 위치 기반 동선 기능으로 확장합니다.',
    ],
    daySchedules: [
      {
        date: '2026-03-21',
        label: 'Day 1',
        startTimeLabel: '공연 시작 11:40',
        acts: [
          { artist: '김승주', start: null, end: null, stage: 'Stage37', order: 1, note: '오프닝' },
          { artist: 'Dragon Pony', start: null, end: null, stage: 'Stage37', order: 2 },
          { artist: '리도어', start: null, end: null, stage: 'Stage37', order: 3 },
          { artist: 'Mate', start: null, end: null, stage: 'Stage37', order: 4 },
          { artist: 'HANRORO', start: null, end: null, stage: 'Stage37', order: 5 },
          { artist: 'Lee Seung Yoon', start: null, end: null, stage: 'Stage37', order: 6, highlight: true, note: '헤드라이너' },
          { artist: '공원', start: null, end: null, stage: 'Stage126', order: 1, note: '오프닝' },
          { artist: 'WIM', start: null, end: null, stage: 'Stage126', order: 2 },
          { artist: '윤마치', start: null, end: null, stage: 'Stage126', order: 3 },
          { artist: 'The Walters', start: null, end: null, stage: 'Stage126', order: 4, highlight: true },
          { artist: '쏜애플', start: null, end: null, stage: 'Stage126', order: 5 },
          { artist: '장기하', start: null, end: null, stage: 'Stage126', order: 6, highlight: true, note: '헤드라이너' },
          { artist: '데카당', start: null, end: null, stage: 'StageX', order: 1, note: '오프닝' },
          { artist: '놀이도감', start: null, end: null, stage: 'StageX', order: 2 },
          { artist: "The Dinosaur's Skin", start: null, end: null, stage: 'StageX', order: 3 },
          { artist: '나상현씨밴드', start: null, end: null, stage: 'StageX', order: 4 },
          { artist: '바이바이배드맨', start: null, end: null, stage: 'StageX', order: 5 },
          { artist: '지소쿠리클럽', start: null, end: null, stage: 'StageX', order: 6 },
          { artist: '솔루션스', start: null, end: null, stage: 'StageX', order: 7, note: '스테이지 피날레' },
        ],
      },
      {
        date: '2026-03-22',
        label: 'Day 2',
        startTimeLabel: '공연 시작 11:40',
        acts: [
          { artist: '신인류', start: null, end: null, stage: 'Stage37', order: 1, note: '오프닝' },
          { artist: '송소희', start: null, end: null, stage: 'Stage37', order: 2 },
          { artist: '백현진', start: null, end: null, stage: 'Stage37', order: 3 },
          { artist: 'Damons Year', start: null, end: null, stage: 'Stage37', order: 4 },
          { artist: '새소년', start: null, end: null, stage: 'Stage37', order: 5, highlight: true },
          { artist: 'HYUKOH', start: null, end: null, stage: 'Stage37', order: 6, highlight: true, note: '헤드라이너' },
          { artist: '고고학', start: null, end: null, stage: 'Stage126', order: 1, note: '오프닝' },
          { artist: '까치산', start: null, end: null, stage: 'Stage126', order: 2 },
          { artist: 'Kiro Akiyama', start: '14:30', end: '15:20', stage: 'Stage126', order: 3, note: 'Sony Music 공지 기준 확인된 슬롯' },
          { artist: 'grentperez', start: null, end: null, stage: 'Stage126', order: 4, highlight: true },
          { artist: '터치드', start: null, end: null, stage: 'Stage126', order: 5 },
          { artist: 'Lee Chan Hyuk', start: null, end: null, stage: 'Stage126', order: 6, highlight: true, note: '헤드라이너' },
          { artist: '이십사일', start: null, end: null, stage: 'StageX', order: 1, note: '오프닝' },
          { artist: 'GEMINI', start: null, end: null, stage: 'StageX', order: 2 },
          { artist: '유라', start: null, end: null, stage: 'StageX', order: 3 },
          { artist: 'HOME', start: null, end: null, stage: 'StageX', order: 4 },
          { artist: '봉제인간', start: null, end: null, stage: 'StageX', order: 5 },
          { artist: 'Cafune', start: null, end: null, stage: 'StageX', order: 6 },
          { artist: 'Balming Tiger', start: null, end: null, stage: 'StageX', order: 7, highlight: true, note: '스테이지 피날레' },
        ],
      },
    ],
    ticketLinks: [
      {
        label: 'Melon Ticket 예매',
        url: 'https://ticket.melon.com/performance/index.htm?prodId=212651',
        status: 'open',
        note: '단독 예매 진행 중',
      },
      {
        label: '티켓 오픈 공지',
        url: 'https://ticket.melon.com/csoon/detail.htm?csoonId=11659',
        status: 'open',
        note: '2026-01-29 16:00 / 1일권 121,000원 / 2일권 193,000원',
      },
    ],
    travelLinks: [
      {
        label: 'Google Maps 길찾기',
        url: 'https://www.google.com/maps/dir/?api=1&destination=37.6674,126.7453',
        note: '현재 위치에서 공연장까지 길찾기',
      },
      {
        label: 'Google Maps 장소 보기',
        url: 'https://www.google.com/maps/search/?api=1&query=37.6674,126.7453',
        note: '킨텍스 제2전시장 좌표 중심 지도 보기',
      },
    ],
    sources: [
      {
        label: '스포츠경향 행사 개요',
        url: 'https://sports.khan.co.kr/en/article/202601262050597',
        note: '일정, 장소, 3개 스테이지, 멜론티켓 예매 정보',
      },
      {
        label: '스포츠경향 라인업 기사',
        url: 'https://sports.khan.co.kr/article/202603122054003',
        note: 'Day 1/Day 2 스테이지별 라인업 순서',
      },
      {
        label: '멜론티켓 상품 페이지',
        url: 'https://ticket.melon.com/performance/index.htm?prodId=212651',
        note: '실제 판매 채널과 상세 상품 정보',
      },
      {
        label: '멜론티켓 오픈 공지',
        url: 'https://ticket.melon.com/csoon/detail.htm?csoonId=11659',
        note: '권종과 티켓 오픈 시간 참고',
      },
    ],
  },
  'festival-seoul-jazz-2026': seoulJazzFestival2026Content,
};

const normalizeLookupValue = (value: string | null | undefined) =>
  value
    ?.toLowerCase()
    .replace(/\s+/g, ' ')
    .trim() ?? '';

const festivalContentAliases: Record<string, string> = {
  'festival-the-glow-2026': 'festival-the-glow-2026',
  'the glow 2026': 'festival-the-glow-2026',
  '더 글로우 2026': 'festival-the-glow-2026',
  '더 글로우 2026 (the glow 2026)': 'festival-the-glow-2026',
  'https://ticket.melon.com/performance/index.htm?prodid=212651': 'festival-the-glow-2026',
  'festival-seoul-jazz-2026': 'festival-seoul-jazz-2026',
  '서울재즈페스티벌 2026': 'festival-seoul-jazz-2026',
  '제18회 서울재즈페스티벌 2026': 'festival-seoul-jazz-2026',
  'seoul jazz festival 2026': 'festival-seoul-jazz-2026',
  'https://ticket.melon.com/performance/index.htm?prodid=212811': 'festival-seoul-jazz-2026',
  'https://tkglobal.melon.com/performance/index.htm?langcd=en&prodid=212811': 'festival-seoul-jazz-2026',
};

export const getFestivalContentKey = (
  event: Pick<Event, 'id' | 'title' | 'ticket_url'> | string
): string | null => {
  if (typeof event === 'string') {
    return festivalContent[event] ? event : festivalContentAliases[normalizeLookupValue(event)] ?? null;
  }

  if (festivalContent[event.id]) {
    return event.id;
  }

  const titleAlias = festivalContentAliases[normalizeLookupValue(event.title)];
  if (titleAlias) {
    return titleAlias;
  }

  const ticketAlias = festivalContentAliases[normalizeLookupValue(event.ticket_url)];
  if (ticketAlias) {
    return ticketAlias;
  }

  return null;
};

export const getFestivalContentForEvent = (event: Pick<Event, 'id' | 'title' | 'ticket_url'>) => {
  const key = getFestivalContentKey(event);
  return key ? festivalContent[key] : null;
};
