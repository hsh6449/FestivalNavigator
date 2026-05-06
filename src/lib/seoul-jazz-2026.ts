import type { Event } from '@/types/database';
import type { FestivalPOCContent } from '@/lib/festival-content';

export const SEOUL_JAZZ_2026_OFFICIAL_TIMETABLE_SOURCE = 'seouljazz-2026-official-timetable';

export const seoulJazzFestival2026Event: Event = {
  id: 'festival-seoul-jazz-2026',
  title: '제18회 서울재즈페스티벌 2026',
  artist: 'Herbie Hancock, Jon Batiste, Janelle Monae 외',
  description:
    '서울재즈페스티벌 2026은 올림픽공원에서 열리는 대형 도심형 음악 페스티벌입니다. 현재 데이터는 공식 홈페이지, 멜론티켓, 공식 타임테이블 공지 기준으로 일정, 장소, 예매 정보와 스테이지별 운영 시간을 함께 반영합니다.',
  start_date: '2026-05-22T00:00:00+09:00',
  end_date: '2026-05-24T23:59:00+09:00',
  venue: '올림픽공원',
  venue_address: '서울 송파구 방이동 88',
  venue_lat: 37.5216,
  venue_lng: 127.1210,
  genre: 'jazz',
  event_type: 'festival',
  image_url: null,
  price_range: '3일권 470,000원 / 1일권 189,000원',
  ticket_url: 'https://ticket.melon.com/performance/index.htm?prodId=212811',
  ticket_open_time: '2026-02-12T12:00:00+09:00',
  age_limit: '전체관람가',
  artist_profile:
    '재즈를 중심으로 팝, 소울, R&B, 힙합까지 넓게 아우르는 서울 대표 도심형 페스티벌입니다. 현재 매크로는 공식 공개 정보 기준의 운영 초안과 QA용 샘플 데이터를 함께 제공합니다.',
  created_at: '2026-05-06T00:00:00+09:00',
  updated_at: '2026-05-06T00:00:00+09:00',
};

export const seoulJazzFestival2026Content: FestivalPOCContent = {
  city: '서울',
  tagline:
    '공식 공개 정보 기준으로 불러온 서울재즈페스티벌 운영 seed입니다. 일정, 티켓, 대표 라인업, 공식 타임테이블, 이동 맥락을 한 화면에서 함께 검수합니다.',
  heroNote:
    '현재 seed는 서울재즈페스티벌 공식 홈페이지, 멜론티켓 상품 페이지, 2026-04-16 공식 타임테이블 공지 기준으로 구성했습니다. 더글로우처럼 line-up, ticket, map, timetable이 한 흐름으로 이어지는지 검수하기 위한 상세 베이스입니다.',
  lineupSummary: [
    'Herbie Hancock',
    'Jon Batiste',
    'Janelle Monae',
    'FKJ',
    'Of Monsters and Men',
    'Yerin Baek',
    'HYUKOH',
    'Silica Gel',
  ],
  stages: ['88잔디마당', 'KSPO DOME', '티켓링크 라이브 아레나', '88호수수변무대'],
  factCards: [
    { label: '일정', value: '2026.05.22 - 2026.05.24' },
    { label: '장소', value: '올림픽공원' },
    { label: '스테이지', value: '4개 스테이지 운영' },
    { label: '예매처', value: 'Melon Ticket / Global Ticket' },
    { label: '티켓', value: '3일권 470,000원 / 1일권 189,000원' },
    { label: '타임테이블', value: '공식 Day 1-3 이미지 공개 완료' },
    { label: '동선 포인트', value: '야외 메인 + 실내 돔 + 서브 아레나 분산형' },
  ],
  transportTips: [
    '올림픽공원은 게이트와 스테이지가 넓게 분산되어 있어 입장 직후 내 Day의 메인 동선을 먼저 정리하는 편이 좋습니다.',
    '88잔디마당과 KSPO DOME, 서브 스테이지들이 분산되어 있어 헤드라이너 직전에는 이동 완충 시간을 함께 잡는 UX가 중요합니다.',
    '지하철 5호선·9호선 접근성이 좋아 대중교통 길찾기 CTA를 우선 두고, 현장에서는 도보 이동 시간을 함께 보여주는 편이 적합합니다.',
  ],
  plannerTips: [
    '현 단계에서는 공식 타임테이블 기준으로 개인 플래너와 충돌 감지를 바로 검수할 수 있습니다.',
    '서울재즈는 헤드라이너만 보는 흐름보다 Day별 발견형 동선이 중요해서 자유 블록과 이동 블록이 특히 잘 맞습니다.',
    '해외 관객과 국내 관객이 함께 보는 행사라 멜론티켓과 글로벌 티켓 링크를 같이 노출하는 편이 좋습니다.',
  ],
  syncPlan: [
    '공식 홈페이지 공지와 아티스트 페이지를 기준으로 일정, 장소, 출연 요일을 먼저 반영합니다.',
    '티켓 가격과 예매처는 멜론티켓 상품 페이지를 canonical source로 둡니다.',
    '세부 타임테이블은 2026-04-16 공식 timetable 공지를 기준으로 stage/time을 검수해 schedule_slots로 확정합니다.',
    '운영 공개 전에는 hero, map, source 섹션이 더글로우 seed와 비슷한 밀도로 유지되는지 함께 QA합니다.',
  ],
  daySchedules: [
    {
      date: '2026-05-22',
      label: 'Day 1',
      startTimeLabel: '공연 시작 12:00',
      acts: [
        { artist: 'Buena Vista Orchestra', start: '12:00', end: '13:10', stage: '88잔디마당', order: 1, note: '공식 타임테이블 공지 기준' },
        { artist: 'Tabber', start: '13:10', end: '14:10', stage: 'KSPO DOME', order: 1, note: '공식 타임테이블 공지 기준' },
        { artist: 'Don West', start: '12:30', end: '13:30', stage: '티켓링크 라이브 아레나', order: 1, note: '공식 타임테이블 공지 기준' },
        { artist: 'jeebanoff', start: '12:00', end: '13:00', stage: '88호수수변무대', order: 1, note: '공식 타임테이블 공지 기준' },
        { artist: 'Jenevieve', start: '14:00', end: '15:00', stage: '88잔디마당', order: 2, highlight: true, note: '공식 타임테이블 공지 기준' },
        { artist: 'Kawasaki Takaya', start: '15:00', end: '16:00', stage: 'KSPO DOME', order: 2, note: '공식 타임테이블 공지 기준' },
        { artist: 'The Poles', start: '14:20', end: '15:20', stage: '티켓링크 라이브 아레나', order: 2, note: '공식 타임테이블 공지 기준' },
        { artist: 'S.A.R.', start: '13:40', end: '14:40', stage: '88호수수변무대', order: 2, note: '공식 타임테이블 공지 기준' },
        { artist: 'Leisure', start: '16:00', end: '17:10', stage: '88잔디마당', order: 3, note: '공식 타임테이블 공지 기준' },
        { artist: 'CNBLUE', start: '17:00', end: '18:20', stage: 'KSPO DOME', order: 3, note: '공식 타임테이블 공지 기준' },
        { artist: 'Emily King', start: '16:20', end: '17:30', stage: '티켓링크 라이브 아레나', order: 3, note: '공식 타임테이블 공지 기준' },
        { artist: 'Galdive', start: '15:20', end: '16:20', stage: '88호수수변무대', order: 3, note: '공식 타임테이블 공지 기준' },
        { artist: 'Trombone Shorty & Orleans Avenue', start: '18:00', end: '19:15', stage: '88잔디마당', order: 4, note: '공식 타임테이블 공지 기준' },
        { artist: 'D*S', start: '19:10', end: '20:10', stage: 'KSPO DOME', order: 4, note: '공식 타임테이블 공지 기준' },
        { artist: 'Jang Beom June', start: '18:20', end: '19:30', stage: '티켓링크 라이브 아레나', order: 4, note: '공식 타임테이블 공지 기준' },
        { artist: 'Joe Armon-Jones', start: '17:00', end: '18:10', stage: '88호수수변무대', order: 4, note: '공식 타임테이블 공지 기준' },
        { artist: 'Arturo Sandoval', start: '20:00', end: '21:30', stage: '88잔디마당', order: 5, highlight: true, note: '공식 타임테이블 공지 기준' },
        { artist: 'Janelle Monae', start: '21:00', end: '22:30', stage: 'KSPO DOME', order: 5, highlight: true, note: '공식 타임테이블 공지 기준' },
        { artist: 'Mamas Gun', start: '20:20', end: '21:30', stage: '티켓링크 라이브 아레나', order: 5, note: '공식 타임테이블 공지 기준' },
        { artist: 'Original Love & Cadejo', start: '19:00', end: '20:10', stage: '88호수수변무대', order: 5, note: '공식 타임테이블 공지 기준' },
      ],
    },
    {
      date: '2026-05-23',
      label: 'Day 2',
      startTimeLabel: '공연 시작 12:00',
      acts: [
        { artist: 'Latin Kitchen Luna', start: '12:00', end: '13:00', stage: '88잔디마당', order: 1, note: '공식 타임테이블 공지 기준' },
        { artist: 'Park Chanyoung', start: '13:10', end: '14:10', stage: 'KSPO DOME', order: 1, note: '공식 타임테이블 공지 기준' },
        { artist: 'Stella Jang', start: '12:30', end: '13:30', stage: '티켓링크 라이브 아레나', order: 1, note: '공식 타임테이블 공지 기준' },
        { artist: 'Mihyang Moon', start: '12:00', end: '13:00', stage: '88호수수변무대', order: 1, note: '공식 타임테이블 공지 기준' },
        { artist: 'Alfa Mist', start: '13:50', end: '15:00', stage: '88잔디마당', order: 2, note: '공식 타임테이블 공지 기준' },
        { artist: 'TAEYONG, HAECHAN', start: '15:10', end: '16:10', stage: 'KSPO DOME', order: 2, note: '공식 타임테이블 공지 기준' },
        { artist: 'Stacey Ryan', start: '14:20', end: '15:20', stage: '티켓링크 라이브 아레나', order: 2, note: '공식 타임테이블 공지 기준' },
        { artist: 'SM Jazz Trio', start: '13:40', end: '14:40', stage: '88호수수변무대', order: 2, note: '공식 타임테이블 공지 기준' },
        { artist: 'Yerin Baek', start: '15:50', end: '17:10', stage: '88잔디마당', order: 3, highlight: true, note: '공식 타임테이블 공지 기준' },
        { artist: 'PREP', start: '17:00', end: '18:20', stage: 'KSPO DOME', order: 3, note: '공식 타임테이블 공지 기준' },
        { artist: 'Anson Seabra', start: '16:00', end: '17:00', stage: '티켓링크 라이브 아레나', order: 3, note: '공식 타임테이블 공지 기준' },
        { artist: 'ENJI', start: '15:20', end: '16:20', stage: '88호수수변무대', order: 3, note: '공식 타임테이블 공지 기준' },
        { artist: 'Cory Henry & The Funk Apostles', start: '18:00', end: '19:15', stage: '88잔디마당', order: 4, note: '공식 타임테이블 공지 기준' },
        { artist: 'Epik High', start: '19:00', end: '20:15', stage: 'KSPO DOME', order: 4, note: '공식 타임테이블 공지 기준' },
        { artist: 'Peder Elias', start: '17:50', end: '19:00', stage: '티켓링크 라이브 아레나', order: 4, note: '공식 타임테이블 공지 기준' },
        { artist: 'Jin Ah Lee Jazz Quartet', start: '17:00', end: '18:10', stage: '88호수수변무대', order: 4, note: '공식 타임테이블 공지 기준' },
        { artist: 'Jon Batiste Live', start: '20:00', end: '21:30', stage: '88잔디마당', order: 5, highlight: true, note: '공식 타임테이블 공지 기준' },
        { artist: 'FKJ', start: '21:00', end: '22:30', stage: 'KSPO DOME', order: 5, highlight: true, note: '공식 타임테이블 공지 기준' },
        { artist: 'Choi Yu Ree', start: '19:40', end: '20:55', stage: '티켓링크 라이브 아레나', order: 5, note: '공식 타임테이블 공지 기준' },
        { artist: 'Summer Salt', start: '19:00', end: '20:10', stage: '88호수수변무대', order: 5, note: '공식 타임테이블 공지 기준' },
      ],
    },
    {
      date: '2026-05-24',
      label: 'Day 3',
      startTimeLabel: '공연 시작 12:00',
      acts: [
        { artist: 'Seokcheol Yun Artifaction', start: '12:00', end: '13:00', stage: '88잔디마당', order: 1, note: '공식 타임테이블 공지 기준' },
        { artist: 'Mulasaki Ima', start: '13:00', end: '14:00', stage: 'KSPO DOME', order: 1, note: '공식 타임테이블 공지 기준' },
        { artist: 'youra', start: '12:30', end: '13:30', stage: '티켓링크 라이브 아레나', order: 1, note: '공식 타임테이블 공지 기준' },
        { artist: 'Milena', start: '12:00', end: '13:00', stage: '88호수수변무대', order: 1, note: '공식 타임테이블 공지 기준' },
        { artist: 'Cimafunk', start: '14:00', end: '15:10', stage: '88잔디마당', order: 2, note: '공식 타임테이블 공지 기준' },
        { artist: 'HANRORO', start: '15:00', end: '16:10', stage: 'KSPO DOME', order: 2, note: '공식 타임테이블 공지 기준' },
        { artist: 'Thee Sacred Souls', start: '14:30', end: '15:30', stage: '티켓링크 라이브 아레나', order: 2, note: '공식 타임테이블 공지 기준' },
        { artist: 'Tomonari Sora', start: '13:40', end: '14:40', stage: '88호수수변무대', order: 2, note: '공식 타임테이블 공지 기준' },
        { artist: 'Ella Mai', start: '16:00', end: '17:10', stage: '88잔디마당', order: 3, note: '공식 타임테이블 공지 기준' },
        { artist: 'wave to earth', start: '17:00', end: '18:00', stage: 'KSPO DOME', order: 3, note: '공식 타임테이블 공지 기준' },
        { artist: 'Jukjae', start: '16:20', end: '17:30', stage: '티켓링크 라이브 아레나', order: 3, note: '공식 타임테이블 공지 기준' },
        { artist: 'Sangji Koh', start: '15:20', end: '16:20', stage: '88호수수변무대', order: 3, note: '공식 타임테이블 공지 기준' },
        { artist: 'Medeski Martin & Wood', start: '18:00', end: '19:20', stage: '88잔디마당', order: 4, note: '공식 타임테이블 공지 기준' },
        { artist: 'HYUKOH', start: '19:00', end: '20:10', stage: 'KSPO DOME', order: 4, highlight: true, note: '공식 타임테이블 공지 기준' },
        { artist: 'Free Nationals', start: '18:20', end: '19:20', stage: '티켓링크 라이브 아레나', order: 4, note: '공식 타임테이블 공지 기준' },
        { artist: 'ARON!', start: '17:00', end: '18:00', stage: '88호수수변무대', order: 4, note: '공식 타임테이블 공지 기준' },
        { artist: 'Herbie Hancock', start: '20:00', end: '21:30', stage: '88잔디마당', order: 5, highlight: true, note: '공식 타임테이블 공지 기준' },
        { artist: 'Of Monsters and Men', start: '21:00', end: '22:30', stage: 'KSPO DOME', order: 5, highlight: true, note: '공식 타임테이블 공지 기준' },
        { artist: 'Silica Gel', start: '20:00', end: '21:20', stage: '티켓링크 라이브 아레나', order: 5, highlight: true, note: '공식 타임테이블 공지 기준' },
        { artist: 'Danny Koo', start: '19:00', end: '20:10', stage: '88호수수변무대', order: 5, note: '공식 타임테이블 공지 기준' },
      ],
    },
  ],
  ticketLinks: [
    {
      label: 'Melon Ticket',
      url: 'https://ticket.melon.com/performance/index.htm?prodId=212811',
      status: 'open',
      note: '3일권 470,000원 / 1일권 189,000원 / 1일권 티켓 오픈 2026-03-03 12:00',
    },
    {
      label: 'Global Ticket',
      url: 'https://tkglobal.melon.com/performance/index.htm?langCd=EN&prodId=212811',
      status: 'open',
      note: '공식 홈페이지의 Global Ticket 링크',
    },
  ],
  travelLinks: [
    {
      label: 'Google Maps 길찾기',
      url: 'https://www.google.com/maps/search/?api=1&query=%EC%98%AC%EB%A6%BC%ED%94%BD%EA%B3%B5%EC%9B%90',
      note: '공연장 위치와 길찾기',
    },
    {
      label: '현재 위치에서 길찾기',
      url: 'https://www.google.com/maps/dir/?api=1&destination=37.5216,127.1210',
      note: '올림픽공원 중심 좌표 기준 길찾기',
    },
    {
      label: '올림픽공원 장소 보기',
      url: 'https://www.google.com/maps/search/?api=1&query=37.5216,127.1210',
      note: '게이트와 공연장 주변을 지도에서 먼저 확인',
    },
  ],
  sources: [
    {
      label: '서울재즈페스티벌 공식 홈페이지',
      url: 'https://www.seouljazz.co.kr/',
      note: '공식 공지, 티켓 메뉴, 운영 정보',
    },
    {
      label: '서울재즈페스티벌 타임테이블 공지',
      url: 'https://www.seouljazz.co.kr/bbs/board.php?bo_table=notice&page=10&wr_id=228',
      note: '2026-04-16 게시. Day 1-3 공식 타임테이블 이미지',
    },
    {
      label: '서울재즈페스티벌 3일권 정가 티켓 공지',
      url: 'https://www.seouljazz.co.kr/bbs/board.php?bo_table=notice&wr_id=217',
      note: '행사 일정, 장소, 예매처, 대표 라인업 요약',
    },
    {
      label: '멜론티켓 상품 페이지',
      url: 'https://ticket.melon.com/performance/index.htm?prodId=212811',
      note: '공식 가격, 공연 기간, 전체 출연진, 1일권 티켓 오픈 공지',
    },
    {
      label: '멜론티켓 글로벌 페이지',
      url: 'https://tkglobal.melon.com/performance/index.htm?langCd=EN&prodId=212811',
      note: '해외 관객용 글로벌 티켓 진입점',
    },
    {
      label: '스포츠경향 최종 라인업 기사',
      url: 'https://sports.khan.co.kr/en/article/202604161700007',
      note: 'Day 1/2/3 대표 라인업과 일정 요약',
    },
  ],
};

export const seoulJazzFestival2026OfficialTimetableTsv = seoulJazzFestival2026Content.daySchedules
  .flatMap((daySchedule) =>
    daySchedule.acts.map((act) =>
      [
        daySchedule.date,
        act.stage,
        act.artist,
        act.start ?? '',
        act.end ?? '',
        '',
        SEOUL_JAZZ_2026_OFFICIAL_TIMETABLE_SOURCE,
      ].join('\t')
    )
  )
  .join('\n');
