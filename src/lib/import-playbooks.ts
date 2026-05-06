import {
  SEOUL_JAZZ_2026_OFFICIAL_TIMETABLE_SOURCE,
  seoulJazzFestival2026OfficialTimetableTsv,
} from '@/lib/seoul-jazz-2026';

export type ImportPlaybookTarget = 'lineup' | 'timetable';

export type ImportPlaybookSourceLink = {
  label: string;
  url: string;
};

export type ImportPlaybook = {
  eventId: string;
  target: ImportPlaybookTarget;
  title: string;
  summary: string;
  outputHeader: string;
  sourceTag: string;
  sampleOutput?: string;
  sourceLinks: ImportPlaybookSourceLink[];
  stageGuide: string[];
  notes: string[];
  visionPrompt: string;
};

const seoulJazzTimetableStageGuide = [
  '88잔디마당',
  'KSPO DOME',
  '티켓링크 라이브 아레나',
  '88호수수변무대',
];

const seoulJazzTimetableOutputHeader = 'date\tstage\tartist\tstart\tend\ttitle\tsource';

export const importPlaybooks: ImportPlaybook[] = [
  {
    eventId: 'festival-seoul-jazz-2026',
    target: 'timetable',
    title: '서울재즈페스티벌 2026 타임테이블 OCR 플레이북',
    summary:
      '공식 타임테이블 공지 이미지를 Vision/OCR에 넣고, admin import용 TSV로 정리할 때 쓰는 운영 가이드입니다.',
    outputHeader: seoulJazzTimetableOutputHeader,
    sourceTag: SEOUL_JAZZ_2026_OFFICIAL_TIMETABLE_SOURCE,
    sampleOutput: `${seoulJazzTimetableOutputHeader}\n${seoulJazzFestival2026OfficialTimetableTsv}`,
    sourceLinks: [
      {
        label: '공식 타임테이블 공지',
        url: 'https://www.seouljazz.co.kr/bbs/board.php?bo_table=notice&page=10&wr_id=228',
      },
      {
        label: 'Day 1 원본 이미지',
        url: 'https://www.seouljazz.co.kr/bbs/view_image.php?bo_table=notice&fn=2041025412_U2uPgQ8E_785e65b500801d29714b05eccad78c18bd4ed79e.jpg',
      },
      {
        label: 'Day 2 원본 이미지',
        url: 'https://www.seouljazz.co.kr/bbs/view_image.php?bo_table=notice&fn=2041025412_76x8BlqM_396c4fb24556d632af806ed6d773e0570b3bf9da.jpg',
      },
      {
        label: 'Day 3 원본 이미지',
        url: 'https://www.seouljazz.co.kr/bbs/view_image.php?bo_table=notice&fn=2041025412_EcAXB68Q_396c4fb24556d632af806ed6d773e0570b3bf9da.jpg',
      },
    ],
    stageGuide: seoulJazzTimetableStageGuide,
    notes: [
      '출력은 반드시 TSV 한 개만 사용하고, 헤더는 date stage artist start end title source 순서를 유지합니다.',
      'date는 2026-05-22, 2026-05-23, 2026-05-24처럼 ISO 날짜로 맞춥니다.',
      'start/end는 24시간 HH:MM 형식으로 맞추고, 불명확하면 빈칸으로 둡니다.',
      'stage는 공식 표기 그대로 유지하고, 위 스테이지 목록과 다르면 운영자가 원본 이미지를 다시 확인합니다.',
      `source 컬럼은 모든 행에 ${SEOUL_JAZZ_2026_OFFICIAL_TIMETABLE_SOURCE} 값을 넣습니다.`,
    ],
    visionPrompt: `아래 서울재즈페스티벌 2026 공식 타임테이블 이미지를 보고 공연별 TSV만 출력해줘.

규칙:
1. 헤더는 정확히 "${seoulJazzTimetableOutputHeader}" 한 줄로 시작한다.
2. 각 공연 세트마다 한 줄씩 출력한다.
3. date는 2026-05-22 / 2026-05-23 / 2026-05-24 중 하나의 ISO 형식을 사용한다.
4. stage는 이미지에 적힌 공식 표기를 최대한 그대로 유지하되, 대표 스테이지는 ${seoulJazzTimetableStageGuide.join(', ')} 기준으로 통일한다.
5. start/end는 HH:MM 24시간 형식으로 출력한다.
6. title은 비워도 되며, 메모가 꼭 필요할 때만 짧게 적는다.
7. source는 모든 행에 "${SEOUL_JAZZ_2026_OFFICIAL_TIMETABLE_SOURCE}" 를 넣는다.
8. TSV 외 설명, 마크다운, 코드블록, 번호 목록은 절대 출력하지 않는다.
9. 시간이 불명확하면 추측하지 말고 빈칸으로 둔다.

출력 예시:
${seoulJazzTimetableOutputHeader}
2026-05-22\t88잔디마당\tArtist Name\t13:00\t13:50\t\t${SEOUL_JAZZ_2026_OFFICIAL_TIMETABLE_SOURCE}`,
  },
];

export const getImportPlaybook = (
  eventId: string | null | undefined,
  target: ImportPlaybookTarget
) => importPlaybooks.find((playbook) => playbook.eventId === eventId && playbook.target === target) ?? null;
