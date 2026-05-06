'use client';

import Image from 'next/image';
import { type Dispatch, type SetStateAction, useCallback, useEffect, useRef, useState } from 'react';
import { combineDateAndTime, normalizeSlug, parseBooleanCell, parseTableText, toDateTimeLocalValue } from '@/lib/admin-import';
import { fetchEvents as fetchEventsFromSource } from '@/lib/events';
import { FestivalPOCContent, festivalContent, getFestivalContentKey } from '@/lib/festival-content';
import { getImportPlaybook, type ImportPlaybook, type ImportPlaybookSourceLink } from '@/lib/import-playbooks';
import { decodeLineupNote, encodeLineupNote } from '@/lib/lineup-metadata';
import { mockEvents } from '@/lib/mock-events';
import { createClient, hasSupabaseEnv } from '@/lib/supabase/client';
import {
  ArtistType,
  EventBoardSetting,
  Event,
  EventArtistRole,
  EventArtistStatus,
  EventStage,
  EventType,
  ScheduleSlotType,
  TicketLinkType,
  TicketSalesStatus,
} from '@/types/database';

type EventFormState = {
  title: string;
  artist: string;
  description: string;
  start_date: string;
  end_date: string;
  venue: string;
  venue_address: string;
  venue_lat: string;
  venue_lng: string;
  genre: string;
  event_type: EventType;
  image_url: string;
  price_range: string;
  ticket_url: string;
  ticket_open_time: string;
  age_limit: string;
  artist_profile: string;
};

type LineupEditorRow = {
  client_id: string;
  id: string | null;
  artist_id: string | null;
  artist_name: string;
  performance_date: string;
  stage_name: string;
  start_time: string;
  end_time: string;
  display_order: string;
  role: EventArtistRole;
  is_headliner: boolean;
  announcement_status: EventArtistStatus;
  note: string;
};

type TimetableEditorRow = {
  client_id: string;
  id: string | null;
  artist_id: string | null;
  event_artist_id: string | null;
  artist_name: string;
  stage_name: string;
  slot_type: ScheduleSlotType;
  start_at: string;
  end_at: string;
  title: string;
  is_cancelled: boolean;
  source: string;
};

type TicketEditorRow = {
  client_id: string;
  id: string | null;
  provider_name: string;
  provider_code: string;
  url: string;
  link_type: TicketLinkType;
  sales_status: TicketSalesStatus;
  opens_at: string;
  ends_at: string;
  price_note: string;
  is_primary: boolean;
};

type AdminSection = 'event' | 'imports' | 'lineup' | 'timetable' | 'tickets';

type SavedSectionSignatures = Record<AdminSection, string>;

type LastSavedAtBySection = Partial<Record<AdminSection, string | null>>;

type NoticeItem = {
  id: string;
  text: string;
  createdAt: string;
};

type PendingDayDeletion = {
  dayKey: string;
  confirmText: string;
};

type AdminDaySelection = {
  lineup: string;
  timetable: string;
};

type AdminSectionConfig = {
  id: AdminSection;
  label: string;
};

type FestivalMacroConfig = {
  eventId: string;
  label: string;
  summary: string;
  sourceNote: string;
};

type ImportPreviewStatus = 'new' | 'update' | 'unchanged';

type ImportPreviewItem = {
  key: string;
  title: string;
  subtitle: string;
  status: ImportPreviewStatus;
  changes: string[];
};

type ImportPreviewState = {
  target: 'lineup' | 'timetable';
  items: ImportPreviewItem[];
  added: number;
  updated: number;
  unchanged: number;
  rowCount: number;
};

type ImportQaStatus = 'exact' | 'mismatch' | 'missing' | 'extra';

type ImportQaComparisonItem = {
  key: string;
  title: string;
  subtitle: string;
  status: ImportQaStatus;
  details: string[];
};

type ImportQaComparisonState = {
  target: 'lineup' | 'timetable';
  expectedCount: number;
  actualCount: number;
  exact: number;
  mismatched: number;
  missing: number;
  extra: number;
  items: ImportQaComparisonItem[];
};

const eventTypeOptions: EventType[] = ['festival', 'concert'];
const lineupStatusOptions: EventArtistStatus[] = ['confirmed', 'rumored', 'cancelled'];
const scheduleTypeOptions: ScheduleSlotType[] = ['performance', 'break', 'gate_open', 'signing'];
const ticketTypeOptions: TicketLinkType[] = ['general', 'vip', 'waiting', 'official_info'];
const ticketStatusOptions: TicketSalesStatus[] = ['upcoming', 'open', 'sold_out', 'closed'];
const adminSectionConfigs: AdminSectionConfig[] = [
  { id: 'event', label: 'Event Basics' },
  { id: 'imports', label: 'Imports' },
  { id: 'lineup', label: 'Lineup' },
  { id: 'timetable', label: 'Timetable' },
  { id: 'tickets', label: 'Ticket Links' },
];
const adminSectionStorageKey = 'festival-navigator.admin-section-order';
const quietNoticePatterns = [
  '카드를 timeline에 배치했습니다.',
  '스테이지 컬럼 순서를 변경했습니다.',
  'stage 이름을',
  'stage를 추가했습니다.',
  '보이는 시간 범위를 데이터 기준으로 다시 맞췄습니다.',
  '블록 시간을 조정했습니다.',
  '등록 모드입니다.',
  '이미지 미리보기를 불러왔습니다.',
];

const createClientId = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `tmp-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const readAdminSectionOrderCookie = () => {
  if (typeof document === 'undefined') return null;

  const cookie = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith(`${adminSectionStorageKey}=`));

  if (!cookie) return null;

  const value = cookie.slice(`${adminSectionStorageKey}=`.length);
  try {
    return JSON.parse(decodeURIComponent(value));
  } catch {
    return null;
  }
};

const writeAdminSectionOrderCookie = (order: AdminSection[]) => {
  if (typeof document === 'undefined') return;

  document.cookie = `${adminSectionStorageKey}=${encodeURIComponent(JSON.stringify(order))}; path=/; max-age=31536000; samesite=lax`;
};

const initialEventState: EventFormState = {
  title: '',
  artist: '',
  description: '',
  start_date: '',
  end_date: '',
  venue: '',
  venue_address: '',
  venue_lat: '',
  venue_lng: '',
  genre: '',
  event_type: 'festival',
  image_url: '',
  price_range: '',
  ticket_url: '',
  ticket_open_time: '',
  age_limit: '',
  artist_profile: '',
};

const createEmptyLineupRow = (): LineupEditorRow => ({
  client_id: createClientId(),
  id: null,
  artist_id: null,
  artist_name: '',
  performance_date: '',
  stage_name: '',
  start_time: '',
  end_time: '',
  display_order: '',
  role: 'lineup',
  is_headliner: false,
  announcement_status: 'confirmed',
  note: '',
});

const createEmptyTimetableRow = (): TimetableEditorRow => ({
  client_id: createClientId(),
  id: null,
  artist_id: null,
  event_artist_id: null,
  artist_name: '',
  stage_name: '',
  slot_type: 'performance',
  start_at: '',
  end_at: '',
  title: '',
  is_cancelled: false,
  source: 'manual',
});

const createEmptyTicketRow = (): TicketEditorRow => ({
  client_id: createClientId(),
  id: null,
  provider_name: '',
  provider_code: '',
  url: '',
  link_type: 'general',
  sales_status: 'upcoming',
  opens_at: '',
  ends_at: '',
  price_note: '',
  is_primary: false,
});

const toEventFormState = (event: Event): EventFormState => ({
  title: event.title,
  artist: event.artist,
  description: event.description,
  start_date: toDateTimeLocalValue(event.start_date),
  end_date: toDateTimeLocalValue(event.end_date),
  venue: event.venue,
  venue_address: event.venue_address ?? '',
  venue_lat: event.venue_lat?.toString() ?? '',
  venue_lng: event.venue_lng?.toString() ?? '',
  genre: event.genre,
  event_type: event.event_type ?? 'festival',
  image_url: event.image_url ?? '',
  price_range: event.price_range ?? '',
  ticket_url: event.ticket_url ?? '',
  ticket_open_time: toDateTimeLocalValue(event.ticket_open_time),
  age_limit: event.age_limit ?? '',
  artist_profile: event.artist_profile ?? '',
});

const buildLineupOrderingState = (rows: LineupEditorRow[]) => {
  const groupedRows = rows.reduce<Record<string, LineupEditorRow[]>>((groups, row) => {
    const key = `${row.performance_date || '__undated__'}::${row.stage_name.trim() || '__stage__'}`;
    groups[key] = [...(groups[key] ?? []), row];
    return groups;
  }, {});

  const derivedOrderMap = new Map<string, number>();
  const mismatchMap = new Map<string, number>();

  Object.values(groupedRows).forEach((group) => {
    const filledRows = group.filter((row) => row.artist_name.trim());
    const shouldUseTimePriority =
      filledRows.length > 0 && filledRows.every((row) => row.start_time.trim() && row.end_time.trim());

    if (!shouldUseTimePriority) {
      return;
    }

    filledRows
      .sort((left, right) => {
        if (left.start_time !== right.start_time) {
          return left.start_time.localeCompare(right.start_time);
        }

        const leftOrder = left.display_order ? Number(left.display_order) : Number.MAX_SAFE_INTEGER;
        const rightOrder = right.display_order ? Number(right.display_order) : Number.MAX_SAFE_INTEGER;
        if (leftOrder !== rightOrder) {
          return leftOrder - rightOrder;
        }

        return left.artist_name.localeCompare(right.artist_name);
      })
      .forEach((row, index) => {
        const derivedOrder = index + 1;
        derivedOrderMap.set(row.client_id, derivedOrder);

        if (row.display_order && Number(row.display_order) !== derivedOrder) {
          mismatchMap.set(row.client_id, derivedOrder);
        }
      });
  });

  return { derivedOrderMap, mismatchMap };
};

const buildStageOrderByDayFromLineupPayload = (rows: Array<Record<string, unknown>>) => {
  const grouped = new Map<string, Map<string, number>>();

  rows.forEach((row) => {
    const parsedNote = decodeLineupNote(row.note ? String(row.note) : '');
    const dateKey = row.performance_date ? String(row.performance_date) : '__undated__';
    const stageName = parsedNote.metadata.stageName?.trim() || '';
    const stagePosition = parsedNote.metadata.stagePosition ?? Number.MAX_SAFE_INTEGER;

    if (!stageName) return;

    if (!grouped.has(dateKey)) {
      grouped.set(dateKey, new Map<string, number>());
    }

    const stageMap = grouped.get(dateKey)!;
    const currentPosition = stageMap.get(stageName) ?? Number.MAX_SAFE_INTEGER;
    stageMap.set(stageName, Math.min(currentPosition, stagePosition));
  });

  return Array.from(grouped.entries()).reduce<Record<string, string[]>>((result, [dateKey, stageMap]) => {
    result[dateKey] = Array.from(stageMap.entries())
      .sort((left, right) => {
        if (left[1] !== right[1]) {
          return left[1] - right[1];
        }
        return left[0].localeCompare(right[0]);
      })
      .map(([stageName]) => stageName);

    return result;
  }, {});
};

const buildStageOrderByDayFromEventStagesPayload = (rows: EventStage[]) =>
  rows.reduce<Record<string, string[]>>((result, row) => {
    if (row.is_hidden) return result;

    const dateKey = row.performance_date || '__undated__';
    result[dateKey] = [...(result[dateKey] ?? []), row.stage_name];
    return result;
  }, {});

const buildHiddenStageNamesByDayFromEventStagesPayload = (rows: EventStage[]) =>
  rows.reduce<Record<string, string[]>>((result, row) => {
    if (!row.is_hidden) return result;

    const dateKey = row.performance_date || '__undated__';
    result[dateKey] = [...(result[dateKey] ?? []), row.stage_name];
    return result;
  }, {});

const shouldUseTimePriorityForLineupGroup = (rows: LineupEditorRow[]) => {
  const filledRows = rows.filter((row) => row.artist_name.trim());
  return filledRows.length > 0 && filledRows.every((row) => row.start_time.trim() && row.end_time.trim());
};

const parseTimeToMinutes = (value: string) => {
  const [hours, minutes] = value.split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
};

const formatMinutesToTime = (value: number) => {
  const normalized = Math.max(0, value);
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const addMinutesToTime = (value: string, minutes: number) => {
  const base = parseTimeToMinutes(value);
  if (base === null) return value;
  return formatMinutesToTime(base + minutes);
};

const compareDayKeys = (left: string, right: string) => {
  if (left === right) return 0;
  if (left === '__undated__') return 1;
  if (right === '__undated__') return -1;
  return left.localeCompare(right);
};

const buildDayItems = (dayKeys: string[]) => {
  let datedIndex = 0;

  return dayKeys
    .slice()
    .sort(compareDayKeys)
    .map((dayKey) => {
      if (dayKey === '__undated__') {
        return {
          key: dayKey,
          label: '날짜 미정',
          date: '날짜 미정',
        };
      }

      datedIndex += 1;
      return {
        key: dayKey,
        label: `Day ${datedIndex}`,
        date: dayKey,
      };
    });
};

const replaceDatePart = (dateTime: string, nextDate: string, fallbackTime: string) => {
  const timePart = dateTime.slice(11, 16) || fallbackTime;
  return `${nextDate}T${timePart}`;
};

const serializeEventFormState = (state: EventFormState) => JSON.stringify(state);

const serializeLineupState = (
  rows: LineupEditorRow[],
  stageOrderByDay: Record<string, string[]>,
  hiddenStageNamesByDay: Record<string, string[]>,
  timelineSettingsByDay: Record<string, TimelineDaySettings>
) =>
  JSON.stringify({
    rows: rows.map((row) => ({
      artist_name: row.artist_name,
      performance_date: row.performance_date,
      stage_name: row.stage_name,
      start_time: row.start_time,
      end_time: row.end_time,
      display_order: row.display_order,
      role: row.role,
      is_headliner: row.is_headliner,
      announcement_status: row.announcement_status,
      note: row.note,
    })),
    stageOrderByDay,
    hiddenStageNamesByDay,
    timelineSettingsByDay,
  });

const serializeTimetableState = (rows: TimetableEditorRow[]) =>
  JSON.stringify(
    rows.map((row) => ({
      artist_name: row.artist_name,
      stage_name: row.stage_name,
      slot_type: row.slot_type,
      start_at: row.start_at,
      end_at: row.end_at,
      title: row.title,
      is_cancelled: row.is_cancelled,
      source: row.source,
    }))
  );

const serializeTicketState = (rows: TicketEditorRow[]) =>
  JSON.stringify(
    rows.map((row) => ({
      provider_name: row.provider_name,
      provider_code: row.provider_code,
      url: row.url,
      link_type: row.link_type,
      sales_status: row.sales_status,
      opens_at: row.opens_at,
      ends_at: row.ends_at,
      price_note: row.price_note,
      is_primary: row.is_primary,
    }))
  );

const serializeImportState = (params: {
  importTarget: 'lineup' | 'timetable';
  importImageName: string;
  importExtractedText: string;
  lineupImportText: string;
  timetableImportText: string;
  ticketImportText: string;
}) => JSON.stringify(params);

const createEmptySectionSignatures = (): SavedSectionSignatures => ({
  event: serializeEventFormState(initialEventState),
  imports: serializeImportState({
    importTarget: 'lineup',
    importImageName: '',
    importExtractedText: '',
    lineupImportText: '',
    timetableImportText: '',
    ticketImportText: '',
  }),
  lineup: serializeLineupState([], {}, {}, {}),
  timetable: serializeTimetableState([]),
  tickets: serializeTicketState([]),
});

const getEventDayTokens = (startDateTime: string, endDateTime: string) => {
  if (!startDateTime) return [];

  const startDate = startDateTime.slice(0, 10);
  const endDate = (endDateTime || startDateTime).slice(0, 10);
  const current = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);

  if (Number.isNaN(current.getTime()) || Number.isNaN(end.getTime())) return [];

  const dates: string[] = [];
  while (current <= end) {
    dates.push(
      `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`
    );
    current.setDate(current.getDate() + 1);
  }

  return dates;
};

const addDaysToLocalDateTime = (dateTime: string, days: number) => {
  if (!dateTime) return '';

  const dateToken = dateTime.slice(0, 10);
  const timeToken = dateTime.slice(11, 16) || '12:00';
  const parsed = new Date(`${dateToken}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) return dateTime;

  parsed.setDate(parsed.getDate() + days);

  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}T${timeToken}`;
};

const addMinutesToLocalDateTime = (dateTime: string, minutes: number) => {
  const parsed = new Date(dateTime);
  if (Number.isNaN(parsed.getTime())) return dateTime;

  parsed.setMinutes(parsed.getMinutes() + minutes);

  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}T${String(parsed.getHours()).padStart(2, '0')}:${String(parsed.getMinutes()).padStart(2, '0')}`;
};

const TIMELINE_INTERVAL_MINUTES = 5;
const TIMELINE_ROW_HEIGHT_PX = 16;

type TimelineDaySettings = {
  startTime: string;
  endTime: string;
  intervalMinutes: number;
};

type ResizeSession = {
  clientId: string;
  dayKey: string;
  startY: number;
  edge: 'start' | 'end';
  baseStartMinutes: number;
  baseEndMinutes: number;
};

type EditorUndoSnapshot = {
  formData: EventFormState;
  lineupRows: LineupEditorRow[];
  timetableRows: TimetableEditorRow[];
  ticketRows: TicketEditorRow[];
  stageOrderByDay: Record<string, string[]>;
  hiddenStageNamesByDay: Record<string, string[]>;
  timelineSettingsByDay: Record<string, TimelineDaySettings>;
  selectedAdminDayBySection: AdminDaySelection;
  selectedLineupClientId: string | null;
};

const MAX_EDITOR_UNDO_STEPS = 30;

const getDefaultTimelineSettings = (rows: LineupEditorRow[]): TimelineDaySettings => {
  const timedMinutes = rows
    .flatMap((row) => [row.start_time.trim(), row.end_time.trim()])
    .filter(Boolean)
    .map((value) => parseTimeToMinutes(value))
    .filter((value): value is number => value !== null);

  const minMinute = timedMinutes.length > 0 ? Math.min(...timedMinutes) : 10 * 60;
  const maxMinute = timedMinutes.length > 0 ? Math.max(...timedMinutes) : 22 * 60;
  const startMinute = Math.floor(minMinute / TIMELINE_INTERVAL_MINUTES) * TIMELINE_INTERVAL_MINUTES;
  const endMinute = Math.max(
    startMinute + 60,
    Math.ceil(maxMinute / TIMELINE_INTERVAL_MINUTES) * TIMELINE_INTERVAL_MINUTES
  );

  return {
    startTime: formatMinutesToTime(startMinute),
    endTime: formatMinutesToTime(endMinute),
    intervalMinutes: TIMELINE_INTERVAL_MINUTES,
  };
};

const deriveTimelineSettingsMap = (
  rows: LineupEditorRow[],
  eventStartDateTime: string,
  eventEndDateTime: string,
  stageOrderByDay: Record<string, string[]>,
  persisted: Record<string, TimelineDaySettings> = {}
) => {
  const dayKeys = Array.from(
    new Set([
      ...rows.map((row) => row.performance_date || '__undated__'),
      ...Object.keys(stageOrderByDay),
      ...getEventDayTokens(eventStartDateTime, eventEndDateTime),
    ])
  );

  return dayKeys.reduce<Record<string, TimelineDaySettings>>((result, dayKey) => {
    if (persisted[dayKey]) {
      result[dayKey] = persisted[dayKey];
      return result;
    }

    const dayRows = rows.filter((row) => (row.performance_date || '__undated__') === dayKey);
    result[dayKey] = getDefaultTimelineSettings(dayRows);
    return result;
  }, {});
};

const getTimetableDayKey = (row: TimetableEditorRow) => {
  if (row.start_at) return row.start_at.slice(0, 10);
  if (row.end_at) return row.end_at.slice(0, 10);
  return '__undated__';
};

const buildTimelineSlots = (settings: TimelineDaySettings) => {
  const startMinute = parseTimeToMinutes(settings.startTime) ?? 10 * 60;
  const intervalMinutes = TIMELINE_INTERVAL_MINUTES;
  const endMinute = Math.max(
    startMinute + intervalMinutes,
    parseTimeToMinutes(settings.endTime) ?? 22 * 60
  );
  const slots: string[] = [];

  for (let current = startMinute; current <= endMinute; current += intervalMinutes) {
    slots.push(formatMinutesToTime(current));
  }

  return slots;
};

const getTimelineRowPlacement = (
  row: LineupEditorRow,
  settings: TimelineDaySettings
) => {
  const startMinute = parseTimeToMinutes(row.start_time.trim() || '') ?? null;
  const endMinute = parseTimeToMinutes(row.end_time.trim() || '') ?? null;
  const gridStartMinute = parseTimeToMinutes(settings.startTime) ?? 10 * 60;
  const intervalMinutes = TIMELINE_INTERVAL_MINUTES;

  if (startMinute === null) {
    return null;
  }

  const effectiveEndMinute = endMinute !== null && endMinute > startMinute
    ? endMinute
    : startMinute + 50;
  const rowStart = Math.max(1, Math.floor((startMinute - gridStartMinute) / intervalMinutes) + 1);
  const rowSpan = Math.max(1, Math.ceil((effectiveEndMinute - startMinute) / intervalMinutes));

  return { rowStart, rowSpan };
};

const getTimelineDropStartTime = (
  event: React.DragEvent<HTMLDivElement>,
  settings: TimelineDaySettings,
  rowCount: number
) => {
  const rect = event.currentTarget.getBoundingClientRect();
  const offsetY = Math.min(Math.max(event.clientY - rect.top, 0), Math.max(rect.height - 1, 0));
  const slotIndex = Math.min(
    Math.max(rowCount - 1, 0),
    Math.max(0, Math.floor(offsetY / TIMELINE_ROW_HEIGHT_PX))
  );
  const startMinute = (parseTimeToMinutes(settings.startTime) ?? 10 * 60) + slotIndex * TIMELINE_INTERVAL_MINUTES;

  return formatMinutesToTime(startMinute);
};

const HelpHint = ({ title, body }: { title: string; body: string }) => (
  <div className="relative inline-flex items-center">
    <button
      type="button"
      className="group inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-300 bg-white text-xs font-semibold text-slate-500 hover:border-slate-400 hover:text-slate-700"
    >
      ?
      <span className="pointer-events-none absolute left-full top-1/2 z-20 ml-3 hidden w-72 -translate-y-1/2 rounded-2xl border border-slate-200 bg-white p-3 text-left text-xs font-normal leading-5 text-slate-600 shadow-xl group-hover:block">
        <span className="block font-semibold text-slate-900">{title}</span>
        <span className="mt-1 block">{body}</span>
      </span>
    </button>
  </div>
);

const toTicketSalesStatus = (status: 'open' | 'coming_soon' | 'sold_out'): TicketSalesStatus => {
  if (status === 'open') return 'open';
  if (status === 'sold_out') return 'sold_out';
  return 'upcoming';
};

const buildLineupRowsFromFestivalContent = (content: FestivalPOCContent): LineupEditorRow[] =>
  content.daySchedules.flatMap((day) =>
    day.acts.map((act) => ({
      client_id: createClientId(),
      id: null,
      artist_id: null,
      artist_name: act.artist,
      performance_date: day.date,
      stage_name: act.stage,
      start_time: act.start ?? '',
      end_time: act.end ?? '',
      display_order: String(act.order),
      role: act.note?.includes('헤드라이너') ? 'headliner' : 'lineup',
      is_headliner: Boolean(act.note?.includes('헤드라이너')),
      announcement_status: 'confirmed',
      note: act.note ?? '',
    }))
  );

const buildMockLineupRows = (eventId: string): LineupEditorRow[] => {
  const content = festivalContent[eventId];
  return content ? buildLineupRowsFromFestivalContent(content) : [];
};

const buildTimetableRowsFromFestivalContent = (content: FestivalPOCContent): TimetableEditorRow[] =>
  content.daySchedules.flatMap((day) =>
    day.acts.map((act) => ({
      client_id: createClientId(),
      id: null,
      artist_id: null,
      event_artist_id: null,
      artist_name: act.artist,
      stage_name: act.stage,
      slot_type: 'performance',
      start_at: act.start ? combineDateAndTime(day.date, act.start) : '',
      end_at: act.end ? combineDateAndTime(day.date, act.end) : '',
      title: act.note ?? '',
      is_cancelled: false,
      source: 'mock-public-content',
    }))
  );

const buildMockTimetableRows = (eventId: string): TimetableEditorRow[] => {
  const content = festivalContent[eventId];
  return content ? buildTimetableRowsFromFestivalContent(content) : [];
};

const buildTicketRowsFromFestivalContent = (content: FestivalPOCContent): TicketEditorRow[] =>
  content.ticketLinks.map((link, index) => ({
    client_id: createClientId(),
    id: null,
    provider_name: link.label,
    provider_code: '',
    url: link.url,
    link_type: index === 0 ? 'general' : 'official_info',
    sales_status: toTicketSalesStatus(link.status),
    opens_at: '',
    ends_at: '',
    price_note: link.note,
    is_primary: index === 0,
  }));

const buildMockTicketRows = (eventId: string): TicketEditorRow[] => {
  const content = festivalContent[eventId];
  return content ? buildTicketRowsFromFestivalContent(content) : [];
};

const applyMockEventDetailToEditor = (
  eventId: string,
  setFormData: Dispatch<SetStateAction<EventFormState>>,
  setLineupRows: Dispatch<SetStateAction<LineupEditorRow[]>>,
  setTimetableRows: Dispatch<SetStateAction<TimetableEditorRow[]>>,
  setTicketRows: Dispatch<SetStateAction<TicketEditorRow[]>>,
  setStageOrderByDay: Dispatch<SetStateAction<Record<string, string[]>>>,
  setHiddenStageNamesByDay: Dispatch<SetStateAction<Record<string, string[]>>>,
  setTimelineSettingsByDay: Dispatch<SetStateAction<Record<string, TimelineDaySettings>>>,
  setSavedSectionSignatures: Dispatch<SetStateAction<SavedSectionSignatures>>,
  setLastSavedAtBySection: Dispatch<SetStateAction<LastSavedAtBySection>>
) => {
  const localEvent = mockEvents.find((event) => event.id === eventId);
  if (!localEvent) {
    return false;
  }

  const nextFormData = toEventFormState(localEvent);
  const nextLineupRows = buildMockLineupRows(eventId);
  const nextTimetableRows = buildMockTimetableRows(eventId);
  const nextTicketRows = buildMockTicketRows(eventId);
  const nextTimelineSettings = deriveTimelineSettingsMap(nextLineupRows, nextFormData.start_date, nextFormData.end_date, {});

  setFormData(nextFormData);
  setLineupRows(nextLineupRows);
  setTimetableRows(nextTimetableRows);
  setTicketRows(nextTicketRows);
  setStageOrderByDay({});
  setHiddenStageNamesByDay({});
  setTimelineSettingsByDay(nextTimelineSettings);
  setSavedSectionSignatures({
    event: serializeEventFormState(nextFormData),
    imports: createEmptySectionSignatures().imports,
    lineup: serializeLineupState(nextLineupRows, {}, {}, nextTimelineSettings),
    timetable: serializeTimetableState(nextTimetableRows),
    tickets: serializeTicketState(nextTicketRows),
  });
  setLastSavedAtBySection({});

  return true;
};

const festivalMacroConfigs: FestivalMacroConfig[] = [
  {
    eventId: 'festival-the-glow-2026',
    label: 'The Glow 2026 매크로',
    summary: '기사, 멜론티켓, 운영 공지 기준으로 indoor festival seed를 빠르게 재현합니다.',
    sourceNote: '라인업/스테이지 중심 seed이며, 세부 exact timetable은 추가 수집 대상으로 둡니다.',
  },
  {
    eventId: 'festival-seoul-jazz-2026',
    label: '서울재즈페스티벌 2026 매크로',
    summary: '공식 홈페이지, 멜론티켓, 공개 기사 기준으로 일정, 티켓, 대표 라인업을 한 번에 불러옵니다.',
    sourceNote: '공개 정보 스냅샷 초안이며, 세부 stage/time은 후속 검수 대상입니다.',
  },
];

const createGeneratedFestivalDraftId = (festivalName: string) => {
  const slug = normalizeSlug(festivalName);
  return slug ? `festival-${slug}` : `festival-draft-${Date.now()}`;
};

export default function AdminEventsPage() {
  const isSupabaseReady = hasSupabaseEnv();
  const importFileInputRef = useRef<HTMLInputElement | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [formData, setFormData] = useState<EventFormState>(initialEventState);
  const [lineupRows, setLineupRows] = useState<LineupEditorRow[]>([]);
  const [timetableRows, setTimetableRows] = useState<TimetableEditorRow[]>([]);
  const [ticketRows, setTicketRows] = useState<TicketEditorRow[]>([]);
  const [lineupImportText, setLineupImportText] = useState('');
  const [timetableImportText, setTimetableImportText] = useState('');
  const [ticketImportText, setTicketImportText] = useState('');
  const [importTarget, setImportTarget] = useState<'lineup' | 'timetable'>('lineup');
  const [importImageName, setImportImageName] = useState('');
  const [importImagePreviewUrl, setImportImagePreviewUrl] = useState('');
  const [importExtractedText, setImportExtractedText] = useState('');
  const [importPreview, setImportPreview] = useState<ImportPreviewState | null>(null);
  const [importQaComparison, setImportQaComparison] = useState<ImportQaComparisonState | null>(null);
  const [draftSourceLinks, setDraftSourceLinks] = useState<ImportPlaybookSourceLink[]>([]);
  const [macroFestivalName, setMacroFestivalName] = useState('');
  const [macroOfficialUrl, setMacroOfficialUrl] = useState('');
  const [macroTicketUrl, setMacroTicketUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingRelated, setLoadingRelated] = useState(false);
  const [activeSection, setActiveSection] = useState<AdminSection>('event');
  const [selectedAdminDayBySection, setSelectedAdminDayBySection] = useState<AdminDaySelection>({
    lineup: '',
    timetable: '',
  });
  const [pendingDayDeletion, setPendingDayDeletion] = useState<PendingDayDeletion | null>(null);
  const [messageState, setMessageState] = useState<NoticeItem | null>(null);
  const [noticeHistory, setNoticeHistory] = useState<NoticeItem[]>([]);
  const [isNoticeHistoryOpen, setIsNoticeHistoryOpen] = useState(false);
  const [isSavingEvent, setIsSavingEvent] = useState(false);
  const [isSavingLineup, setIsSavingLineup] = useState(false);
  const [isSavingTimetable, setIsSavingTimetable] = useState(false);
  const [isSavingTickets, setIsSavingTickets] = useState(false);
  const [draggedLineupClientId, setDraggedLineupClientId] = useState<string | null>(null);
  const [selectedLineupClientId, setSelectedLineupClientId] = useState<string | null>(null);
  const [resizeSession, setResizeSession] = useState<ResizeSession | null>(null);
  const [editingStageKey, setEditingStageKey] = useState<string | null>(null);
  const [stageRenameDraft, setStageRenameDraft] = useState('');
  const [stageOrderByDay, setStageOrderByDay] = useState<Record<string, string[]>>({});
  const [hiddenStageNamesByDay, setHiddenStageNamesByDay] = useState<Record<string, string[]>>({});
  const [newStageNameByDay, setNewStageNameByDay] = useState<Record<string, string>>({});
  const [timelineSettingsByDay, setTimelineSettingsByDay] = useState<Record<string, TimelineDaySettings>>({});
  const [savedSectionSignatures, setSavedSectionSignatures] = useState<SavedSectionSignatures>(() => createEmptySectionSignatures());
  const [lastSavedAtBySection, setLastSavedAtBySection] = useState<LastSavedAtBySection>({});
  const [sectionOrder, setSectionOrder] = useState<AdminSection[]>(adminSectionConfigs.map((item) => item.id));
  const [editorUndoStack, setEditorUndoStack] = useState<EditorUndoSnapshot[]>([]);
  const [editorRedoStack, setEditorRedoStack] = useState<EditorUndoSnapshot[]>([]);
  const [localDraftSourceId, setLocalDraftSourceId] = useState<string | null>(null);
  const hasLoadedSectionOrder = useRef(false);
  const activeUndoInputSessionRef = useRef<string | null>(null);
  const lineupOrderingState = buildLineupOrderingState(lineupRows);
  const activeImportPlaybook = getImportPlaybook(localDraftSourceId ?? selectedEventId, importTarget);
  const eventDayTokens = getEventDayTokens(formData.start_date, formData.end_date);
  const currentImportSourceLinks = activeImportPlaybook?.sourceLinks ?? draftSourceLinks;

  const buildGenericImportVisionPrompt = (festivalName: string, target: 'lineup' | 'timetable') => {
    const trimmedName = festivalName.trim() || 'Festival';

    if (target === 'lineup') {
      return `아래 ${trimmedName}의 공식 홈페이지, 티켓 페이지, 라인업 이미지를 확인하고 TSV만 출력해줘.

규칙:
1. 헤더는 정확히 "date\tartist\torder\trole\theadliner\tstatus\tnote" 한 줄로 시작한다.
2. 각 아티스트를 한 줄씩 출력한다.
3. date는 YYYY-MM-DD 형식으로 맞추고, 정확한 날짜가 아직 없으면 빈칸으로 둔다.
4. order는 같은 날 기준 공개 순서대로 넣는다.
5. role은 기본값 lineup, headliner는 true/false, status는 confirmed/rumored/cancelled 중 하나를 사용한다.
6. TSV 외 설명, 코드블록, 번호 목록은 절대 출력하지 않는다.`;
    }

    return `아래 ${trimmedName}의 공식 타임테이블 이미지나 공지를 확인하고 TSV만 출력해줘.

규칙:
1. 헤더는 정확히 "date\tstage\tartist\tstart\tend\ttitle\tsource" 한 줄로 시작한다.
2. 각 공연 세트마다 한 줄씩 출력한다.
3. date는 YYYY-MM-DD 형식, start/end는 HH:MM 24시간 형식으로 맞춘다.
4. 시간이 불명확하면 추측하지 말고 빈칸으로 둔다.
5. source는 모든 행에 "generic-festival-intake"를 넣는다.
6. TSV 외 설명, 코드블록, 번호 목록은 절대 출력하지 않는다.`;
  };

  const genericImportGuidePrompt = formData.title.trim()
    ? buildGenericImportVisionPrompt(formData.title, importTarget)
    : '';

  const setMessage = (text: string) => {
    if (!text) {
      setMessageState(null);
      return;
    }

    if (quietNoticePatterns.some((pattern) => text.includes(pattern))) {
      return;
    }

    const nextNotice = {
      id: createClientId(),
      text,
      createdAt: new Date().toISOString(),
    };

    setMessageState(nextNotice);
    setNoticeHistory((current) => [nextNotice, ...current].slice(0, 24));
  };

  const buildEditorUndoSnapshot = useCallback((): EditorUndoSnapshot => ({
    formData: JSON.parse(JSON.stringify(formData)),
    lineupRows: JSON.parse(JSON.stringify(lineupRows)),
    timetableRows: JSON.parse(JSON.stringify(timetableRows)),
    ticketRows: JSON.parse(JSON.stringify(ticketRows)),
    stageOrderByDay: JSON.parse(JSON.stringify(stageOrderByDay)),
    hiddenStageNamesByDay: JSON.parse(JSON.stringify(hiddenStageNamesByDay)),
    timelineSettingsByDay: JSON.parse(JSON.stringify(timelineSettingsByDay)),
    selectedAdminDayBySection: JSON.parse(JSON.stringify(selectedAdminDayBySection)),
    selectedLineupClientId,
  }), [formData, hiddenStageNamesByDay, lineupRows, selectedAdminDayBySection, selectedLineupClientId, stageOrderByDay, ticketRows, timelineSettingsByDay, timetableRows]);

  const getEditorUndoSnapshotSignature = (snapshot: EditorUndoSnapshot) =>
    JSON.stringify([
      serializeEventFormState(snapshot.formData),
      serializeLineupState(
        snapshot.lineupRows,
        snapshot.stageOrderByDay,
        snapshot.hiddenStageNamesByDay,
        snapshot.timelineSettingsByDay
      ),
      serializeTimetableState(snapshot.timetableRows),
      serializeTicketState(snapshot.ticketRows),
      snapshot.selectedAdminDayBySection,
      snapshot.selectedLineupClientId,
    ]);

  const pushEditorUndoSnapshot = () => {
    const nextSnapshot = buildEditorUndoSnapshot();
    const currentLastSnapshot = editorUndoStack.at(-1);
    if (
      currentLastSnapshot &&
      getEditorUndoSnapshotSignature(currentLastSnapshot) === getEditorUndoSnapshotSignature(nextSnapshot)
    ) {
      return;
    }

    setEditorUndoStack((current) => [...current, nextSnapshot].slice(-MAX_EDITOR_UNDO_STEPS));
    setEditorRedoStack([]);
  };

  const restoreEditorUndoSnapshot = useCallback((snapshot: EditorUndoSnapshot) => {
    setFormData(snapshot.formData);
    setLineupRows(snapshot.lineupRows);
    setTimetableRows(snapshot.timetableRows);
    setTicketRows(snapshot.ticketRows);
    setStageOrderByDay(snapshot.stageOrderByDay);
    setHiddenStageNamesByDay(snapshot.hiddenStageNamesByDay);
    setTimelineSettingsByDay(snapshot.timelineSettingsByDay);
    setSelectedAdminDayBySection(snapshot.selectedAdminDayBySection);
    setSelectedLineupClientId(snapshot.selectedLineupClientId);
    setPendingDayDeletion(null);
    setEditingStageKey(null);
    setStageRenameDraft('');
  }, []);

  const handleUndoEditor = useCallback(() => {
    const previousSnapshot = editorUndoStack.at(-1);
    if (!previousSnapshot) return;

    const currentSnapshot = buildEditorUndoSnapshot();
    activeUndoInputSessionRef.current = null;
    restoreEditorUndoSnapshot(previousSnapshot);
    setEditorUndoStack((current) => current.slice(0, -1));
    setEditorRedoStack((current) => [...current, currentSnapshot].slice(-MAX_EDITOR_UNDO_STEPS));
    setMessage('최근 편집을 되돌렸습니다.');
  }, [buildEditorUndoSnapshot, editorUndoStack, restoreEditorUndoSnapshot]);

  const handleRedoEditor = useCallback(() => {
    const nextSnapshot = editorRedoStack.at(-1);
    if (!nextSnapshot) return;

    const currentSnapshot = buildEditorUndoSnapshot();
    activeUndoInputSessionRef.current = null;
    restoreEditorUndoSnapshot(nextSnapshot);
    setEditorRedoStack((current) => current.slice(0, -1));
    setEditorUndoStack((current) => [...current, currentSnapshot].slice(-MAX_EDITOR_UNDO_STEPS));
    setMessage('되돌린 편집을 다시 적용했습니다.');
  }, [buildEditorUndoSnapshot, editorRedoStack, restoreEditorUndoSnapshot]);

  const beginUndoInputSession = (sessionKey: string) => {
    if (activeUndoInputSessionRef.current === sessionKey) {
      return;
    }

    pushEditorUndoSnapshot();
    activeUndoInputSessionRef.current = sessionKey;
  };

  const endUndoInputSession = () => {
    activeUndoInputSessionRef.current = null;
  };

  const getLineupGroupKey = (row: Pick<LineupEditorRow, 'performance_date' | 'stage_name'>) =>
    `${row.performance_date || '__undated__'}::${row.stage_name.trim() || '__stage__'}`;

  const parseLineupGroupKey = (groupKey: string) => {
    const [dateToken, stageToken] = groupKey.split('::');
    return {
      performance_date: dateToken === '__undated__' ? '' : dateToken,
      stage_name: stageToken === '__stage__' ? '' : stageToken,
    };
  };

  const getLineupOrderValue = (row: LineupEditorRow) => {
    const parsed = Number(row.display_order);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : Number.MAX_SAFE_INTEGER;
  };

  const sortLineupGroupRows = (rows: LineupEditorRow[]) => {
    const shouldUseTimePriority = shouldUseTimePriorityForLineupGroup(rows);

    return rows.slice().sort((left, right) => {
      if (shouldUseTimePriority && left.start_time !== right.start_time) {
        return left.start_time.localeCompare(right.start_time);
      }

      if (getLineupOrderValue(left) !== getLineupOrderValue(right)) {
        return getLineupOrderValue(left) - getLineupOrderValue(right);
      }

      return left.artist_name.localeCompare(right.artist_name);
    });
  };

  const normalizeLineupGroupRows = (rows: LineupEditorRow[], groupKey: string) => {
    const { performance_date, stage_name } = parseLineupGroupKey(groupKey);

    return rows.map((row, index) => ({
      ...row,
      performance_date,
      stage_name,
      display_order: String(index + 1),
    }));
  };

  const updateLineupRow = (clientId: string, updates: Partial<LineupEditorRow>) => {
    setLineupRows((current) =>
      current.map((row) => (row.client_id === clientId ? { ...row, ...updates } : row))
    );
  };

  const updateTimetableRow = (clientId: string, updates: Partial<TimetableEditorRow>) => {
    setTimetableRows((current) =>
      current.map((row) => (row.client_id === clientId ? { ...row, ...updates } : row))
    );
  };

  const nudgeLineupRowTime = (
    clientId: string,
    field: 'start_time' | 'end_time',
    minutesDelta: number
  ) => {
    const targetRow = lineupRows.find((row) => row.client_id === clientId);
    if (!targetRow) return;

    const currentTime = targetRow[field].trim();
    if (!currentTime) {
      setMessage('먼저 시간을 입력한 뒤 5분 단위 조정을 사용할 수 있습니다.');
      return;
    }

    const nextTime = addMinutesToTime(currentTime, minutesDelta);
    const startMinutes = parseTimeToMinutes(field === 'start_time' ? nextTime : targetRow.start_time.trim());
    const endMinutes = parseTimeToMinutes(field === 'end_time' ? nextTime : targetRow.end_time.trim());

    if (startMinutes !== null && endMinutes !== null && endMinutes <= startMinutes) {
      setMessage('종료 시간은 시작 시간보다 늦어야 합니다.');
      return;
    }

    pushEditorUndoSnapshot();
    updateLineupRow(
      clientId,
      field === 'start_time' ? { start_time: nextTime } : { end_time: nextTime }
    );
  };

  const getDraggedClientId = (event?: React.DragEvent<HTMLElement>) =>
    event?.dataTransfer.getData('text/plain') || draggedLineupClientId;

  const moveLineupRowToTimedSlot = (clientId: string, targetGroupKey: string, startTime: string) => {
    pushEditorUndoSnapshot();
    setLineupRows((current) => {
      const sourceRow = current.find((row) => row.client_id === clientId);
      if (!sourceRow) return current;

      const sourceGroupKey = getLineupGroupKey(sourceRow);
      const { performance_date, stage_name } = parseLineupGroupKey(targetGroupKey);
      const currentDuration =
        sourceRow.start_time.trim() && sourceRow.end_time.trim()
          ? (parseTimeToMinutes(sourceRow.end_time.trim()) ?? 0) - (parseTimeToMinutes(sourceRow.start_time.trim()) ?? 0)
          : null;
      const nextEndTime = addMinutesToTime(startTime, currentDuration && currentDuration > 0 ? currentDuration : 50);
      const movedRow: LineupEditorRow = {
        ...sourceRow,
        performance_date,
        stage_name,
        start_time: startTime,
        end_time: nextEndTime,
      };
      const currentWithoutSource = current.filter((row) => row.client_id !== clientId);
      const affectedGroupKeys = Array.from(new Set([sourceGroupKey, targetGroupKey]));
      const nextGroups = new Map<string, LineupEditorRow[]>();

      affectedGroupKeys.forEach((groupKey) => {
        nextGroups.set(
          groupKey,
          currentWithoutSource.filter((row) => getLineupGroupKey(row) === groupKey)
        );
      });

      const targetRows = nextGroups.get(targetGroupKey) ?? [];
      nextGroups.set(
        targetGroupKey,
        normalizeLineupGroupRows(sortLineupGroupRows([...targetRows, movedRow]), targetGroupKey)
      );

      if (sourceGroupKey !== targetGroupKey) {
        nextGroups.set(
          sourceGroupKey,
          normalizeLineupGroupRows(sortLineupGroupRows(nextGroups.get(sourceGroupKey) ?? []), sourceGroupKey)
        );
      }

      const unaffectedRows = currentWithoutSource.filter(
        (row) => !affectedGroupKeys.includes(getLineupGroupKey(row))
      );

      return [...unaffectedRows, ...affectedGroupKeys.flatMap((groupKey) => nextGroups.get(groupKey) ?? [])];
    });
    setMessage('카드를 timeline에 배치했습니다. 날짜, stage, 시작/종료 시간이 함께 반영되며 `라인업 저장` 후 DB에 저장됩니다.');
  };

  const moveStageWithinDay = (dayKey: string, stageKey: string, direction: -1 | 1) => {
    pushEditorUndoSnapshot();
    setStageOrderByDay((current) => {
      const currentOrder = current[dayKey] ?? [];
      const stageIndex = currentOrder.indexOf(stageKey);
      const nextIndex = stageIndex + direction;

      if (stageIndex < 0 || nextIndex < 0 || nextIndex >= currentOrder.length) {
        return current;
      }

      const reordered = currentOrder.slice();
      const [moved] = reordered.splice(stageIndex, 1);
      reordered.splice(nextIndex, 0, moved);
      return { ...current, [dayKey]: reordered };
    });
    setMessage('스테이지 컬럼 순서를 변경했습니다. 현재 보드 뷰에 바로 반영됩니다.');
  };

  const beginStageRename = (stageKey: string, stageName: string) => {
    setEditingStageKey(stageKey);
    setStageRenameDraft(stageName);
  };

  const cancelStageRename = useCallback(() => {
    setEditingStageKey(null);
    setStageRenameDraft('');
  }, []);

  const commitStageRename = (dayKey: string, previousStageName: string) => {
    renameStageWithinDay(dayKey, previousStageName, stageRenameDraft);
    setEditingStageKey(null);
    setStageRenameDraft('');
  };

  const renameStageWithinDay = (dayKey: string, previousStageName: string, rawNextStageName: string) => {
    const nextStageName = rawNextStageName.trim();
    if (!nextStageName) {
      setMessage('stage 이름을 비워둘 수 없습니다.');
      return;
    }

    if (nextStageName === previousStageName) {
      return;
    }

    const existingStageNames = stageOrderByDay[dayKey] ?? [];
    if (existingStageNames.includes(nextStageName)) {
      setMessage('같은 날짜에 이미 같은 stage 이름이 있습니다.');
      return;
    }

    pushEditorUndoSnapshot();
    setStageOrderByDay((current) => ({
      ...current,
      [dayKey]: (current[dayKey] ?? []).map((stageName) => (stageName === previousStageName ? nextStageName : stageName)),
    }));
    setHiddenStageNamesByDay((current) => ({
      ...current,
      [dayKey]: (current[dayKey] ?? []).map((stageName) => (stageName === previousStageName ? nextStageName : stageName)),
    }));
    setLineupRows((current) =>
      current.map((row) =>
        (row.performance_date || '__undated__') === dayKey && row.stage_name.trim() === previousStageName
          ? { ...row, stage_name: nextStageName }
          : row
      )
    );
    setTimetableRows((current) =>
      current.map((row) =>
        ((row.start_at ? row.start_at.slice(0, 10) : '__undated__') === dayKey) && row.stage_name.trim() === previousStageName
          ? { ...row, stage_name: nextStageName }
          : row
      )
    );

    if (
      selectedLineupRow &&
      (selectedLineupRow.performance_date || '__undated__') === dayKey &&
      selectedLineupRow.stage_name.trim() === previousStageName
    ) {
      updateLineupRow(selectedLineupRow.client_id, { stage_name: nextStageName });
    }

    setMessage(`${previousStageName} stage 이름을 ${nextStageName}(으)로 변경했습니다. 저장 후 public에도 반영됩니다.`);
  };

  const addStageToDay = (dayKey: string, rawStageName?: string) => {
    const stageName = (rawStageName ?? newStageNameByDay[dayKey] ?? '').trim();
    if (!stageName) {
      setMessage('추가할 stage 이름을 입력해주세요.');
      return;
    }

    pushEditorUndoSnapshot();
    setStageOrderByDay((current) => {
      const currentStages = current[dayKey] ?? [];
      if (currentStages.includes(stageName)) {
        return current;
      }

      return {
        ...current,
        [dayKey]: [...currentStages, stageName],
      };
    });
    setHiddenStageNamesByDay((current) => ({
      ...current,
      [dayKey]: (current[dayKey] ?? []).filter((item) => item !== stageName),
    }));
    setNewStageNameByDay((current) => ({ ...current, [dayKey]: '' }));
    setMessage(`${stageName} stage를 추가했습니다. 이제 timeline에 바로 블록을 배치할 수 있습니다.`);
  };

  const getSuggestedStageName = (dayKey: string) => {
    const usedStageNames = new Set(
      [
        ...(stageOrderByDay[dayKey] ?? []),
        ...(hiddenStageNamesByDay[dayKey] ?? []),
        ...lineupRows
          .filter((row) => (row.performance_date || '__undated__') === dayKey)
          .map((row) => row.stage_name.trim()),
        ...timetableRows
          .filter((row) => getTimetableDayKey(row) === dayKey)
          .map((row) => row.stage_name.trim()),
      ].filter(Boolean)
    );

    let index = Math.max(usedStageNames.size + 1, 1);
    while (usedStageNames.has(`Stage ${index}`)) {
      index += 1;
    }

    return `Stage ${index}`;
  };

  const quickAddLineupRow = (dayKey: string) => {
    pushEditorUndoSnapshot();
    const nextRow = createLineupRowForDay(dayKey);
    setLineupRows((current) => [...current, nextRow]);
    setSelectedLineupClientId(nextRow.client_id);
  };

  const quickAddTimetableRow = (dayKey: string) => {
    pushEditorUndoSnapshot();
    const nextRow = createTimetableRowForDay(dayKey);
    setTimetableRows((current) => [...current, nextRow]);
  };

  const quickAddStage = (dayKey: string) => {
    addStageToDay(dayKey, getSuggestedStageName(dayKey));
  };

  const hideStageFromDay = (dayKey: string, stageName: string) => {
    const normalizedStageName = stageName.trim();
    if (!normalizedStageName) return;

    pushEditorUndoSnapshot();
    setStageOrderByDay((current) => ({
      ...current,
      [dayKey]: (current[dayKey] ?? []).filter((item) => item !== normalizedStageName),
    }));
    setHiddenStageNamesByDay((current) => {
      const currentHiddenStages = current[dayKey] ?? [];
      if (currentHiddenStages.includes(normalizedStageName)) {
        return current;
      }

      return {
        ...current,
        [dayKey]: [...currentHiddenStages, normalizedStageName],
      };
    });
    if (editingStageKey === `${dayKey}::${normalizedStageName}`) {
      cancelStageRename();
    }
    setMessage(`${normalizedStageName} stage를 숨겼습니다. 저장 후 public에서 제외됩니다.`);
  };

  const restoreHiddenStageToDay = (dayKey: string, stageName: string) => {
    const normalizedStageName = stageName.trim();
    if (!normalizedStageName) return;

    pushEditorUndoSnapshot();
    setHiddenStageNamesByDay((current) => ({
      ...current,
      [dayKey]: (current[dayKey] ?? []).filter((item) => item !== normalizedStageName),
    }));
    setStageOrderByDay((current) => {
      const visibleStages = current[dayKey] ?? [];
      if (visibleStages.includes(normalizedStageName)) {
        return current;
      }

      return {
        ...current,
        [dayKey]: [...visibleStages, normalizedStageName],
      };
    });
    setMessage(`${normalizedStageName} stage를 복구했습니다. 저장 후 public에도 다시 보입니다.`);
  };

  const canDeleteStageFromDay = (dayKey: string, stageName: string) => {
    const normalizedStageName = stageName.trim();
    if (!normalizedStageName) return false;

    const hasLineupRows = lineupRows.some(
      (row) =>
        (row.performance_date || '__undated__') === dayKey &&
        row.stage_name.trim() === normalizedStageName &&
        row.artist_name.trim()
    );
    const hasTimetableRows = timetableRows.some(
      (row) =>
        (row.start_at ? row.start_at.slice(0, 10) : '__undated__') === dayKey &&
        row.stage_name.trim() === normalizedStageName
    );

    return !hasLineupRows && !hasTimetableRows;
  };

  const deleteStageFromDay = (dayKey: string, stageName: string) => {
    if (!canDeleteStageFromDay(dayKey, stageName)) {
      setMessage('빈 stage만 삭제할 수 있습니다. 먼저 해당 stage의 블록을 옮기거나 삭제해주세요.');
      return;
    }

    pushEditorUndoSnapshot();
    setStageOrderByDay((current) => ({
      ...current,
      [dayKey]: (current[dayKey] ?? []).filter((item) => item !== stageName),
    }));
    setHiddenStageNamesByDay((current) => ({
      ...current,
      [dayKey]: (current[dayKey] ?? []).filter((item) => item !== stageName),
    }));

    if (editingStageKey === `${dayKey}::${stageName}`) {
      cancelStageRename();
    }

    setMessage(`${stageName} stage를 삭제했습니다. 라인업 저장 후 public에도 반영됩니다.`);
  };

  const addEventDay = () => {
    const datedDayKeys = adminDayItems.map((day) => day.key).filter((dayKey) => dayKey !== '__undated__');
    const lastDayKey =
      datedDayKeys[datedDayKeys.length - 1] ??
      formData.end_date.slice(0, 10) ??
      formData.start_date.slice(0, 10);

    if (!lastDayKey) {
      setMessage('먼저 Event Basics에서 시작/종료 일시를 입력해주세요.');
      setActiveSection('event');
      return;
    }

    pushEditorUndoSnapshot();
    const existingDayKeys = new Set(adminDayItems.map((day) => day.key));
    let nextDayKey = addDaysToLocalDateTime(`${lastDayKey}T00:00`, 1).slice(0, 10);
    while (existingDayKeys.has(nextDayKey)) {
      nextDayKey = addDaysToLocalDateTime(`${nextDayKey}T00:00`, 1).slice(0, 10);
    }

    const fallbackTime =
      formData.end_date.slice(11, 16) ||
      formData.start_date.slice(11, 16) ||
      '23:00';
    const nextEndDate = replaceDatePart(
      formData.end_date || formData.start_date || `${lastDayKey}T${fallbackTime}`,
      nextDayKey,
      fallbackTime
    );

    setFormData((current) => ({
      ...current,
      end_date: nextEndDate,
    }));
    setStageOrderByDay((current) => (
      current[nextDayKey]
        ? current
        : { ...current, [nextDayKey]: [] }
    ));
    setHiddenStageNamesByDay((current) => (
      current[nextDayKey]
        ? current
        : { ...current, [nextDayKey]: [] }
    ));
    setTimelineSettingsByDay((current) => (
      current[nextDayKey]
        ? current
        : { ...current, [nextDayKey]: getDefaultTimelineSettings([]) }
    ));
    setSelectedAdminDayBySection((current) => ({
      ...current,
      lineup: nextDayKey,
      timetable: nextDayKey,
    }));
    setPendingDayDeletion(null);
    setMessage(`새 Day 템플릿을 추가했습니다. ${nextDayKey} 기준으로 라인업과 타임테이블을 바로 입력할 수 있습니다.`);
  };

  const deleteEventDay = (dayKey: string) => {
    pushEditorUndoSnapshot();
    const datedDayKeys = datedAdminDayItems.map((day) => day.key);
    const targetIndex = datedDayKeys.indexOf(dayKey);
    const fallbackDayKey =
      datedDayKeys[targetIndex - 1] ??
      datedDayKeys[0] ??
      defaultAdminDayKey;
    const nextEndDate =
      fallbackDayKey && fallbackDayKey !== '__undated__'
        ? replaceDatePart(
            formData.end_date || formData.start_date || `${fallbackDayKey}T23:00`,
            fallbackDayKey,
            formData.end_date.slice(11, 16) || formData.start_date.slice(11, 16) || '23:00'
          )
        : formData.end_date;

    setLineupRows((current) => current.filter((row) => (row.performance_date || '__undated__') !== dayKey));
    setTimetableRows((current) => current.filter((row) => getTimetableDayKey(row) !== dayKey));
    setStageOrderByDay((current) => {
      const next = { ...current };
      delete next[dayKey];
      return next;
    });
    setHiddenStageNamesByDay((current) => {
      const next = { ...current };
      delete next[dayKey];
      return next;
    });
    setTimelineSettingsByDay((current) => {
      const next = { ...current };
      delete next[dayKey];
      return next;
    });
    setNewStageNameByDay((current) => {
      const next = { ...current };
      delete next[dayKey];
      return next;
    });
    setSelectedAdminDayBySection((current) => ({
      lineup: current.lineup === dayKey ? (fallbackDayKey || '') : current.lineup,
      timetable: current.timetable === dayKey ? (fallbackDayKey || '') : current.timetable,
    }));
    setSelectedLineupClientId((current) => {
      if (!current) return current;
      const targetRow = lineupRows.find((row) => row.client_id === current);
      return targetRow && (targetRow.performance_date || '__undated__') === dayKey ? null : current;
    });
    setPendingDayDeletion(null);

    if (dayKey === lastDeletableDayKey && nextEndDate) {
      setFormData((current) => ({
        ...current,
        end_date: nextEndDate,
      }));
    }

    setMessage(`${dayKey} Day를 삭제했습니다. 저장 후 public에도 반영됩니다.`);
  };

  const requestDeleteEventDay = (dayKey: string) => {
    if (!lastDeletableDayKey || dayKey !== lastDeletableDayKey) {
      setMessage('Day 삭제는 현재 마지막 Day에서만 가능합니다. 중간 Day 삭제는 추후 별도 흐름으로 지원할 예정입니다.');
      return;
    }

    const summary = getDayDeletionSummary(dayKey);
    if (!summary.hasAnyData) {
      deleteEventDay(dayKey);
      return;
    }

    setPendingDayDeletion({
      dayKey,
      confirmText: '',
    });
    setMessage('');
  };

  const confirmDeleteEventDay = () => {
    if (!pendingDayDeletion) return;

    if (pendingDayDeletion.confirmText !== pendingDayDeletion.dayKey) {
      setMessage(`삭제 확인을 위해 ${pendingDayDeletion.dayKey}를 정확히 입력해주세요.`);
      return;
    }

    deleteEventDay(pendingDayDeletion.dayKey);
  };

  const createLineupRowForDay = (dayKey: string) => ({
    ...createEmptyLineupRow(),
    performance_date: dayKey === '__undated__' ? '' : dayKey,
  });

  const createTimetableRowForDay = (dayKey: string) => {
    if (!dayKey || dayKey === '__undated__') {
      return createEmptyTimetableRow();
    }

    const fallbackRows = lineupRows.filter((row) => (row.performance_date || '__undated__') === dayKey);
    const timelineSettings = timelineSettingsByDay[dayKey] ?? getDefaultTimelineSettings(fallbackRows);
    const nextStartAt = `${dayKey}T${timelineSettings.startTime}`;

    return {
      ...createEmptyTimetableRow(),
      start_at: nextStartAt,
      end_at: addMinutesToLocalDateTime(nextStartAt, 50),
    };
  };

  const updateTimelineSettings = useCallback((dayKey: string, updates: Partial<TimelineDaySettings>) => {
    setTimelineSettingsByDay((current) => {
      const fallbackRows = lineupRows.filter((row) => (row.performance_date || '__undated__') === dayKey);
      const base = current[dayKey] ?? getDefaultTimelineSettings(fallbackRows);
      return {
        ...current,
        [dayKey]: {
          ...base,
          ...updates,
          intervalMinutes: TIMELINE_INTERVAL_MINUTES,
        },
      };
    });
  }, [lineupRows]);

  const resetTimelineSettings = (dayKey: string) => {
    pushEditorUndoSnapshot();
    const fallbackRows = lineupRows.filter((row) => (row.performance_date || '__undated__') === dayKey);
    setTimelineSettingsByDay((current) => ({
      ...current,
      [dayKey]: getDefaultTimelineSettings(fallbackRows),
    }));
    setMessage('보이는 시간 범위를 데이터 기준으로 다시 맞췄습니다.');
  };

  const renderAdminDaySelector = (section: 'lineup' | 'timetable') => {
    const selectedDayKey = selectedAdminDayBySection[section] || defaultAdminDayKey;

    if (adminDayItems.length === 0) {
      return (
        <div className="mt-6 flex items-center justify-between gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-500">
          <p>먼저 Event Basics에서 날짜를 정하면 Day 1 보드를 바로 편집할 수 있습니다.</p>
          <button
            type="button"
            onClick={addEventDay}
            className="rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
          >
            + Day 추가
          </button>
        </div>
      );
    }

    return (
      <div className="mt-6 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-2">
          {adminDayItems.map((day) => (
            <div
              key={`${section}-${day.key}`}
              className={`flex items-start gap-2 rounded-2xl border px-4 py-3 transition-colors ${
                selectedDayKey === day.key
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white'
              }`}
            >
              <button
                type="button"
                onClick={() =>
                  setSelectedAdminDayBySection((current) => ({
                    ...current,
                    [section]: day.key,
                  }))
                }
                className="text-left"
              >
                <p className="text-sm font-semibold">{day.label}</p>
                <p className={`mt-1 text-xs ${selectedDayKey === day.key ? 'text-slate-300' : 'text-slate-500'}`}>
                  {day.date}
                </p>
              </button>
              {day.key === lastDeletableDayKey && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    requestDeleteEventDay(day.key);
                  }}
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    selectedDayKey === day.key
                      ? 'bg-white/10 text-white hover:bg-white/20'
                      : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                  }`}
                  title="마지막 Day 삭제"
                >
                  x
                </button>
              )}
            </div>
          ))}
          </div>
          <button
            type="button"
            onClick={addEventDay}
            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            + Day 추가
          </button>
        </div>
        {pendingDayDeletion && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            <p className="font-semibold">Day 삭제 확인</p>
            <p className="mt-2 leading-6">
              {pendingDayDeletion.dayKey}에는
              {' '}
              {getDayDeletionSummary(pendingDayDeletion.dayKey).lineupCount}개의 lineup,
              {' '}
              {getDayDeletionSummary(pendingDayDeletion.dayKey).timetableCount}개의 timetable,
              {' '}
              {getDayDeletionSummary(pendingDayDeletion.dayKey).stageCount}개의 stage가 연결되어 있습니다.
              실수 방지를 위해 아래에 날짜를 그대로 입력해야 삭제됩니다.
            </p>
            <div className="mt-3 flex flex-col gap-3 md:flex-row">
              <input
                value={pendingDayDeletion.confirmText}
                onChange={(event) =>
                  setPendingDayDeletion((current) =>
                    current
                      ? {
                          ...current,
                          confirmText: event.target.value,
                        }
                      : current
                  )
                }
                placeholder={pendingDayDeletion.dayKey}
                className="w-full rounded-md border border-amber-300 bg-white px-3 py-2 text-sm"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={confirmDeleteEventDay}
                  className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                >
                  Day 삭제
                </button>
                <button
                  type="button"
                  onClick={() => setPendingDayDeletion(null)}
                  className="rounded-md border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const moveAdminSection = (sectionId: AdminSection, direction: -1 | 1) => {
    setSectionOrder((current) => {
      const currentIndex = current.indexOf(sectionId);
      const nextIndex = currentIndex + direction;

      if (currentIndex < 0 || nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }

      const nextOrder = current.slice();
      const [movedSection] = nextOrder.splice(currentIndex, 1);
      nextOrder.splice(nextIndex, 0, movedSection);
      return nextOrder;
    });
  };

  const resetAdminSectionOrder = () => {
    setSectionOrder(adminSectionConfigs.map((item) => item.id));
  };

  const selectedLineupRow = selectedLineupClientId
    ? lineupRows.find((row) => row.client_id === selectedLineupClientId) ?? null
    : null;

  const selectedLineupDayKey =
    selectedLineupRow?.performance_date ||
    selectedAdminDayBySection.lineup ||
    '__undated__';
  const selectedLineupStageOptions = Array.from(
    new Set([
      ...(stageOrderByDay[selectedLineupDayKey] ?? []),
      ...lineupRows
        .filter((row) => (row.performance_date || '__undated__') === selectedLineupDayKey)
        .map((row) => row.stage_name.trim())
      .filter(Boolean),
    ])
  );

  const currentSectionSignatures: SavedSectionSignatures = {
    event: serializeEventFormState(formData),
    imports: serializeImportState({
      importTarget,
      importImageName,
      importExtractedText,
      lineupImportText,
      timetableImportText,
      ticketImportText,
    }),
    lineup: serializeLineupState(lineupRows, stageOrderByDay, hiddenStageNamesByDay, timelineSettingsByDay),
    timetable: serializeTimetableState(timetableRows),
    tickets: serializeTicketState(ticketRows),
  };

  const updateSavedSections = (
    nextSignatures: Partial<SavedSectionSignatures>,
    nextSavedAt: Partial<LastSavedAtBySection> = {}
  ) => {
    setSavedSectionSignatures((current) => ({ ...current, ...nextSignatures }));
    setLastSavedAtBySection((current) => ({ ...current, ...nextSavedAt }));
  };

  const getSectionStatus = (section: AdminSection) => {
    if (section === 'event' && isSavingEvent) return 'saving';
    if (section === 'lineup' && isSavingLineup) return 'saving';
    if (section === 'timetable' && isSavingTimetable) return 'saving';
    if (section === 'tickets' && isSavingTickets) return 'saving';
    if (currentSectionSignatures[section] !== savedSectionSignatures[section]) return 'dirty';
    if (lastSavedAtBySection[section]) return 'saved';
    return 'idle';
  };

  const formatSavedAt = (value: string | null | undefined) => {
    if (!value) return '';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '';
    return parsed.toLocaleString('ko-KR', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  const boardLineupRows = lineupRows.filter((row) => row.artist_name.trim());

  const lineupBoardDays = Array.from(
    new Set([
      ...boardLineupRows.map((row) => row.performance_date || '__undated__'),
      ...Object.keys(stageOrderByDay),
      ...Object.keys(hiddenStageNamesByDay),
      ...Object.keys(timelineSettingsByDay),
      ...timetableRows.map((row) => getTimetableDayKey(row)),
      ...getEventDayTokens(formData.start_date, formData.end_date || formData.start_date),
    ])
  )
    .sort(compareDayKeys)
    .map((dateToken, index) => {
      const dayRows = boardLineupRows.filter((row) => (row.performance_date || '__undated__') === dateToken);
      const unscheduledRows = dayRows
        .filter((row) => !row.start_time.trim())
        .slice()
        .sort((left, right) => {
          const leftOrder = getLineupOrderValue(left);
          const rightOrder = getLineupOrderValue(right);
          if (leftOrder !== rightOrder) return leftOrder - rightOrder;
          if ((left.stage_name || '') !== (right.stage_name || '')) {
            return (left.stage_name || '').localeCompare(right.stage_name || '');
          }
          return left.artist_name.localeCompare(right.artist_name);
        });
      const defaultStageOrder = Array.from(
        new Set(dayRows.map((row) => row.stage_name.trim()).filter(Boolean))
      ).sort();
      const savedStageOrder = stageOrderByDay[dateToken] ?? [];
      const hiddenStageNames = hiddenStageNamesByDay[dateToken] ?? [];
      const stageNames = [
        ...savedStageOrder,
        ...defaultStageOrder.filter((stageName) => !savedStageOrder.includes(stageName)),
      ];

      return {
        key: dateToken,
        label: dateToken === '__undated__' ? '날짜 미정' : `Day ${index + 1}`,
        date: dateToken === '__undated__' ? '날짜 미정' : dateToken,
        unscheduledRows,
        hiddenStages: hiddenStageNames,
        stages: stageNames.map((stageToken) => ({
          key: `${dateToken}::${stageToken}`,
          label: stageToken,
          rows: sortLineupGroupRows(
            dayRows.filter((row) => row.stage_name.trim() === stageToken)
          ),
        })),
      };
    });

  const adminDayItems = buildDayItems(
    Array.from(
      new Set([
        ...lineupBoardDays.map((day) => day.key),
        ...timetableRows.map((row) => getTimetableDayKey(row)),
        ...Object.keys(stageOrderByDay),
        ...Object.keys(hiddenStageNamesByDay),
        ...Object.keys(timelineSettingsByDay),
        ...getEventDayTokens(formData.start_date, formData.end_date || formData.start_date),
      ])
    )
  );
  const defaultAdminDayKey =
    adminDayItems.find((day) => day.key !== '__undated__')?.key ??
    adminDayItems[0]?.key ??
    '';
  const datedAdminDayItems = adminDayItems.filter((day) => day.key !== '__undated__');
  const lastDeletableDayKey =
    datedAdminDayItems.length > 1 ? datedAdminDayItems[datedAdminDayItems.length - 1]?.key ?? null : null;
  const activeLineupDayKey = selectedAdminDayBySection.lineup || defaultAdminDayKey;
  const activeTimetableDayKey = selectedAdminDayBySection.timetable || defaultAdminDayKey;
  const visibleLineupBoardDays = lineupBoardDays.filter((day) =>
    activeLineupDayKey ? day.key === activeLineupDayKey : true
  );
  const visibleTimetableRows = timetableRows
    .filter((row) => getTimetableDayKey(row) === activeTimetableDayKey)
    .slice()
    .sort((left, right) => {
      if (left.start_at && right.start_at && left.start_at !== right.start_at) {
        return left.start_at.localeCompare(right.start_at);
      }
      if (left.stage_name !== right.stage_name) {
        return left.stage_name.localeCompare(right.stage_name);
      }
      return left.artist_name.localeCompare(right.artist_name);
    });

  const getDayDeletionSummary = (dayKey: string) => {
    const lineupCount = lineupRows.filter(
      (row) => (row.performance_date || '__undated__') === dayKey && row.artist_name.trim()
    ).length;
    const timetableCount = timetableRows.filter((row) => getTimetableDayKey(row) === dayKey).length;
    const stageCount = (stageOrderByDay[dayKey] ?? []).length;
    const baselineSettings = getDefaultTimelineSettings(
      lineupRows.filter((row) => (row.performance_date || '__undated__') === dayKey)
    );
    const currentSettings = timelineSettingsByDay[dayKey];
    const hasCustomTimeline =
      Boolean(currentSettings) &&
      (
        currentSettings.startTime !== baselineSettings.startTime ||
        currentSettings.endTime !== baselineSettings.endTime
      );

    return {
      lineupCount,
      timetableCount,
      stageCount,
      hasCustomTimeline,
      hasAnyData: lineupCount > 0 || timetableCount > 0 || stageCount > 0 || hasCustomTimeline,
    };
  };

  useEffect(() => {
    setStageOrderByDay((current) => {
      const nextState = { ...current };
      let didChange = false;

      lineupBoardDays.forEach((day) => {
        const nextOrder = Array.from(new Set(day.stages.map((stage) => stage.label.trim()).filter(Boolean)));
        if (!current[day.key]) {
          nextState[day.key] = nextOrder;
          didChange = true;
          return;
        }

        const mergedOrder = [
          ...current[day.key].filter((stageKey) => nextOrder.includes(stageKey)),
          ...nextOrder.filter((stageKey) => !current[day.key].includes(stageKey)),
        ];

        if (mergedOrder.join('|') !== current[day.key].join('|')) {
          nextState[day.key] = mergedOrder;
          didChange = true;
        }
      });

      return didChange ? nextState : current;
    });
  }, [lineupBoardDays]);

  useEffect(() => {
    setTimelineSettingsByDay((current) => {
      const nextState = { ...current };
      let didChange = false;

      lineupBoardDays.forEach((day) => {
        const fallbackRows = boardLineupRows.filter((row) => (row.performance_date || '__undated__') === day.key);
        if (!current[day.key]) {
          nextState[day.key] = getDefaultTimelineSettings(fallbackRows);
          didChange = true;
        }
      });

      return didChange ? nextState : current;
    });
  }, [boardLineupRows, lineupBoardDays]);

  useEffect(() => {
    setSelectedAdminDayBySection((current) => {
      const nextSelection = {
        lineup: adminDayItems.some((day) => day.key === current.lineup) ? current.lineup : defaultAdminDayKey,
        timetable: adminDayItems.some((day) => day.key === current.timetable) ? current.timetable : defaultAdminDayKey,
      };

      if (
        nextSelection.lineup === current.lineup &&
        nextSelection.timetable === current.timetable
      ) {
        return current;
      }

      return nextSelection;
    });
  }, [adminDayItems, defaultAdminDayKey]);

  useEffect(() => {
    if (!selectedLineupClientId) return;

    const targetRow = lineupRows.find((row) => row.client_id === selectedLineupClientId);
    if (!targetRow) return;

    const targetDayKey = targetRow.performance_date || '__undated__';
    if (activeLineupDayKey && targetDayKey !== activeLineupDayKey) {
      setSelectedLineupClientId(null);
    }
  }, [activeLineupDayKey, lineupRows, selectedLineupClientId]);

  useEffect(() => {
    if (!resizeSession) return;

    const handleMouseMove = (event: MouseEvent) => {
      const deltaRows = Math.round((event.clientY - resizeSession.startY) / TIMELINE_ROW_HEIGHT_PX);

      const fallbackRows = lineupRows.filter((row) => (row.performance_date || '__undated__') === resizeSession.dayKey);
      const currentSettings = timelineSettingsByDay[resizeSession.dayKey] ?? getDefaultTimelineSettings(fallbackRows);
      const currentStartMinute = parseTimeToMinutes(currentSettings.startTime) ?? 10 * 60;
      const currentEndMinute = parseTimeToMinutes(currentSettings.endTime) ?? 22 * 60;

      if (resizeSession.edge === 'end') {
        const nextEndMinute = Math.max(
          resizeSession.baseStartMinutes + TIMELINE_INTERVAL_MINUTES,
          resizeSession.baseEndMinutes + deltaRows * TIMELINE_INTERVAL_MINUTES
        );
        const nextEndTime = formatMinutesToTime(nextEndMinute);

        updateLineupRow(resizeSession.clientId, { end_time: nextEndTime });

        if (nextEndMinute > currentEndMinute) {
          updateTimelineSettings(resizeSession.dayKey, { endTime: nextEndTime });
        }
        return;
      }

      const nextStartMinute = Math.min(
        resizeSession.baseEndMinutes - TIMELINE_INTERVAL_MINUTES,
        resizeSession.baseStartMinutes + deltaRows * TIMELINE_INTERVAL_MINUTES
      );
      const nextStartTime = formatMinutesToTime(nextStartMinute);

      updateLineupRow(resizeSession.clientId, { start_time: nextStartTime });

      if (nextStartMinute < currentStartMinute) {
        updateTimelineSettings(resizeSession.dayKey, { startTime: nextStartTime });
      }
    };

    const handleMouseUp = () => {
      setResizeSession(null);
      setMessage('블록 시간을 조정했습니다. 시작/종료 시간이 5분 단위로 바로 반영되었습니다.');
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizeSession, lineupRows, timelineSettingsByDay, updateTimelineSettings]);

  useEffect(() => {
    if (!messageState) return;

    const timeout = window.setTimeout(() => {
      setMessageState((current) => (current?.id === messageState.id ? null : current));
    }, 4200);

    return () => window.clearTimeout(timeout);
  }, [messageState]);

  useEffect(() => {
    setImportPreview(null);
    setImportQaComparison(null);
  }, [importTarget, importExtractedText]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const cookieOrder = readAdminSectionOrderCookie();
    const raw = window.localStorage.getItem(adminSectionStorageKey);
    const parsedSource = cookieOrder ?? (() => {
      if (!raw) return null;
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    })();

    if (!parsedSource) {
      hasLoadedSectionOrder.current = true;
      return;
    }

    try {
      if (!Array.isArray(parsedSource)) return;

      const validOrder = parsedSource.filter((item): item is AdminSection =>
        adminSectionConfigs.some((config) => config.id === item)
      );
      const mergedOrder = [
        ...validOrder,
        ...adminSectionConfigs.map((item) => item.id).filter((id) => !validOrder.includes(id)),
      ];

      if (mergedOrder.length > 0) {
        setSectionOrder(mergedOrder);
      }
    } catch (error) {
      console.warn('Failed to parse saved admin section order.', error);
    } finally {
      hasLoadedSectionOrder.current = true;
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!hasLoadedSectionOrder.current) return;
    window.localStorage.setItem(adminSectionStorageKey, JSON.stringify(sectionOrder));
    writeAdminSectionOrderCookie(sectionOrder);
  }, [sectionOrder]);

  useEffect(() => {
    return () => {
      if (importImagePreviewUrl) {
        URL.revokeObjectURL(importImagePreviewUrl);
      }
    };
  }, [importImagePreviewUrl]);

  const loadEvents = useCallback(async () => {
    try {
      const loadedEvents = await fetchEventsFromSource();
      setEvents(loadedEvents || []);
    } catch (error) {
      console.error('Error loading events:', error);
      setEvents(mockEvents);
      setMessage('이벤트 목록을 불러오는 중 오류가 발생했지만 seed 이벤트로 계속 확인할 수 있습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadEventDetail = useCallback(async (eventId: string) => {
    try {
      setLoadingRelated(true);
      const supabase = createClient();

      const [eventResponse, lineupResponse, timetableResponse, ticketResponse] = await Promise.all([
        supabase.from('events').select('*').eq('id', eventId).single(),
        supabase
          .from('event_artists')
          .select(`
            *,
            artists (
              id,
              name,
              name_en
            )
          `)
          .eq('event_id', eventId)
          .order('performance_date', { ascending: true })
          .order('display_order', { ascending: true }),
        supabase
          .from('schedule_slots')
          .select(`
            *,
            artists (
              id,
              name,
              name_en
            )
          `)
          .eq('event_id', eventId)
          .order('start_at', { ascending: true }),
        supabase
          .from('ticket_links')
          .select('*')
          .eq('event_id', eventId)
          .order('is_primary', { ascending: false })
          .order('opens_at', { ascending: true }),
      ]);

      if (eventResponse.error) throw eventResponse.error;
      if (lineupResponse.error) throw lineupResponse.error;
      if (timetableResponse.error) throw timetableResponse.error;
      if (ticketResponse.error) throw ticketResponse.error;
      let eventStageRows: EventStage[] = [];
      let eventBoardSettingRows: EventBoardSetting[] = [];
      try {
        const eventStagesResponse = await supabase
          .from('event_stages')
          .select('*')
          .eq('event_id', eventId)
          .order('performance_date', { ascending: true })
          .order('display_order', { ascending: true });

        if (eventStagesResponse.error) {
          console.warn('Error loading event stages:', eventStagesResponse.error);
        } else {
          eventStageRows = (eventStagesResponse.data as EventStage[]) ?? [];
        }
      } catch (error) {
        console.warn('event_stages query unavailable in admin, falling back to lineup metadata.', error);
      }
      try {
        const eventBoardSettingsResponse = await supabase
          .from('event_board_settings')
          .select('*')
          .eq('event_id', eventId)
          .order('day_key', { ascending: true });

        if (eventBoardSettingsResponse.error) {
          console.warn('Error loading event board settings:', eventBoardSettingsResponse.error);
        } else {
          eventBoardSettingRows = (eventBoardSettingsResponse.data as EventBoardSetting[]) ?? [];
        }
      } catch (error) {
        console.warn('event_board_settings query unavailable in admin, falling back to derived board settings.', error);
      }

      const performanceSlotByEventArtistId = new Map(
        (((timetableResponse.data as Array<Record<string, unknown>>) || []).filter(
          (row) => row.event_artist_id && row.slot_type === 'performance'
        )).map((row) => [String(row.event_artist_id), row])
      );

      const lineupPayloadRows = (lineupResponse.data as Array<Record<string, unknown>>) || [];
      const nextFormData = toEventFormState(eventResponse.data as Event);
      const nextLineupRows = lineupPayloadRows.map((row) => {
        const slot = performanceSlotByEventArtistId.get(String(row.id));
        const parsedNote = decodeLineupNote(row.note ? String(row.note) : '');

        return {
          client_id: createClientId(),
          id: String(row.id),
          artist_id: row.artist_id ? String(row.artist_id) : null,
          artist_name: String((row.artists as { name?: string } | null)?.name ?? ''),
          performance_date: row.performance_date ? String(row.performance_date) : '',
          stage_name: slot?.stage_name ? String(slot.stage_name) : (parsedNote.metadata.stageName ?? ''),
          start_time: slot?.start_at ? String(slot.start_at).slice(11, 16) : '',
          end_time: slot?.end_at ? String(slot.end_at).slice(11, 16) : '',
          display_order: row.display_order !== null && row.display_order !== undefined ? String(row.display_order) : '',
          role: (row.role as EventArtistRole) ?? 'lineup',
          is_headliner: Boolean(row.is_headliner),
          announcement_status: (row.announcement_status as EventArtistStatus) ?? 'confirmed',
          note: parsedNote.visibleNote,
        };
      });
      const nextTimetableRows = ((timetableResponse.data as Array<Record<string, unknown>>) || []).map((row) => ({
        client_id: createClientId(),
        id: String(row.id),
        artist_id: row.artist_id ? String(row.artist_id) : null,
        event_artist_id: row.event_artist_id ? String(row.event_artist_id) : null,
        artist_name: String((row.artists as { name?: string } | null)?.name ?? ''),
        stage_name: String(row.stage_name ?? ''),
        slot_type: (row.slot_type as ScheduleSlotType) ?? 'performance',
        start_at: toDateTimeLocalValue(String(row.start_at ?? '')),
        end_at: toDateTimeLocalValue(String(row.end_at ?? '')),
        title: row.title ? String(row.title) : '',
        is_cancelled: Boolean(row.is_cancelled),
        source: row.source ? String(row.source) : 'manual',
      }));
      const nextTicketRows = ((ticketResponse.data as Array<Record<string, unknown>>) || []).map((row) => ({
        client_id: createClientId(),
        id: String(row.id),
        provider_name: String(row.provider_name ?? ''),
        provider_code: row.provider_code ? String(row.provider_code) : '',
        url: String(row.url ?? ''),
        link_type: (row.link_type as TicketLinkType) ?? 'general',
        sales_status: (row.sales_status as TicketSalesStatus) ?? 'upcoming',
        opens_at: toDateTimeLocalValue(row.opens_at ? String(row.opens_at) : ''),
        ends_at: toDateTimeLocalValue(row.ends_at ? String(row.ends_at) : ''),
        price_note: row.price_note ? String(row.price_note) : '',
        is_primary: Boolean(row.is_primary),
      }));
      const nextStageOrderByDay =
        eventStageRows.length > 0
          ? buildStageOrderByDayFromEventStagesPayload(eventStageRows)
          : buildStageOrderByDayFromLineupPayload(lineupPayloadRows);
      const nextHiddenStageNamesByDay =
        eventStageRows.length > 0
          ? buildHiddenStageNamesByDayFromEventStagesPayload(eventStageRows)
          : {};
      const persistedTimelineSettingsByDay = eventBoardSettingRows.reduce<Record<string, TimelineDaySettings>>((result, row) => {
        result[row.day_key] = {
          startTime: row.visible_start_time,
          endTime: row.visible_end_time,
          intervalMinutes: row.interval_minutes || TIMELINE_INTERVAL_MINUTES,
        };
        return result;
      }, {});
      const nextTimelineSettingsByDay = deriveTimelineSettingsMap(
        nextLineupRows,
        nextFormData.start_date,
        nextFormData.end_date,
        nextStageOrderByDay,
        persistedTimelineSettingsByDay
      );

      setFormData(nextFormData);
      activeUndoInputSessionRef.current = null;
      setLineupRows(nextLineupRows);
      setStageOrderByDay(nextStageOrderByDay);
      setHiddenStageNamesByDay(nextHiddenStageNamesByDay);
      setTimelineSettingsByDay(nextTimelineSettingsByDay);
      setTimetableRows(nextTimetableRows);
      setTicketRows(nextTicketRows);
      setEditorUndoStack([]);
      setEditorRedoStack([]);

      const lineupSavedAt = [
        ...lineupPayloadRows.map((row) => String(row.updated_at ?? '')).filter(Boolean),
        ...eventStageRows.map((row) => row.updated_at).filter(Boolean),
        ...eventBoardSettingRows.map((row) => row.updated_at).filter(Boolean),
      ].sort().at(-1) ?? null;
      const timetableSavedAt = ((timetableResponse.data as Array<Record<string, unknown>>) || [])
        .map((row) => String(row.updated_at ?? ''))
        .filter(Boolean)
        .sort()
        .at(-1) ?? null;
      const ticketSavedAt = ((ticketResponse.data as Array<Record<string, unknown>>) || [])
        .map((row) => String(row.updated_at ?? ''))
        .filter(Boolean)
        .sort()
        .at(-1) ?? null;

      setSavedSectionSignatures({
        event: serializeEventFormState(nextFormData),
        imports: createEmptySectionSignatures().imports,
        lineup: serializeLineupState(nextLineupRows, nextStageOrderByDay, nextHiddenStageNamesByDay, nextTimelineSettingsByDay),
        timetable: serializeTimetableState(nextTimetableRows),
        tickets: serializeTicketState(nextTicketRows),
      });
      setLastSavedAtBySection({
        event: (eventResponse.data as Event).updated_at ?? null,
        imports: null,
        lineup: lineupSavedAt,
        timetable: timetableSavedAt,
        tickets: ticketSavedAt,
      });
    } catch (error) {
      console.error('Error loading event detail:', error);
      setMessage('이벤트 상세 관리 데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoadingRelated(false);
    }
  }, []);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    if (!isEditorOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return;

      const key = event.key.toLowerCase();
      const shouldRedo = key === 'y' || (key === 'z' && event.shiftKey);
      const shouldUndo = key === 'z' && !event.shiftKey;

      if (shouldUndo) {
        if (editorUndoStack.length === 0) return;
        event.preventDefault();
        handleUndoEditor();
        return;
      }

      if (shouldRedo) {
        if (editorRedoStack.length === 0) return;
        event.preventDefault();
        handleRedoEditor();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editorRedoStack.length, editorUndoStack.length, handleRedoEditor, handleUndoEditor, isEditorOpen]);

  useEffect(() => {
    if (!selectedEventId) {
      if (localDraftSourceId) {
        return;
      }

      activeUndoInputSessionRef.current = null;
      setLineupRows([]);
      setTimetableRows([]);
      setTicketRows([]);
      setStageOrderByDay({});
      setHiddenStageNamesByDay({});
      setTimelineSettingsByDay({});
      setEditorUndoStack([]);
      setEditorRedoStack([]);
      setSavedSectionSignatures(createEmptySectionSignatures());
      setLastSavedAtBySection({});
      return;
    }

    const loadedMockEvent = applyMockEventDetailToEditor(
      selectedEventId,
      setFormData,
      setLineupRows,
      setTimetableRows,
      setTicketRows,
      setStageOrderByDay,
      setHiddenStageNamesByDay,
      setTimelineSettingsByDay,
      setSavedSectionSignatures,
      setLastSavedAtBySection
    );

    if (loadedMockEvent) {
      setLocalDraftSourceId(null);
      activeUndoInputSessionRef.current = null;
      setEditorUndoStack([]);
      setEditorRedoStack([]);
      return;
    }

    setLocalDraftSourceId(null);
    void loadEventDetail(selectedEventId);
  }, [loadEventDetail, localDraftSourceId, selectedEventId]);

  const handleEventChange = (field: keyof EventFormState) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setFormData((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const startCreateEvent = (eventType: EventType) => {
    const nextFormData = { ...initialEventState, event_type: eventType };
    activeUndoInputSessionRef.current = null;
    setSelectedEventId(null);
    setLocalDraftSourceId(null);
    setDraftSourceLinks([]);
    setFormData(nextFormData);
    setLineupRows([]);
    setTimetableRows([]);
    setTicketRows([]);
    setStageOrderByDay({});
    setHiddenStageNamesByDay({});
    setTimelineSettingsByDay({});
    setPendingDayDeletion(null);
    cancelStageRename();
    setEditorUndoStack([]);
    setEditorRedoStack([]);
    setSavedSectionSignatures({
      ...createEmptySectionSignatures(),
      event: serializeEventFormState(nextFormData),
    });
    setLastSavedAtBySection({});
    setMessage(`${eventType === 'festival' ? '페스티벌' : '콘서트'} 등록 모드입니다.`);
    setActiveSection('event');
    setIsEditorOpen(true);
  };

  const loadFestivalMacroDraft = (eventId: string) => {
    const sourceEvent = mockEvents.find((event) => event.id === eventId);
    const sourceContent = festivalContent[eventId];
    const timetablePlaybook = getImportPlaybook(eventId, 'timetable');

    if (!sourceEvent || !sourceContent) {
      setMessage('매크로 초안 데이터를 찾지 못했습니다.');
      return;
    }

    const nextFormData = toEventFormState(sourceEvent);
    const nextLineupRows = buildLineupRowsFromFestivalContent(sourceContent);
    const nextTimetableRows = buildTimetableRowsFromFestivalContent(sourceContent);
    const nextTicketRows = buildTicketRowsFromFestivalContent(sourceContent);
    const nextTimelineSettings = deriveTimelineSettingsMap(
      nextLineupRows,
      nextFormData.start_date,
      nextFormData.end_date,
      {}
    );

    activeUndoInputSessionRef.current = null;
    setSelectedEventId(null);
    setLocalDraftSourceId(eventId);
    setDraftSourceLinks(sourceContent.sources.map((source) => ({ label: source.label, url: source.url })));
    setFormData(nextFormData);
    setLineupRows(nextLineupRows);
    setTimetableRows(nextTimetableRows);
    setTicketRows(nextTicketRows);
    setStageOrderByDay({});
    setHiddenStageNamesByDay({});
    setTimelineSettingsByDay(nextTimelineSettings);
    setPendingDayDeletion(null);
    cancelStageRename();
    setEditorUndoStack([]);
    setEditorRedoStack([]);
    setSavedSectionSignatures({
      ...createEmptySectionSignatures(),
      event: serializeEventFormState(nextFormData),
      lineup: serializeLineupState(nextLineupRows, {}, {}, nextTimelineSettings),
      timetable: serializeTimetableState(nextTimetableRows),
      tickets: serializeTicketState(nextTicketRows),
    });
    setLastSavedAtBySection({});
    setImportTarget(timetablePlaybook ? 'timetable' : 'lineup');
    setActiveSection(timetablePlaybook ? 'imports' : 'event');
    setIsEditorOpen(true);
    setMessage(
      timetablePlaybook
        ? `${sourceEvent.title} 매크로 초안을 불러왔습니다. Import Workspace에서 공식 타임테이블 이미지를 기준으로 OCR/TSV 검수를 이어가세요.`
        : `${sourceEvent.title} 매크로 초안을 불러왔습니다. Event Basics와 라인업/티켓 섹션을 검수한 뒤 저장하세요.`
    );
  };

  const startGenericFestivalMacro = () => {
    const trimmedName = macroFestivalName.trim();
    if (!trimmedName) {
      setMessage('먼저 페스티벌 이름을 입력해주세요.');
      return;
    }

    const matchedFestivalKey = getFestivalContentKey(trimmedName);
    if (matchedFestivalKey && festivalContent[matchedFestivalKey]) {
      loadFestivalMacroDraft(matchedFestivalKey);
      setMessage(`${trimmedName}과 일치하는 기존 seed 매크로를 열었습니다. 바로 검수를 이어가세요.`);
      return;
    }

    const generatedId = createGeneratedFestivalDraftId(trimmedName);
    const nextFormData: EventFormState = {
      ...initialEventState,
      title: trimmedName,
      description: `${trimmedName} 공개 정보 수집을 시작하는 운영 초안입니다. 공식 홈페이지, 티켓 페이지, 라인업 이미지, 타임테이블 이미지를 기준으로 검수 후 확정합니다.`,
      event_type: 'festival',
      genre: 'festival',
      ticket_url: macroTicketUrl.trim(),
      artist_profile: '공식 링크와 이미지 OCR 결과를 검수해 lineup/timetable/ticket 데이터를 채우는 intake draft입니다.',
    };

    const nextTicketRows: TicketEditorRow[] = macroTicketUrl.trim()
      ? [
          {
            client_id: createClientId(),
            id: null,
            provider_name: 'Official Ticket',
            provider_code: '',
            url: macroTicketUrl.trim(),
            link_type: 'official_info',
            sales_status: 'upcoming',
            opens_at: '',
            ends_at: '',
            price_note: '매크로 초안에서 입력한 티켓 링크',
            is_primary: true,
          },
        ]
      : [];

    activeUndoInputSessionRef.current = null;
    setSelectedEventId(null);
    setLocalDraftSourceId(generatedId);
    setDraftSourceLinks(
      [
        macroOfficialUrl.trim() ? { label: 'Official Website', url: macroOfficialUrl.trim() } : null,
        macroTicketUrl.trim() ? { label: 'Ticket Page', url: macroTicketUrl.trim() } : null,
      ].filter((link): link is ImportPlaybookSourceLink => Boolean(link))
    );
    setFormData(nextFormData);
    setLineupRows([]);
    setTimetableRows([]);
    setTicketRows(nextTicketRows);
    setStageOrderByDay({});
    setHiddenStageNamesByDay({});
    setTimelineSettingsByDay({});
    setPendingDayDeletion(null);
    cancelStageRename();
    setEditorUndoStack([]);
    setEditorRedoStack([]);
    setSavedSectionSignatures({
      ...createEmptySectionSignatures(),
      event: serializeEventFormState(nextFormData),
      tickets: serializeTicketState(nextTicketRows),
    });
    setLastSavedAtBySection({});
    setImportTarget('lineup');
    setActiveSection('imports');
    setImportExtractedText('');
    setImportPreview(null);
    setImportQaComparison(null);
    setIsEditorOpen(true);
    setMessage(
      `${trimmedName} intake 매크로를 시작했습니다. Import Workspace에서 공식 링크를 바탕으로 lineup/timetable TSV를 채워주세요.`
    );
  };

  const closeEditor = () => {
    activeUndoInputSessionRef.current = null;
    setIsEditorOpen(false);
    setLocalDraftSourceId(null);
    setDraftSourceLinks([]);
    setMessage('');
    setEditorUndoStack([]);
    setEditorRedoStack([]);
    setPendingDayDeletion(null);
    setSelectedLineupClientId(null);
    setImportPreview(null);
    cancelStageRename();
  };

  const normalizeImportedTimeValue = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return '';

    const normalized = trimmed.replace(/\s+/g, '').replace(/[–—~]/g, '-');
    const timeMatch = normalized.match(/(\d{1,2})(?::|\.|시)(\d{2})(?:분)?/);
    if (timeMatch) {
      return `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`;
    }

    const compactMatch = normalized.match(/^(\d{1,2})(\d{2})$/);
    if (compactMatch) {
      return `${compactMatch[1].padStart(2, '0')}:${compactMatch[2]}`;
    }

    return '';
  };

  const normalizeImportedDateValue = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return '';

    const fullDateMatch = trimmed.match(/(20\d{2})[./-](\d{1,2})[./-](\d{1,2})/);
    if (fullDateMatch) {
      const [, year, month, day] = fullDateMatch;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    const monthDayMatch = trimmed.match(/(?:^|[^0-9])(\d{1,2})[./-](\d{1,2})(?:[^0-9]|$)/);
    if (monthDayMatch) {
      const year = eventDayTokens[0]?.slice(0, 4) || formData.start_date.slice(0, 4);
      const [, month, day] = monthDayMatch;
      if (year) {
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
    }

    const dayIndexMatch = trimmed.match(/(?:day|d)\s*([1-9]\d*)/i) ?? trimmed.match(/([1-9]\d*)\s*일차/);
    if (dayIndexMatch) {
      const dayIndex = Number(dayIndexMatch[1]) - 1;
      return eventDayTokens[dayIndex] ?? '';
    }

    return '';
  };

  const extractImportedTimeRange = (record: Record<string, string>) => {
    const directStart = normalizeImportedTimeValue(record.start || record.start_at || '');
    const directEnd = normalizeImportedTimeValue(record.end || record.end_at || '');

    if (directStart || directEnd) {
      return { start: directStart, end: directEnd };
    }

    const combined = (record.time || record.time_range || record.slot || record.schedule || '').trim();
    if (!combined) {
      return { start: '', end: '' };
    }

    const timeToken = '(?:\\d{1,2}(?::|\\.)\\d{2}|\\d{1,2}시\\d{2}분?|\\d{3,4})';
    const rangeMatch = combined.match(
      new RegExp(`(${timeToken})\\s*(?:~|〜|–|—|-|to|부터)\\s*(${timeToken})(?:까지)?`, 'i')
    );
    if (!rangeMatch) {
      return { start: '', end: '' };
    }

    return {
      start: normalizeImportedTimeValue(rangeMatch[1]),
      end: normalizeImportedTimeValue(rangeMatch[2]),
    };
  };

  const copyImportVisionPrompt = async () => {
    const prompt =
      activeImportPlaybook?.visionPrompt ??
      (formData.title.trim() ? buildGenericImportVisionPrompt(formData.title, importTarget) : '');

    if (!prompt) {
      setMessage('현재 선택한 이벤트/대상에 연결된 OCR 플레이북이 없습니다.');
      return;
    }

    try {
      await navigator.clipboard.writeText(prompt);
      setMessage('Vision/OCR 프롬프트를 클립보드에 복사했습니다.');
    } catch (error) {
      console.error('Failed to copy vision prompt:', error);
      setMessage('클립보드 복사에 실패했습니다. 아래 플레이북 프롬프트를 직접 복사해주세요.');
    }
  };

  const fillImportOutputHeader = () => {
    const header =
      activeImportPlaybook?.outputHeader ??
      (importTarget === 'lineup'
        ? 'date\tartist\torder\trole\theadliner\tstatus\tnote'
        : 'date\tstage\tartist\tstart\tend\ttitle\tsource');

    if (!header) {
      setMessage('현재 선택한 이벤트/대상에 연결된 import 헤더가 없습니다.');
      return;
    }

    setImportExtractedText(header);
    setImportQaComparison(null);
    setMessage('TSV 헤더를 채웠습니다. OCR/Vision 결과를 같은 컬럼 순서로 붙여넣으세요.');
  };

  const fillImportSampleOutput = (playbook: ImportPlaybook) => {
    if (!playbook.sampleOutput) {
      setMessage('현재 선택한 플레이북에는 샘플 출력이 준비되어 있지 않습니다.');
      return;
    }

    setImportExtractedText(playbook.sampleOutput);
    setImportQaComparison(null);
    setMessage('공식 TSV 샘플을 채웠습니다. 미리보기 후 timetable 편집기로 바로 반영할 수 있습니다.');
  };

  const parseImportedLineupText = (text: string) => {
    const parsed = parseTableText(text);
    if (parsed.length === 0) {
      return null;
    }

    return parsed.map((record) => ({
      client_id: createClientId(),
      id: null,
      artist_id: null,
      artist_name: record.artist || record.name || '',
      performance_date: normalizeImportedDateValue(record.date || record.day || record.performance_date || ''),
      stage_name: record.stage || record.stage_name || '',
      start_time: normalizeImportedTimeValue(record.start || record.start_time || ''),
      end_time: normalizeImportedTimeValue(record.end || record.end_time || ''),
      display_order: record.order || record.display_order || '',
      role: ((record.role || 'lineup') as EventArtistRole),
      is_headliner: parseBooleanCell(record.headliner || record.is_headliner || ''),
      announcement_status: ((record.status || record.announcement_status || 'confirmed') as EventArtistStatus),
      note: record.note || '',
    }));
  };

  const applyImportedLineupRows = (nextRows: LineupEditorRow[]) => {
    if (nextRows.length === 0) {
      setMessage('라인업 import 텍스트를 확인해주세요.');
      return false;
    }

    pushEditorUndoSnapshot();
    setLineupRows((current) => [...current, ...nextRows]);
    setLineupImportText('');
    setImportPreview(null);
    setImportQaComparison(null);
    setMessage(`${nextRows.length}개의 라인업 행을 가져왔습니다. 저장 버튼을 눌러 DB에 반영하세요.`);
    return true;
  };

  const parseImportedTimetableText = (text: string) => {
    const parsed = parseTableText(text);
    if (parsed.length === 0) {
      return null;
    }

    return parsed.map((record) => {
      const date = normalizeImportedDateValue(record.date || record.day || record.performance_date || '');
      const { start: normalizedStart, end: normalizedEnd } = extractImportedTimeRange(record);
      const start = combineDateAndTime(date, normalizedStart);
      const end = combineDateAndTime(date, normalizedEnd);

      return {
        client_id: createClientId(),
        id: null,
        artist_id: null,
        event_artist_id: null,
        artist_name: record.artist || record.artist_name || record.name || '',
        stage_name: record.stage || record.stage_name || '',
        slot_type: ((record.slot_type || 'performance') as ScheduleSlotType),
        start_at: start,
        end_at: end,
        title: record.title || record.note || '',
        is_cancelled: parseBooleanCell(record.is_cancelled || ''),
        source: record.source || 'manual',
      };
    });
  };

  const getTimetableComparisonKey = (row: TimetableEditorRow) => {
    const dayKey = row.start_at ? row.start_at.slice(0, 10) : '__undated__';
    const identity = normalizeSlug(row.artist_name || row.title || 'untitled-slot');
    return `${dayKey}::${row.stage_name.trim()}::${identity}::${row.slot_type}`;
  };

  const buildTimetableImportQaComparison = (
    actualRows: TimetableEditorRow[],
    playbook: ImportPlaybook
  ): ImportQaComparisonState | null => {
    if (!playbook.sampleOutput) {
      return null;
    }

    const expectedRows = parseImportedTimetableText(playbook.sampleOutput);
    if (!expectedRows) {
      return null;
    }

    const actualByKey = new Map(actualRows.map((row) => [getTimetableComparisonKey(row), row]));
    const expectedByKey = new Map(expectedRows.map((row) => [getTimetableComparisonKey(row), row]));
    const items: ImportQaComparisonItem[] = [];

    expectedRows.forEach((expectedRow) => {
      const key = getTimetableComparisonKey(expectedRow);
      const actualRow = actualByKey.get(key);
      const dayKey = expectedRow.start_at ? expectedRow.start_at.slice(0, 10) : '날짜 미정';

      if (!actualRow) {
        items.push({
          key,
          title: expectedRow.artist_name || expectedRow.title || 'Untitled Slot',
          subtitle: `${dayKey} · ${expectedRow.stage_name || 'Stage TBD'}`,
          status: 'missing',
          details: ['OCR 결과에서 이 행이 빠졌습니다.'],
        });
        return;
      }

      const details: string[] = [];
      if ((expectedRow.start_at || '') !== (actualRow.start_at || '')) {
        details.push(`start: ${expectedRow.start_at || '-'} -> ${actualRow.start_at || '-'}`);
      }
      if ((expectedRow.end_at || '') !== (actualRow.end_at || '')) {
        details.push(`end: ${expectedRow.end_at || '-'} -> ${actualRow.end_at || '-'}`);
      }
      if ((expectedRow.stage_name || '') !== (actualRow.stage_name || '')) {
        details.push(`stage: ${expectedRow.stage_name || '-'} -> ${actualRow.stage_name || '-'}`);
      }
      if ((expectedRow.title || '') !== (actualRow.title || '')) {
        details.push(`title: ${expectedRow.title || '-'} -> ${actualRow.title || '-'}`);
      }

      items.push({
        key,
        title: expectedRow.artist_name || expectedRow.title || 'Untitled Slot',
        subtitle: `${dayKey} · ${expectedRow.stage_name || 'Stage TBD'}`,
        status: details.length > 0 ? 'mismatch' : 'exact',
        details: details.length > 0 ? details : ['공식 TSV 샘플과 일치합니다.'],
      });
    });

    actualRows.forEach((actualRow) => {
      const key = getTimetableComparisonKey(actualRow);
      if (expectedByKey.has(key)) {
        return;
      }

      const dayKey = actualRow.start_at ? actualRow.start_at.slice(0, 10) : '날짜 미정';
      items.push({
        key,
        title: actualRow.artist_name || actualRow.title || 'Untitled Slot',
        subtitle: `${dayKey} · ${actualRow.stage_name || 'Stage TBD'}`,
        status: 'extra',
        details: ['공식 TSV 샘플에는 없는 추가 행입니다. OCR 결과를 다시 확인하세요.'],
      });
    });

    return {
      target: 'timetable',
      expectedCount: expectedRows.length,
      actualCount: actualRows.length,
      exact: items.filter((item) => item.status === 'exact').length,
      mismatched: items.filter((item) => item.status === 'mismatch').length,
      missing: items.filter((item) => item.status === 'missing').length,
      extra: items.filter((item) => item.status === 'extra').length,
      items,
    };
  };

  const applyImportedTimetableRows = (nextRows: TimetableEditorRow[]) => {
    if (nextRows.length === 0) {
      setMessage('타임테이블 import 텍스트를 확인해주세요.');
      return false;
    }

    pushEditorUndoSnapshot();
    setTimetableRows((current) => [...current, ...nextRows]);
    setTimetableImportText('');
    setImportPreview(null);
    setImportQaComparison(null);
    setMessage(`${nextRows.length}개의 타임테이블 행을 가져왔습니다. 저장 버튼을 눌러 DB에 반영하세요.`);
    return true;
  };

  const buildLineupImportPreview = (nextRows: LineupEditorRow[]): ImportPreviewState => {
    const currentByKey = new Map(
      lineupRows.map((row) => [
        `${row.performance_date || '__undated__'}::${normalizeSlug(row.artist_name)}`,
        row,
      ])
    );

    const items = nextRows.map((row) => {
      const key = `${row.performance_date || '__undated__'}::${normalizeSlug(row.artist_name)}`;
      const current = currentByKey.get(key);
      const changes: string[] = [];

      if (current) {
        if ((current.stage_name || '') !== (row.stage_name || '')) changes.push(`stage: ${current.stage_name || '-'} -> ${row.stage_name || '-'}`);
        if ((current.start_time || '') !== (row.start_time || '')) changes.push(`start: ${current.start_time || '-'} -> ${row.start_time || '-'}`);
        if ((current.end_time || '') !== (row.end_time || '')) changes.push(`end: ${current.end_time || '-'} -> ${row.end_time || '-'}`);
        if ((current.display_order || '') !== (row.display_order || '')) changes.push(`order: ${current.display_order || '-'} -> ${row.display_order || '-'}`);
      }

      return {
        key,
        title: row.artist_name || 'Untitled Artist',
        subtitle: `${row.performance_date || '날짜 미정'} · ${row.stage_name || 'Stage TBD'}`,
        status: current ? (changes.length > 0 ? 'update' : 'unchanged') : 'new',
        changes,
      } satisfies ImportPreviewItem;
    });

    return {
      target: 'lineup',
      items,
      added: items.filter((item) => item.status === 'new').length,
      updated: items.filter((item) => item.status === 'update').length,
      unchanged: items.filter((item) => item.status === 'unchanged').length,
      rowCount: items.length,
    };
  };

  const buildTimetableImportPreview = (nextRows: TimetableEditorRow[]): ImportPreviewState => {
    const currentByKey = new Map(
      timetableRows.map((row) => [
        `${row.start_at.slice(0, 10) || '__undated__'}::${row.stage_name}::${normalizeSlug(row.artist_name)}::${row.slot_type}`,
        row,
      ])
    );

    const items = nextRows.map((row) => {
      const dayKey = row.start_at ? row.start_at.slice(0, 10) : '__undated__';
      const key = `${dayKey}::${row.stage_name}::${normalizeSlug(row.artist_name)}::${row.slot_type}`;
      const current = currentByKey.get(key);
      const changes: string[] = [];

      if (current) {
        if ((current.start_at || '') !== (row.start_at || '')) changes.push(`start: ${current.start_at || '-'} -> ${row.start_at || '-'}`);
        if ((current.end_at || '') !== (row.end_at || '')) changes.push(`end: ${current.end_at || '-'} -> ${row.end_at || '-'}`);
        if ((current.title || '') !== (row.title || '')) changes.push(`title: ${current.title || '-'} -> ${row.title || '-'}`);
      }

      return {
        key,
        title: row.artist_name || row.title || 'Untitled Slot',
        subtitle: `${dayKey === '__undated__' ? '날짜 미정' : dayKey} · ${row.stage_name || 'Stage TBD'}`,
        status: current ? (changes.length > 0 ? 'update' : 'unchanged') : 'new',
        changes,
      } satisfies ImportPreviewItem;
    });

    return {
      target: 'timetable',
      items,
      added: items.filter((item) => item.status === 'new').length,
      updated: items.filter((item) => item.status === 'update').length,
      unchanged: items.filter((item) => item.status === 'unchanged').length,
      rowCount: items.length,
    };
  };

  const buildImportPreview = () => {
    const text = importExtractedText.trim();
    if (!text) {
      setMessage('추출 결과 텍스트를 먼저 입력해주세요.');
      return;
    }

    if (importTarget === 'lineup') {
      const nextRows = parseImportedLineupText(text);
      if (!nextRows) {
        setMessage('라인업 import 텍스트를 확인해주세요.');
        return;
      }
      setImportPreview(buildLineupImportPreview(nextRows));
      setImportQaComparison(null);
      return;
    }

    const nextRows = parseImportedTimetableText(text);
    if (!nextRows) {
      setMessage('타임테이블 import 텍스트를 확인해주세요.');
      return;
    }
    setImportPreview(buildTimetableImportPreview(nextRows));
    setImportQaComparison(
      activeImportPlaybook?.target === 'timetable'
        ? buildTimetableImportQaComparison(nextRows, activeImportPlaybook)
        : null
    );
  };

  const handleImportImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (importImagePreviewUrl) {
      URL.revokeObjectURL(importImagePreviewUrl);
    }

    const previewUrl = URL.createObjectURL(file);
    setImportImagePreviewUrl(previewUrl);
    setImportImageName(file.name);
    setImportPreview(null);
    setImportQaComparison(null);
    setMessage('이미지 미리보기를 불러왔습니다. OCR 또는 LLM 추출 결과를 아래 텍스트 영역에 붙여넣어 검수하세요.');
  };

  const applyImportWorkspace = () => {
    const text = importExtractedText.trim();
    if (!text) {
      setMessage('추출 결과 텍스트를 먼저 입력해주세요.');
      return;
    }

    const didImport =
      importTarget === 'lineup'
        ? applyImportedLineupRows(parseImportedLineupText(text) ?? [])
        : applyImportedTimetableRows(parseImportedTimetableText(text) ?? []);

    if (!didImport) return;

    setActiveSection(importTarget);
    setImportExtractedText('');
    setImportQaComparison(null);
  };

  const handleSaveEvent = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isSupabaseReady) {
      setMessage('Supabase 설정을 완료하면 관리자 등록 기능을 사용할 수 있습니다.');
      return;
    }

    try {
      setIsSavingEvent(true);
      setMessage('');
      const supabase = createClient();
      const payload = {
        title: formData.title,
        artist: formData.artist,
        description: formData.description,
        start_date: formData.start_date,
        end_date: formData.end_date,
        venue: formData.venue,
        venue_address: formData.venue_address || null,
        venue_lat: formData.venue_lat ? Number(formData.venue_lat) : null,
        venue_lng: formData.venue_lng ? Number(formData.venue_lng) : null,
        genre: formData.genre,
        event_type: formData.event_type,
        image_url: formData.image_url || null,
        price_range: formData.price_range || null,
        ticket_url: formData.ticket_url || null,
        ticket_open_time: formData.ticket_open_time || null,
        age_limit: formData.age_limit || null,
        artist_profile: formData.artist_profile || null,
      };

      if (selectedEventId) {
        const { error } = await supabase.from('events').update(payload).eq('id', selectedEventId);
        if (error) throw error;
        setMessage('이벤트 기본 정보가 수정되었습니다.');
        await loadEventDetail(selectedEventId);
      } else {
        const { data, error } = await supabase.from('events').insert(payload).select('*').single();
        if (error) throw error;
        setSelectedEventId((data as Event).id);
        setMessage('새 이벤트가 등록되었습니다. 이제 lineup/timetable/ticket link를 입력할 수 있습니다.');
        await loadEventDetail((data as Event).id);
      }

      await loadEvents();
      updateSavedSections(
        { event: currentSectionSignatures.event },
        { event: new Date().toISOString() }
      );
    } catch (error) {
      console.error('Error saving event:', error);
      setMessage('이벤트 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSavingEvent(false);
    }
  };

  const ensureArtistId = async (name: string, artistType: ArtistType = 'other') => {
    const trimmedName = name.trim();
    if (!trimmedName) return null;

    const supabase = createClient();
    const slug = normalizeSlug(trimmedName) || `artist-${Date.now()}`;

    const { data: bySlug, error: bySlugError } = await supabase
      .from('artists')
      .select('id, name, slug')
      .eq('slug', slug)
      .maybeSingle();

    if (bySlugError) throw bySlugError;
    if (bySlug && bySlug.name === trimmedName) return String(bySlug.id);

    const { data: byName, error: byNameError } = await supabase
      .from('artists')
      .select('id, name')
      .eq('name', trimmedName)
      .maybeSingle();

    if (byNameError) throw byNameError;
    if (byName) return String(byName.id);

    const candidateSlug = bySlug ? `${slug}-${createClientId().slice(0, 6)}` : slug;
    const { data: inserted, error: insertError } = await supabase
      .from('artists')
      .insert({
        name: trimmedName,
        slug: candidateSlug,
        artist_type: artistType,
      })
      .select('id')
      .single();

    if (insertError) throw insertError;
    return String(inserted.id);
  };

  const ensureEventArtistId = async (
    eventId: string,
    artistId: string,
    row: LineupEditorRow | TimetableEditorRow,
    performanceDate: string | null
  ) => {
    const supabase = createClient();
    let query = supabase
      .from('event_artists')
      .select('id')
      .eq('event_id', eventId)
      .eq('artist_id', artistId);

    query = performanceDate
      ? query.eq('performance_date', performanceDate)
      : query.is('performance_date', null);

    const { data: existing, error: existingError } = await query.maybeSingle();
    if (existingError) throw existingError;
    if (existing) return String(existing.id);

    const payload = {
      event_id: eventId,
      artist_id: artistId,
      role: 'role' in row ? row.role : 'lineup',
      display_order:
        'display_order' in row && row.display_order
          ? Number(row.display_order)
          : null,
      is_headliner:
        'is_headliner' in row
          ? row.is_headliner
          : false,
      announcement_status:
        'announcement_status' in row
          ? row.announcement_status
          : 'confirmed',
      performance_date: performanceDate,
      note:
        'note' in row
          ? row.note || null
          : row.title || null,
    };

    const { data, error } = await supabase
      .from('event_artists')
      .insert(payload)
      .select('id')
      .single();

    if (error) throw error;
    return String(data.id);
  };

  const saveEventStages = async (eventId: string) => {
    const supabase = createClient();
    const visibleStageMap = new Map<string, string[]>();
    const hiddenStageMap = new Map<string, string[]>();

    Object.entries(stageOrderByDay).forEach(([dayKey, stageNames]) => {
      const cleanedStageNames = stageNames.map((stageName) => stageName.trim()).filter(Boolean);
      if (cleanedStageNames.length > 0) {
        visibleStageMap.set(dayKey, cleanedStageNames);
      }
    });

    Object.entries(hiddenStageNamesByDay).forEach(([dayKey, stageNames]) => {
      const cleanedStageNames = stageNames.map((stageName) => stageName.trim()).filter(Boolean);
      if (cleanedStageNames.length > 0) {
        hiddenStageMap.set(dayKey, cleanedStageNames);
      }
    });

    lineupRows.forEach((row) => {
      const stageName = row.stage_name.trim();
      if (!stageName) return;

      const dayKey = row.performance_date || '__undated__';
      const currentStages = visibleStageMap.get(dayKey) ?? [];
      if (!currentStages.includes(stageName)) {
        visibleStageMap.set(dayKey, [...currentStages, stageName]);
      }
    });

    timetableRows.forEach((row) => {
      const stageName = row.stage_name.trim();
      if (!stageName) return;

      const dayKey = row.start_at ? row.start_at.slice(0, 10) : '__undated__';
      const currentStages = visibleStageMap.get(dayKey) ?? [];
      if (!currentStages.includes(stageName)) {
        visibleStageMap.set(dayKey, [...currentStages, stageName]);
      }
    });

    const payload = [
      ...Array.from(visibleStageMap.entries()).flatMap(([dayKey, stageNames]) =>
        stageNames.map((stageName, index) => ({
          event_id: eventId,
          performance_date: dayKey === '__undated__' ? null : dayKey,
          stage_name: stageName,
          display_order: index + 1,
          is_hidden: false,
        }))
      ),
      ...Array.from(hiddenStageMap.entries()).flatMap(([dayKey, stageNames]) =>
        stageNames.map((stageName, index) => ({
          event_id: eventId,
          performance_date: dayKey === '__undated__' ? null : dayKey,
          stage_name: stageName,
          display_order: (visibleStageMap.get(dayKey)?.length ?? 0) + index + 1,
          is_hidden: true,
        }))
      ),
    ].map((row) => ({
      ...row,
      stage_name: row.stage_name.trim(),
    })).filter((row, index, rows) =>
      rows.findIndex(
        (candidate) =>
          candidate.performance_date === row.performance_date &&
          candidate.stage_name === row.stage_name
      ) === index
    );

    try {
      const { error: deleteError } = await supabase.from('event_stages').delete().eq('event_id', eventId);
      if (deleteError) {
        throw deleteError;
      }

      if (payload.length === 0) {
        return;
      }

      const { error: insertError } = await supabase.from('event_stages').insert(payload);
      if (insertError) {
        throw insertError;
      }
    } catch (error) {
      console.warn('event_stages table unavailable, keeping stage metadata fallback only.', error);
    }
  };

  const saveEventBoardSettings = async (eventId: string) => {
    const supabase = createClient();
    const payload = Object.entries(timelineSettingsByDay).map(([dayKey, settings]) => ({
      event_id: eventId,
      day_key: dayKey,
      visible_start_time: settings.startTime,
      visible_end_time: settings.endTime,
      interval_minutes: TIMELINE_INTERVAL_MINUTES,
    }));

    try {
      const { error: deleteError } = await supabase.from('event_board_settings').delete().eq('event_id', eventId);
      if (deleteError) throw deleteError;

      if (payload.length === 0) {
        return;
      }

      const { error: insertError } = await supabase.from('event_board_settings').insert(payload);
      if (insertError) throw insertError;
    } catch (error) {
      console.warn('event_board_settings table unavailable, keeping derived board settings only.', error);
    }
  };

  const saveLineupRows = async () => {
    if (!selectedEventId) {
      setMessage('먼저 이벤트 기본 정보를 저장해주세요.');
      return;
    }

    try {
      setIsSavingLineup(true);
      setMessage('');
      const supabase = createClient();
      const { derivedOrderMap, mismatchMap } = buildLineupOrderingState(lineupRows);

      for (const row of lineupRows) {
        if (!row.artist_name.trim()) continue;

        const artistId = await ensureArtistId(row.artist_name);
        if (!artistId) continue;

        const dateKey = row.performance_date || '__undated__';
        const normalizedStageName = row.stage_name.trim() || null;
        const stageOrder = stageOrderByDay[dateKey] ?? [];
        const stageOrderIndex = normalizedStageName
          ? stageOrder.findIndex((stageName) => stageName === normalizedStageName)
          : -1;
        const stagePosition = normalizedStageName && stageOrderIndex >= 0
          ? stageOrderIndex + 1
          : null;
        const payload = {
          event_id: selectedEventId,
          artist_id: artistId,
          role: row.role,
          display_order: derivedOrderMap.has(row.client_id)
            ? (derivedOrderMap.get(row.client_id) ?? null)
            : (row.display_order ? Number(row.display_order) : null),
          is_headliner: row.is_headliner,
          announcement_status: row.announcement_status,
          performance_date: row.performance_date || null,
          note: encodeLineupNote(row.note, {
            stageName: normalizedStageName,
            stagePosition,
          }),
        };

        let eventArtistId = row.id;
        if (row.id) {
          const { error } = await supabase.from('event_artists').update(payload).eq('id', row.id);
          if (error) throw error;
        } else {
          const { data, error } = await supabase.from('event_artists').insert(payload).select('id').single();
          if (error) throw error;
          eventArtistId = String(data.id);
        }

        const existingSlotResponse = eventArtistId
          ? await supabase
              .from('schedule_slots')
              .select('id')
              .eq('event_artist_id', eventArtistId)
              .eq('slot_type', 'performance')
              .maybeSingle()
          : { data: null, error: null };

        if (existingSlotResponse.error) throw existingSlotResponse.error;

        const hasPerformanceTiming =
          Boolean(row.performance_date) &&
          Boolean(row.stage_name.trim()) &&
          Boolean(row.start_time.trim()) &&
          Boolean(row.end_time.trim());

        if (hasPerformanceTiming && eventArtistId) {
          const slotPayload = {
            event_id: selectedEventId,
            artist_id: artistId,
            event_artist_id: eventArtistId,
            stage_name: row.stage_name.trim(),
            slot_type: 'performance' as const,
            title: row.note || null,
            start_at: combineDateAndTime(row.performance_date, row.start_time),
            end_at: combineDateAndTime(row.performance_date, row.end_time),
            is_cancelled: false,
            source: 'lineup-manager',
          };

          if (existingSlotResponse.data?.id) {
            const { error } = await supabase.from('schedule_slots').update(slotPayload).eq('id', existingSlotResponse.data.id);
            if (error) throw error;
          } else {
            const { error } = await supabase.from('schedule_slots').insert(slotPayload);
            if (error) throw error;
          }
        } else if (existingSlotResponse.data?.id) {
          const { error } = await supabase.from('schedule_slots').delete().eq('id', existingSlotResponse.data.id);
          if (error) throw error;
        }
      }

      await saveEventStages(selectedEventId);
      await saveEventBoardSettings(selectedEventId);

      await loadEventDetail(selectedEventId);
      const successMessage =
        mismatchMap.size > 0
          ? `라인업 데이터를 저장했고, 시간이 모두 입력된 그룹에서 순서가 달랐던 ${mismatchMap.size}개 행은 시간 기준으로 보정했습니다.`
          : '라인업 데이터가 저장되었습니다. 시간 없는 행도 stage와 컬럼 순서 메타데이터를 함께 보존했습니다.';
      setMessage(successMessage);
      updateSavedSections(
        { lineup: currentSectionSignatures.lineup },
        { lineup: new Date().toISOString() }
      );
    } catch (error) {
      console.error('Error saving lineup rows:', error);
      setMessage('라인업 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSavingLineup(false);
    }
  };

  const saveTimetableRows = async () => {
    if (!selectedEventId) {
      setMessage('먼저 이벤트 기본 정보를 저장해주세요.');
      return;
    }

    try {
      setIsSavingTimetable(true);
      setMessage('');
      const supabase = createClient();

      for (const row of timetableRows) {
        if (!row.stage_name.trim() || !row.start_at || !row.end_at) continue;

        let artistId: string | null = null;
        let eventArtistId: string | null = null;
        const performanceDate = row.start_at ? row.start_at.slice(0, 10) : null;

        if (row.artist_name.trim()) {
          artistId = await ensureArtistId(row.artist_name);
          if (artistId) {
            eventArtistId = await ensureEventArtistId(selectedEventId, artistId, row, performanceDate);
          }
        }

        const payload = {
          event_id: selectedEventId,
          artist_id: artistId,
          event_artist_id: eventArtistId,
          stage_name: row.stage_name,
          slot_type: row.slot_type,
          title: row.title || null,
          start_at: row.start_at,
          end_at: row.end_at,
          is_cancelled: row.is_cancelled,
          source: row.source || null,
        };

        if (row.id) {
          const { error } = await supabase.from('schedule_slots').update(payload).eq('id', row.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('schedule_slots').insert(payload);
          if (error) throw error;
        }
      }

      await saveEventStages(selectedEventId);
      await saveEventBoardSettings(selectedEventId);

      await loadEventDetail(selectedEventId);
      setMessage('타임테이블 데이터가 저장되었습니다.');
      updateSavedSections(
        {
          timetable: currentSectionSignatures.timetable,
          lineup: currentSectionSignatures.lineup,
        },
        {
          timetable: new Date().toISOString(),
          lineup: new Date().toISOString(),
        }
      );
    } catch (error) {
      console.error('Error saving timetable rows:', error);
      setMessage('타임테이블 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSavingTimetable(false);
    }
  };

  const saveTicketRows = async () => {
    if (!selectedEventId) {
      setMessage('먼저 이벤트 기본 정보를 저장해주세요.');
      return;
    }

    try {
      setIsSavingTickets(true);
      setMessage('');
      const supabase = createClient();

      for (const row of ticketRows) {
        if (!row.provider_name.trim() || !row.url.trim()) continue;

        const payload = {
          event_id: selectedEventId,
          provider_name: row.provider_name,
          provider_code: row.provider_code || null,
          url: row.url,
          link_type: row.link_type,
          sales_status: row.sales_status,
          opens_at: row.opens_at || null,
          ends_at: row.ends_at || null,
          price_note: row.price_note || null,
          is_primary: row.is_primary,
        };

        if (row.id) {
          const { error } = await supabase.from('ticket_links').update(payload).eq('id', row.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('ticket_links').insert(payload);
          if (error) throw error;
        }
      }

      await loadEventDetail(selectedEventId);
      setMessage('티켓 링크 데이터가 저장되었습니다.');
      updateSavedSections(
        { tickets: currentSectionSignatures.tickets },
        { tickets: new Date().toISOString() }
      );
    } catch (error) {
      console.error('Error saving ticket rows:', error);
      setMessage('티켓 링크 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSavingTickets(false);
    }
  };

  const deleteLineupRow = async (row: LineupEditorRow) => {
    if (!row.id) {
      pushEditorUndoSnapshot();
      setLineupRows((current) => current.filter((item) => item.client_id !== row.client_id));
      if (selectedLineupClientId === row.client_id) {
        setSelectedLineupClientId(null);
      }
      return;
    }

    try {
      pushEditorUndoSnapshot();
      const supabase = createClient();
      const { error } = await supabase.from('event_artists').delete().eq('id', row.id);
      if (error) throw error;
      setLineupRows((current) => current.filter((item) => item.client_id !== row.client_id));
      if (selectedLineupClientId === row.client_id) {
        setSelectedLineupClientId(null);
      }
    } catch (error) {
      console.error('Error deleting lineup row:', error);
      setMessage('라인업 삭제 중 오류가 발생했습니다.');
    }
  };

  const deleteTimetableRow = async (row: TimetableEditorRow) => {
    if (!row.id) {
      pushEditorUndoSnapshot();
      setTimetableRows((current) => current.filter((item) => item.client_id !== row.client_id));
      return;
    }

    try {
      pushEditorUndoSnapshot();
      const supabase = createClient();
      const { error } = await supabase.from('schedule_slots').delete().eq('id', row.id);
      if (error) throw error;
      setTimetableRows((current) => current.filter((item) => item.client_id !== row.client_id));
    } catch (error) {
      console.error('Error deleting timetable row:', error);
      setMessage('타임테이블 삭제 중 오류가 발생했습니다.');
    }
  };

  const deleteTicketRow = async (row: TicketEditorRow) => {
    if (!row.id) {
      pushEditorUndoSnapshot();
      setTicketRows((current) => current.filter((item) => item.client_id !== row.client_id));
      return;
    }

    try {
      pushEditorUndoSnapshot();
      const supabase = createClient();
      const { error } = await supabase.from('ticket_links').delete().eq('id', row.id);
      if (error) throw error;
      setTicketRows((current) => current.filter((item) => item.client_id !== row.client_id));
    } catch (error) {
      console.error('Error deleting ticket row:', error);
      setMessage('티켓 링크 삭제 중 오류가 발생했습니다.');
    }
  };

  const importLineupRows = () => {
    applyImportedLineupRows(parseImportedLineupText(lineupImportText) ?? []);
  };

  const importTimetableRows = () => {
    applyImportedTimetableRows(parseImportedTimetableText(timetableImportText) ?? []);
  };

  const importTicketRows = () => {
    const parsed = parseTableText(ticketImportText);
    if (parsed.length === 0) {
      setMessage('티켓 링크 import 텍스트를 확인해주세요.');
      return;
    }

    const nextRows = parsed.map((record) => ({
      client_id: createClientId(),
      id: null,
      provider_name: record.provider || record.provider_name || '',
      provider_code: record.provider_code || '',
      url: record.url || '',
      link_type: ((record.type || record.link_type || 'general') as TicketLinkType),
      sales_status: ((record.status || record.sales_status || 'upcoming') as TicketSalesStatus),
      opens_at: record.opens_at || '',
      ends_at: record.ends_at || '',
      price_note: record.price_note || record.note || '',
      is_primary: parseBooleanCell(record.is_primary || ''),
    }));

    pushEditorUndoSnapshot();
    setTicketRows((current) => [...current, ...nextRows]);
    setTicketImportText('');
    setMessage(`${nextRows.length}개의 티켓 링크 행을 가져왔습니다. 저장 버튼을 눌러 DB에 반영하세요.`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Festival Admin Console</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              먼저 이벤트 리스트와 생성 메뉴를 보고, 이벤트를 선택했을 때만 수정 화면으로 들어가는 구조입니다.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {isEditorOpen ? (
              <button
                type="button"
                onClick={closeEditor}
                className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                이벤트 메뉴로 돌아가기
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => startCreateEvent('festival')}
                  className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  + Festival 추가
                </button>
                <button
                  type="button"
                  onClick={() => startCreateEvent('concert')}
                  className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  + Concert 추가
                </button>
              </>
            )}
          </div>
        </div>

        {!isSupabaseReady && (
          <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50 p-6 text-sm leading-7 text-amber-900">
            Supabase를 연결하면 이 화면에서 이벤트 생성/수정, 라인업, 타임테이블, 티켓 링크를 실제 DB와 연동해 관리할 수 있습니다.
            현재는 mock 데이터 기반으로 admin 구조를 미리 확인하는 상태이며, `The Glow 2026` 같은 샘플 이벤트가 리스트에 보입니다.
          </div>
        )}

        <div className="fixed right-6 top-24 z-40 flex flex-col items-end gap-3">
          <button
            type="button"
            onClick={() => setIsNoticeHistoryOpen((current) => !current)}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-lg hover:bg-slate-50"
          >
            알림
            {noticeHistory.length > 0 && (
              <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[11px] font-semibold text-white">
                {noticeHistory.length}
              </span>
            )}
          </button>

          {messageState && (
            <div className="max-w-sm rounded-2xl border border-sky-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-xl">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 h-2.5 w-2.5 rounded-full bg-sky-500" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-900">공지</p>
                  <p className="mt-1 leading-6 text-slate-600">{messageState.text}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setMessage('')}
                  className="rounded-full border border-slate-200 px-2 py-0.5 text-xs font-medium text-slate-500 hover:bg-slate-50"
                >
                  닫기
                </button>
              </div>
            </div>
          )}

          {isNoticeHistoryOpen && (
            <div className="w-[360px] rounded-3xl border border-slate-200 bg-white p-4 shadow-2xl">
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">알림 히스토리</h3>
                  <p className="mt-1 text-xs text-slate-500">최근 저장/편집 알림을 다시 확인할 수 있습니다.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsNoticeHistoryOpen(false)}
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  닫기
                </button>
              </div>
              <div className="mt-3 max-h-[360px] space-y-2 overflow-y-auto">
                {noticeHistory.length > 0 ? (
                  noticeHistory.map((notice) => (
                    <div key={notice.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900">{notice.text}</p>
                          <p className="mt-1 text-xs text-slate-500">{formatSavedAt(notice.createdAt)}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setNoticeHistory((current) => current.filter((item) => item.id !== notice.id))}
                          className="rounded-full border border-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-500 hover:bg-white"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
                    아직 알림 기록이 없습니다.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[320px_1fr]">
          <aside className="space-y-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">등록된 이벤트</h2>
              <p className="mt-2 text-sm text-slate-500">기존 이벤트를 선택하면 기본 정보와 세부 데이터를 수정할 수 있습니다.</p>
              <div className="mt-4 space-y-3">
                {events.map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => {
                      setLocalDraftSourceId(null);
                      setSelectedEventId(event.id);
                      setIsEditorOpen(true);
                      setActiveSection('event');
                      cancelStageRename();
                      setMessage('');
                    }}
                    className={`w-full rounded-2xl border px-4 py-3 text-left transition-colors ${
                      selectedEventId === event.id
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <p className="text-sm font-semibold">{event.title}</p>
                    <p className={`mt-1 text-xs ${selectedEventId === event.id ? 'text-slate-300' : 'text-slate-500'}`}>
                      {event.start_date.slice(0, 10)} · {event.event_type ?? 'festival'}
                    </p>
                  </button>
                ))}

                {events.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-6">
                    <p className="text-sm text-slate-500">아직 등록된 이벤트가 없습니다.</p>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => startCreateEvent('festival')}
                        className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
                      >
                        Festival 바로 만들기
                      </button>
                      <button
                        type="button"
                        onClick={() => startCreateEvent('concert')}
                        className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                      >
                        Concert 바로 만들기
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Import / OCR 전략</h2>
              <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
                <p>지금 바로 가능한 방식은 엑셀/TSV 붙여넣기 import입니다.</p>
                <p>후속 단계에서는 lineup 이미지나 timetable 이미지를 업로드하면 OCR/LLM이 표로 추출하고, 관리자가 검수 후 저장하는 흐름을 붙일 수 있습니다.</p>
                <p>즉 자동 분석은 나중에 붙이고, 지금은 검수 가능한 운영 입력 경로를 먼저 완성하는 방향입니다.</p>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Festival 매크로</h2>
              <div className="mt-4 space-y-4">
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">이름으로 새 페스티벌 intake 시작</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    서울재즈 전용 버튼이 아니라, 새 페스티벌 이름과 공식 링크를 넣으면 같은 import 구조로 초안을 시작합니다.
                  </p>
                  <div className="mt-4 space-y-3">
                    <input
                      type="text"
                      value={macroFestivalName}
                      onChange={(event) => setMacroFestivalName(event.target.value)}
                      placeholder="예: 부산국제록페스티벌 2026"
                      className="w-full rounded-full border border-slate-300 px-4 py-2.5 text-sm text-slate-900"
                    />
                    <input
                      type="url"
                      value={macroOfficialUrl}
                      onChange={(event) => setMacroOfficialUrl(event.target.value)}
                      placeholder="공식 홈페이지 URL"
                      className="w-full rounded-full border border-slate-300 px-4 py-2.5 text-sm text-slate-900"
                    />
                    <input
                      type="url"
                      value={macroTicketUrl}
                      onChange={(event) => setMacroTicketUrl(event.target.value)}
                      placeholder="티켓 페이지 URL"
                      className="w-full rounded-full border border-slate-300 px-4 py-2.5 text-sm text-slate-900"
                    />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={startGenericFestivalMacro}
                      className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
                    >
                      범용 intake 매크로 시작
                    </button>
                  </div>
                </div>

                {festivalMacroConfigs.map((macro) => (
                  <div key={macro.eventId} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-900">{macro.label}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{macro.summary}</p>
                    <p className="mt-2 text-xs leading-5 text-slate-500">{macro.sourceNote}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => loadFestivalMacroDraft(macro.eventId)}
                        className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
                      >
                        매크로 초안 불러오기
                      </button>
                      <a
                        href={`/events/${macro.eventId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                      >
                        Public preview
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          <div className="space-y-6">
            {!isEditorOpen ? (
              <>
                <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h2 className="text-2xl font-semibold text-slate-900">Admin Menu</h2>
                  <div className="mt-4 space-y-3 text-sm leading-7 text-slate-600">
                    <p>왼쪽 이벤트 리스트에서 기존 이벤트를 선택하면 DB와 연동된 수정 화면으로 들어갑니다.</p>
                    <p>새 이벤트를 만들 때는 아래에서 먼저 `Festival` 또는 `Concert` 타입을 선택하고 기본 정보를 저장합니다.</p>
                    <p>이벤트를 저장한 뒤에 라인업, 타임테이블, 티켓 링크를 이어서 관리하는 구조입니다.</p>
                  </div>
                </section>

                <section className="grid gap-4 lg:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => startCreateEvent('festival')}
                    className="rounded-3xl border border-slate-200 bg-white p-6 text-left shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50"
                  >
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">New Event</p>
                    <h3 className="mt-3 text-2xl font-semibold text-slate-900">Festival 추가</h3>
                    <p className="mt-3 text-sm leading-6 text-slate-600">
                      여러 날짜, 라인업, 타임테이블, 스테이지 정보를 갖는 페스티벌 이벤트를 새로 등록합니다.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => startCreateEvent('concert')}
                    className="rounded-3xl border border-slate-200 bg-white p-6 text-left shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50"
                  >
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">New Event</p>
                    <h3 className="mt-3 text-2xl font-semibold text-slate-900">Concert 추가</h3>
                    <p className="mt-3 text-sm leading-6 text-slate-600">
                      단일 공연 중심의 콘서트 데이터를 먼저 등록하고, 이후 티켓과 세부 정보를 확장합니다.
                    </p>
                  </button>
                </section>

                <section className="rounded-3xl border border-slate-200 bg-[#f8f6f0] p-6 shadow-sm">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Macro Draft</p>
                  <h3 className="mt-3 text-2xl font-semibold text-slate-900">공개 정보 매크로로 페스티벌 초안 시작</h3>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                    이미 준비된 seed는 한 번에 불러오고, 새로운 페스티벌은 이름과 공식 링크만 입력해 같은 import 구조로 intake를 시작할 수 있습니다.
                  </p>
                  <div className="mt-5 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="text-sm font-semibold text-slate-900">범용 intake</p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        이름만 넣어도 이벤트 기본 초안과 import workspace를 열고, 공식 링크를 source로 유지한 채 lineup/timetable 수집을 시작합니다.
                      </p>
                      <div className="mt-4 space-y-3">
                        <input
                          type="text"
                          value={macroFestivalName}
                          onChange={(event) => setMacroFestivalName(event.target.value)}
                          placeholder="예: 서울파크뮤직페스티벌 2026"
                          className="w-full rounded-full border border-slate-300 px-4 py-2.5 text-sm text-slate-900"
                        />
                        <div className="grid gap-3 md:grid-cols-2">
                          <input
                            type="url"
                            value={macroOfficialUrl}
                            onChange={(event) => setMacroOfficialUrl(event.target.value)}
                            placeholder="공식 홈페이지 URL"
                            className="w-full rounded-full border border-slate-300 px-4 py-2.5 text-sm text-slate-900"
                          />
                          <input
                            type="url"
                            value={macroTicketUrl}
                            onChange={(event) => setMacroTicketUrl(event.target.value)}
                            placeholder="티켓 페이지 URL"
                            className="w-full rounded-full border border-slate-300 px-4 py-2.5 text-sm text-slate-900"
                          />
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={startGenericFestivalMacro}
                          className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-700"
                        >
                          범용 매크로 시작
                        </button>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="text-sm font-semibold text-slate-900">준비된 seed 매크로</p>
                      <div className="mt-4 space-y-3">
                        {festivalMacroConfigs.map((macro) => (
                          <div key={`hero-${macro.eventId}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <p className="text-sm font-semibold text-slate-900">{macro.label}</p>
                            <p className="mt-2 text-sm leading-6 text-slate-600">{macro.summary}</p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => loadFestivalMacroDraft(macro.eventId)}
                                className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
                              >
                                초안 불러오기
                              </button>
                              <a
                                href={`/events/${macro.eventId}`}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                              >
                                Public preview
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>
              </>
            ) : (
              <>
                <div className="flex flex-wrap gap-3">
                  {sectionOrder
                    .map((sectionId) => adminSectionConfigs.find((item) => item.id === sectionId))
                    .filter((item): item is AdminSectionConfig => Boolean(item))
                    .map((item) => (
                    (() => {
                      const sectionId = item.id as AdminSection;
                      const status = getSectionStatus(sectionId);
                      const savedAtLabel = formatSavedAt(lastSavedAtBySection[sectionId]);

                      return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveSection(sectionId)}
                      className={`rounded-2xl px-4 py-2.5 text-left text-sm font-medium transition-colors ${
                        activeSection === item.id
                          ? 'bg-slate-900 text-white'
                          : 'bg-white text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <div>{item.label}</div>
                      <div className={`mt-1 text-[11px] ${
                        activeSection === item.id ? 'text-slate-300' : 'text-slate-400'
                      }`}>
                        {status === 'saving' && '저장 중...'}
                        {status === 'dirty' && '미저장 변경'}
                        {status === 'saved' && savedAtLabel && `마지막 저장 ${savedAtLabel}`}
                        {status === 'idle' && '변경 없음'}
                      </div>
                    </button>
                      );
                    })()
                  ))}
                </div>

                {(activeSection === 'event') && (
              <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-3 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <h2 className="text-2xl font-semibold text-slate-900">Event Basics</h2>
                    <p className="mt-2 text-sm text-slate-500">
                      {selectedEventId
                        ? '선택한 이벤트의 기본 정보를 수정합니다.'
                        : localDraftSourceId
                          ? '매크로로 불러온 초안입니다. 기본 정보를 검수한 뒤 새 이벤트로 저장할 수 있습니다.'
                          : `${formData.event_type === 'concert' ? 'Concert' : 'Festival'} 생성 모드입니다. 먼저 기본 정보를 저장한 뒤 세부 데이터를 추가하세요.`}
                    </p>
                  </div>
                  {loadingRelated && selectedEventId && (
                    <span className="text-sm text-slate-500">상세 데이터 불러오는 중...</span>
                  )}
                </div>

                <form onSubmit={handleSaveEvent} className="mt-6 space-y-6">
                  <div className="grid gap-6 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">공연명</label>
                      <input value={formData.title} onChange={handleEventChange('title')} className="w-full rounded-md border border-slate-300 px-3 py-2" required />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">대표 아티스트 문자열</label>
                      <input value={formData.artist} onChange={handleEventChange('artist')} className="w-full rounded-md border border-slate-300 px-3 py-2" required />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">이벤트 타입</label>
                      <select value={formData.event_type} onChange={handleEventChange('event_type')} className="w-full rounded-md border border-slate-300 px-3 py-2">
                        {eventTypeOptions.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">장르</label>
                      <input value={formData.genre} onChange={handleEventChange('genre')} className="w-full rounded-md border border-slate-300 px-3 py-2" required />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">공연 시작</label>
                      <input type="datetime-local" value={formData.start_date} onChange={handleEventChange('start_date')} className="w-full rounded-md border border-slate-300 px-3 py-2" required />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">공연 종료</label>
                      <input type="datetime-local" value={formData.end_date} onChange={handleEventChange('end_date')} className="w-full rounded-md border border-slate-300 px-3 py-2" required />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">공연장</label>
                      <input value={formData.venue} onChange={handleEventChange('venue')} className="w-full rounded-md border border-slate-300 px-3 py-2" required />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">공연장 주소</label>
                      <input value={formData.venue_address} onChange={handleEventChange('venue_address')} className="w-full rounded-md border border-slate-300 px-3 py-2" />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">위도</label>
                      <input type="number" step="any" value={formData.venue_lat} onChange={handleEventChange('venue_lat')} className="w-full rounded-md border border-slate-300 px-3 py-2" />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">경도</label>
                      <input type="number" step="any" value={formData.venue_lng} onChange={handleEventChange('venue_lng')} className="w-full rounded-md border border-slate-300 px-3 py-2" />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">대표 이미지 URL</label>
                      <input type="url" value={formData.image_url} onChange={handleEventChange('image_url')} className="w-full rounded-md border border-slate-300 px-3 py-2" placeholder="https://..." />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">가격 정보</label>
                      <input value={formData.price_range} onChange={handleEventChange('price_range')} className="w-full rounded-md border border-slate-300 px-3 py-2" />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">티켓 URL</label>
                      <input type="url" value={formData.ticket_url} onChange={handleEventChange('ticket_url')} className="w-full rounded-md border border-slate-300 px-3 py-2" placeholder="https://..." />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">티켓 오픈 시간</label>
                      <input type="datetime-local" value={formData.ticket_open_time} onChange={handleEventChange('ticket_open_time')} className="w-full rounded-md border border-slate-300 px-3 py-2" />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">관람 등급</label>
                      <input value={formData.age_limit} onChange={handleEventChange('age_limit')} className="w-full rounded-md border border-slate-300 px-3 py-2" />
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">공연 소개</label>
                    <textarea value={formData.description} onChange={handleEventChange('description')} rows={4} className="w-full rounded-md border border-slate-300 px-3 py-2" required />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">아티스트 소개</label>
                    <textarea value={formData.artist_profile} onChange={handleEventChange('artist_profile')} rows={4} className="w-full rounded-md border border-slate-300 px-3 py-2" />
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">관리자 메뉴 순서</h3>
                        <p className="mt-1 text-sm text-slate-500">상단 admin 탭의 노출 순서를 여기서 조정합니다. 현재는 브라우저 기준으로 저장됩니다.</p>
                      </div>
                      <button
                        type="button"
                        onClick={resetAdminSectionOrder}
                        className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-white"
                      >
                        기본값 복원
                      </button>
                    </div>
                    <div className="mt-4 space-y-2">
                      {sectionOrder
                        .map((sectionId) => adminSectionConfigs.find((item) => item.id === sectionId))
                        .filter((item): item is AdminSectionConfig => Boolean(item))
                        .map((section, index) => (
                          <div key={section.id} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
                            <div>
                              <p className="text-sm font-medium text-slate-900">{section.label}</p>
                              <p className="mt-1 text-xs text-slate-500">순서 {index + 1}</p>
                            </div>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => moveAdminSection(section.id, -1)}
                                disabled={index === 0}
                                className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                              >
                                ↑
                              </button>
                              <button
                                type="button"
                                onClick={() => moveAdminSection(section.id, 1)}
                                disabled={index === sectionOrder.length - 1}
                                className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                              >
                                ↓
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="submit"
                      disabled={!isSupabaseReady || isSavingEvent}
                      className="rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {!isSupabaseReady ? 'Supabase 설정 필요' : isSavingEvent ? '저장 중...' : selectedEventId ? '이벤트 수정 저장' : '새 이벤트 등록'}
                    </button>
                    {!selectedEventId && (
                      <p className="text-sm text-slate-500">새 이벤트를 먼저 저장하면 이후 lineup/timetable/ticket link 관리가 활성화됩니다.</p>
                    )}
                  </div>
                </form>
              </section>
            )}

                {(activeSection === 'imports') && (
              <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-3 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <h2 className="text-2xl font-semibold text-slate-900">Import Workspace</h2>
                    <p className="mt-2 text-sm text-slate-500">
                      이미지 미리보기와 추출 결과 검수를 한 화면에서 처리한 뒤, lineup 또는 timetable 편집기로 바로 반영합니다.
                    </p>
                  </div>
                  <div className="rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-600">
                    {selectedEventId
                      ? '기존 이벤트 수정 모드'
                      : localDraftSourceId
                        ? '매크로 초안 검수 모드'
                        : `${formData.event_type} 생성 준비 모드`}
                  </div>
                </div>

                <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm font-semibold text-slate-900">1. 업로드 대상 선택</p>
                      <div className="mt-3 flex flex-wrap gap-3">
                        {(['lineup', 'timetable'] as const).map((option) => (
                          <button
                            key={option}
                            type="button"
                            onClick={() => setImportTarget(option)}
                            className={`rounded-full px-4 py-2 text-sm font-medium ${
                              importTarget === option
                                ? 'bg-slate-900 text-white'
                                : 'bg-white text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            {option === 'lineup' ? 'Lineup 가져오기' : 'Timetable 가져오기'}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 p-4">
                      <p className="text-sm font-semibold text-slate-900">2. 라인업 이미지 또는 시간표 이미지 업로드</p>
                      <p className="mt-2 text-sm leading-6 text-slate-500">
                        지금 단계에서는 이미지를 업로드해 미리보기로 확인하고, OCR 또는 LLM이 추출한 TSV 결과를 아래에서 검수하는 흐름입니다.
                      </p>
                      <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500 hover:border-slate-400 hover:bg-slate-100">
                        <span className="font-medium text-slate-700">이미지 선택</span>
                        <span className="mt-2">PNG, JPG, WEBP 포스터/라인업 이미지 업로드</span>
                        <input ref={importFileInputRef} type="file" accept="image/*" onChange={handleImportImageChange} className="hidden" />
                      </label>
                      {importImageName && (
                        <p className="mt-3 text-sm text-slate-500">업로드된 파일: {importImageName}</p>
                      )}
                    </div>

                    {(activeImportPlaybook || (localDraftSourceId && formData.title.trim())) && (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-amber-950">
                              {activeImportPlaybook?.title ?? `${formData.title} 범용 intake 가이드`}
                            </p>
                            <p className="mt-2 text-sm leading-6 text-amber-900">
                              {activeImportPlaybook?.summary ??
                                '이름과 공식 링크만 먼저 넣고, lineup/timetable TSV를 운영자가 검수하면서 채워가는 범용 페스티벌 수집 매크로입니다.'}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => void copyImportVisionPrompt()}
                              className="rounded-full border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-950 hover:bg-amber-100"
                            >
                              Vision Prompt 복사
                            </button>
                            <button
                              type="button"
                              onClick={fillImportOutputHeader}
                              className="rounded-full border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-950 hover:bg-amber-100"
                            >
                              TSV 헤더 넣기
                            </button>
                            {activeImportPlaybook?.sampleOutput && (
                              <button
                                type="button"
                                onClick={() => fillImportSampleOutput(activeImportPlaybook)}
                                className="rounded-full border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-950 hover:bg-amber-100"
                              >
                                공식 TSV 샘플 채우기
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="mt-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-800">Official Sources</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {currentImportSourceLinks.map((link) => (
                              <a
                                key={link.url}
                                href={link.url}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-full border border-amber-200 bg-white px-3 py-1.5 text-xs font-medium text-amber-950 hover:bg-amber-100"
                              >
                                {link.label}
                              </a>
                            ))}
                          </div>
                        </div>

                        {activeImportPlaybook?.stageGuide.length ? (
                          <div className="mt-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-800">Stage Guide</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {activeImportPlaybook.stageGuide.map((stage) => (
                                <span
                                  key={stage}
                                  className="rounded-full border border-amber-200 bg-white px-3 py-1.5 text-xs font-medium text-amber-950"
                                >
                                  {stage}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        <div className="mt-4 space-y-2 text-sm leading-6 text-amber-950">
                          {(activeImportPlaybook?.notes ?? [
                            '먼저 official website, ticket page, lineup 이미지, timetable 이미지 링크를 확보합니다.',
                            'lineup은 날짜와 공개 순서를 먼저 구조화하고, timetable은 stage/time이 확인되는 순간부터 HH:MM 기준으로 채웁니다.',
                            '저장 전에는 변경점 미리보기와 QA diff를 보고 빠진 행이 없는지 먼저 확인합니다.',
                          ]).map((note) => (
                            <p key={note}>{note}</p>
                          ))}
                        </div>

                        <pre className="mt-4 overflow-x-auto rounded-2xl border border-amber-200 bg-white p-4 text-xs leading-6 text-slate-700">
{activeImportPlaybook?.visionPrompt ?? genericImportGuidePrompt}
                        </pre>
                      </div>
                    )}

                    <div className="rounded-2xl border border-slate-200 p-4">
                      <p className="text-sm font-semibold text-slate-900">3. 추출 결과 붙여넣기</p>
                      <p className="mt-2 whitespace-pre-wrap text-xs leading-6 text-slate-600">
                        {importTarget === 'lineup'
                          ? 'date\tartist\torder\trole\theadliner\tstatus\tnote'
                          : 'date\tstage\tartist\tstart\tend\ttitle\tsource'}
                      </p>
                      <textarea
                        value={importExtractedText}
                        onChange={(event) => setImportExtractedText(event.target.value)}
                        rows={10}
                        className="mt-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                        placeholder={
                          importTarget === 'lineup'
                            ? 'OCR/LLM이 추출한 lineup TSV를 붙여넣으세요.'
                            : 'OCR/LLM이 추출한 timetable TSV를 붙여넣으세요.'
                        }
                      />
                      <div className="mt-4 flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={buildImportPreview}
                          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700"
                        >
                          변경점 미리보기
                        </button>
                        <button
                          type="button"
                          onClick={applyImportWorkspace}
                          className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white"
                        >
                          {importTarget === 'lineup' ? 'Lineup 편집기로 반영' : 'Timetable 편집기로 반영'}
                        </button>
                        <p className="text-sm text-slate-500">반영 후 각 편집기에서 검수하고 저장 버튼을 눌러 DB에 확정합니다.</p>
                      </div>
                    </div>

                    {importPreview && importPreview.target === importTarget && (
                      <div className="rounded-2xl border border-slate-200 p-4">
                        <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 md:flex-row md:items-end md:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">4. 변경점 미리보기</p>
                            <p className="mt-1 text-sm text-slate-500">
                              현재 편집기와 비교해 어떤 행이 추가/수정되는지 먼저 확인합니다.
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2 text-xs font-medium">
                            <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-800">추가 {importPreview.added}</span>
                            <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-800">수정 {importPreview.updated}</span>
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">동일 {importPreview.unchanged}</span>
                          </div>
                        </div>
                        <div className="mt-4 space-y-3">
                          {importPreview.items.slice(0, 8).map((item) => (
                            <div key={item.key} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                                <div>
                                  <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                                  <p className="mt-1 text-xs text-slate-500">{item.subtitle}</p>
                                </div>
                                <span
                                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                                    item.status === 'new'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : item.status === 'update'
                                        ? 'bg-amber-100 text-amber-800'
                                        : 'bg-slate-100 text-slate-700'
                                  }`}
                                >
                                  {item.status === 'new' ? 'NEW' : item.status === 'update' ? 'UPDATE' : 'UNCHANGED'}
                                </span>
                              </div>
                              {item.changes.length > 0 && (
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {item.changes.map((change) => (
                                    <span key={change} className="rounded-full bg-white px-2 py-1 text-[11px] text-slate-600">
                                      {change}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                          {importPreview.rowCount > 8 && (
                            <p className="text-xs text-slate-500">
                              나머지 {importPreview.rowCount - 8}개 행은 반영 시 편집기에서 계속 검수할 수 있습니다.
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {importQaComparison && importQaComparison.target === importTarget && (
                      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                        <div className="flex flex-col gap-3 border-b border-rose-200 pb-4 md:flex-row md:items-end md:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-rose-950">5. 공식 TSV 샘플 QA 비교</p>
                            <p className="mt-1 text-sm text-rose-900">
                              OCR 결과를 공식 샘플과 비교해 누락, 오인식, 추가 행을 바로 확인합니다.
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2 text-xs font-medium">
                            <span className="rounded-full bg-white px-3 py-1 text-slate-700">
                              예상 {importQaComparison.expectedCount}
                            </span>
                            <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-800">
                              일치 {importQaComparison.exact}
                            </span>
                            <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-800">
                              불일치 {importQaComparison.mismatched}
                            </span>
                            <span className="rounded-full bg-rose-100 px-3 py-1 text-rose-800">
                              누락 {importQaComparison.missing}
                            </span>
                            <span className="rounded-full bg-slate-200 px-3 py-1 text-slate-700">
                              추가 {importQaComparison.extra}
                            </span>
                          </div>
                        </div>

                        <div className="mt-4 rounded-2xl border border-rose-200 bg-white px-4 py-3 text-sm text-rose-950">
                          현재 OCR 결과 {importQaComparison.actualCount}행을 공식 샘플 {importQaComparison.expectedCount}행과 비교했습니다.
                        </div>

                        <div className="mt-4 space-y-3">
                          {importQaComparison.items
                            .filter((item) => item.status !== 'exact')
                            .slice(0, 10)
                            .map((item) => (
                              <div key={item.key} className="rounded-2xl border border-rose-200 bg-white p-4">
                                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                                  <div>
                                    <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                                    <p className="mt-1 text-xs text-slate-500">{item.subtitle}</p>
                                  </div>
                                  <span
                                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                                      item.status === 'missing'
                                        ? 'bg-rose-100 text-rose-800'
                                        : item.status === 'mismatch'
                                          ? 'bg-amber-100 text-amber-800'
                                          : 'bg-slate-200 text-slate-700'
                                    }`}
                                  >
                                    {item.status === 'missing'
                                      ? 'MISSING'
                                      : item.status === 'mismatch'
                                        ? 'MISMATCH'
                                        : 'EXTRA'}
                                  </span>
                                </div>
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {item.details.map((detail) => (
                                    <span key={detail} className="rounded-full bg-rose-50 px-2 py-1 text-[11px] text-rose-900">
                                      {detail}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            ))}

                          {importQaComparison.mismatched === 0 &&
                            importQaComparison.missing === 0 &&
                            importQaComparison.extra === 0 && (
                              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-900">
                                현재 OCR 결과가 공식 TSV 샘플과 완전히 일치합니다.
                              </div>
                            )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-2xl border border-slate-200 p-4">
                      <p className="text-sm font-semibold text-slate-900">이미지 미리보기</p>
                      {importImagePreviewUrl ? (
                        <Image
                          src={importImagePreviewUrl}
                          alt="Imported lineup or timetable"
                          width={1200}
                          height={900}
                          unoptimized
                          className="mt-4 w-full rounded-2xl border border-slate-200 object-cover"
                        />
                      ) : (
                        <div className="mt-4 rounded-2xl border border-dashed border-slate-300 px-4 py-16 text-center text-sm text-slate-500">
                          <p>아직 업로드된 이미지가 없습니다.</p>
                          <div className="mt-4 flex flex-wrap justify-center gap-3">
                            <button
                              type="button"
                              onClick={() => importFileInputRef.current?.click()}
                              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
                            >
                              이미지 선택
                            </button>
                            <button
                              type="button"
                              onClick={() => setImportTarget((current) => (current === 'lineup' ? 'timetable' : 'lineup'))}
                              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                            >
                              {importTarget === 'lineup' ? 'Timetable import로 전환' : 'Lineup import로 전환'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-900">
                      <p className="font-semibold">다음 자동화 연결 포인트</p>
                      <p className="mt-2">1. 이미지 업로드 후 OCR 엔진 또는 Vision LLM에 전달</p>
                      <p>2. TSV 초안 생성</p>
                      <p>3. 이 화면에서 관리자가 검수 후 lineup/timetable 편집기로 반영</p>
                      <p>4. 최종 저장 시 DB에 확정</p>
                    </div>
                  </div>
                </div>
              </section>
            )}

                {(activeSection === 'lineup') && (
              <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-3 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-2xl font-semibold text-slate-900">Lineup Manager</h2>
                      <HelpHint
                        title="Lineup Manager"
                        body="라인업 보드는 X축을 스테이지, Y축을 시간으로 보고 편집합니다. 시간이 없는 카드는 TBD 큐에 두고 보기 우선순위만 먼저 정리할 수 있습니다."
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={handleUndoEditor}
                      disabled={editorUndoStack.length === 0}
                      title="Ctrl/Cmd+Z"
                      className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Undo {editorUndoStack.length > 0 ? `(${editorUndoStack.length})` : ''}
                    </button>
                    <button
                      type="button"
                      onClick={handleRedoEditor}
                      disabled={editorRedoStack.length === 0}
                      title="Ctrl/Cmd+Shift+Z 또는 Ctrl/Cmd+Y"
                      className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Redo {editorRedoStack.length > 0 ? `(${editorRedoStack.length})` : ''}
                    </button>
                    <button
                      type="button"
                      onClick={() => void saveLineupRows()}
                      disabled={!isSupabaseReady || !selectedEventId || isSavingLineup}
                      className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                    >
                      {!isSupabaseReady ? 'Supabase 연결 필요' : !selectedEventId ? '이벤트 저장 후 사용 가능' : isSavingLineup ? '저장 중...' : '보드 변경 저장'}
                    </button>
                    <button
                      type="button"
                      onClick={() => quickAddLineupRow(activeLineupDayKey)}
                      className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                    >
                      선택한 Day 아티스트 추가
                    </button>
                  </div>
                </div>

                <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">TSV import 예시</p>
                  <p className="mt-2 whitespace-pre-wrap text-xs leading-6 text-slate-600">
                    date	stage	start	end	artist	order	role	headliner	status	note
                    {'\n'}
                    2026-03-21	Stage37	20:40	21:30	Lee Seung Yoon	6	headliner	true	confirmed	Day 1 headliner
                  </p>
                  <textarea
                    value={lineupImportText}
                    onChange={(event) => setLineupImportText(event.target.value)}
                    rows={5}
                    className="mt-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    placeholder="엑셀에서 복사한 표를 그대로 붙여넣으세요."
                  />
                  <div className="mt-3 flex gap-3">
                    <button type="button" onClick={importLineupRows} className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white">붙여넣기 가져오기</button>
                    <p className="text-sm text-slate-500">가져오기 후 저장 버튼을 눌러야 실제 DB에 반영됩니다.</p>
                  </div>
                </div>

                <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  <div className="flex flex-col gap-3 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-xl font-semibold text-slate-900">Lineup Timeline Board</h3>
                        <HelpHint
                          title="Timeline Board"
                          body="카드를 시간 슬롯에 드롭하면 그 시작 시간이 바로 입력됩니다. 기존 길이가 없으면 기본 50분 세트로 잡고, 같은 날짜/스테이지 그룹의 시간이 모두 채워지면 저장 시 시간 순으로 반영합니다."
                        />
                      </div>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      X = Stage / Y = Time
                    </span>
                  </div>

                  {renderAdminDaySelector('lineup')}

                  <div className="mt-6 space-y-6">
                    {visibleLineupBoardDays.map((day) => (
                      <div key={day.key} className="rounded-3xl border border-slate-200 bg-white p-5">
                        <div className="flex flex-col gap-2 border-b border-slate-200 pb-4 md:flex-row md:items-end md:justify-between">
                          <div>
                            <h4 className="text-lg font-semibold text-slate-900">{day.label}</h4>
                            <p className="mt-1 text-sm text-slate-500">{day.date}</p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2 py-2">
                              <input
                                value={newStageNameByDay[day.key] ?? ''}
                                onChange={(event) =>
                                  setNewStageNameByDay((current) => ({
                                    ...current,
                                    [day.key]: event.target.value,
                                  }))
                                }
                                placeholder="새 stage 이름"
                                className="w-32 bg-transparent px-2 text-sm text-slate-700 outline-none placeholder:text-slate-400"
                              />
                              <button
                                type="button"
                                onClick={() => addStageToDay(day.key)}
                                className="rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white hover:bg-slate-700"
                              >
                                + Stage 추가
                              </button>
                            </div>
                            <HelpHint
                              title="Unscheduled Blocks"
                              body="미배치 카드를 먼저 선택한 뒤 원하는 stage 타임라인 슬롯으로 바로 드롭하세요. 드롭한 순간 날짜, 스테이지, 시작/종료 시간이 함께 설정됩니다."
                            />
                          </div>
                        </div>

                        {day.hiddenStages.length > 0 && (
                          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                              <div>
                                <p className="text-sm font-semibold text-amber-900">Hidden stages</p>
                                <p className="mt-1 text-xs text-amber-800">public에서는 숨겨지고, 여기서 다시 복구할 수 있습니다.</p>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {day.hiddenStages.map((stageName) => (
                                  <button
                                    key={`${day.key}-hidden-${stageName}`}
                                    type="button"
                                    onClick={() => restoreHiddenStageToDay(day.key, stageName)}
                                    className="rounded-full border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100"
                                  >
                                    {stageName} 복구
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}

                        {(() => {
                          const dayRows = day.stages.flatMap((stage) => stage.rows);
                          const timelineSettings = timelineSettingsByDay[day.key] ?? getDefaultTimelineSettings(dayRows);
                          const timelineSlots = buildTimelineSlots(timelineSettings);
                          const rowCount = Math.max(1, timelineSlots.length - 1);

                          return (
                            <div className="mt-5 space-y-4 overflow-x-auto">
                              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                <div className="flex items-center justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-semibold text-slate-900">Unscheduled Blocks</p>
                                    <p className="mt-1 text-xs text-slate-500">
                                      여기서 카드를 바로 원하는 stage timeline으로 드롭하면 start/end time이 자동으로 채워집니다.
                                    </p>
                                  </div>
                                  <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-500">
                                    {day.unscheduledRows.length} cards
                                  </span>
                                </div>

                                <div className="mt-4 flex min-h-[72px] flex-wrap gap-2 rounded-2xl border border-dashed border-slate-300 bg-white p-3">
                                  {day.unscheduledRows.length > 0 ? (
                                    day.unscheduledRows.map((row) => (
                                      <div
                                        key={row.client_id}
                                        draggable
                                        onClick={() => setSelectedLineupClientId(row.client_id)}
                                        onDragStart={(event) => {
                                          event.dataTransfer.effectAllowed = 'move';
                                          event.dataTransfer.setData('text/plain', row.client_id);
                                          setDraggedLineupClientId(row.client_id);
                                        }}
                                        onDragEnd={() => setDraggedLineupClientId(null)}
                                        className={`rounded-xl border px-3 py-3 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-md ${
                                          selectedLineupClientId === row.client_id
                                            ? 'border-slate-900 bg-white shadow-md'
                                            : 'border-slate-200 bg-slate-50'
                                        }`}
                                      >
                                        <p className="text-sm font-semibold text-slate-900">{row.artist_name || 'Untitled Artist'}</p>
                                        <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                                          <span>Priority {row.display_order || '-'}</span>
                                          {row.stage_name.trim() && (
                                            <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600">
                                              {row.stage_name.trim()}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    ))
                                  ) : (
                                    <div className="rounded-xl border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-500">
                                      <p>아직 미배치 블록이 없습니다.</p>
                                      <div className="mt-3 flex flex-wrap justify-center gap-2">
                                        <button
                                          type="button"
                                          onClick={() => quickAddLineupRow(day.key)}
                                          className="rounded-full bg-slate-900 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-slate-700"
                                        >
                                          아티스트 추가
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setActiveSection('imports')}
                                          className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
                                        >
                                          import로 가져오기
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="grid min-w-[980px] gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-[140px_140px_140px_140px_auto]">
                                <label className="text-sm text-slate-600">
                                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Visible Start</span>
                                  <input
                                    type="time"
                                    step={300}
                                    value={timelineSettings.startTime}
                                    onFocus={() => beginUndoInputSession(`timeline:${day.key}:start`)}
                                    onBlur={endUndoInputSession}
                                    onChange={(event) => updateTimelineSettings(day.key, { startTime: event.target.value })}
                                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                  />
                                </label>
                                <label className="text-sm text-slate-600">
                                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Visible End</span>
                                  <input
                                    type="time"
                                    step={300}
                                    value={timelineSettings.endTime}
                                    onFocus={() => beginUndoInputSession(`timeline:${day.key}:end`)}
                                    onBlur={endUndoInputSession}
                                    onChange={(event) => updateTimelineSettings(day.key, { endTime: event.target.value })}
                                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                  />
                                </label>
                                <div className="flex items-end">
                                  <div className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
                                    5 min fixed
                                  </div>
                                </div>
                                <div className="flex items-end">
                                  <button
                                    type="button"
                                    onClick={() => resetTimelineSettings(day.key)}
                                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                                  >
                                    데이터 기준 리셋
                                  </button>
                                </div>
                                <div className="flex items-end text-sm text-slate-500">
                                  현재 타임라인은 5분 단위입니다. 보이는 시작/종료 시간만 admin이 조절합니다.
                                </div>
                              </div>

                              <div
                                className="grid min-w-[980px] gap-4"
                                style={{ gridTemplateColumns: `88px repeat(${Math.max(day.stages.length, 1)}, minmax(240px, 1fr))` }}
                              >
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Time</p>
                                  <div
                                    className="mt-4 grid"
                                    style={{ gridTemplateRows: `repeat(${rowCount}, minmax(${TIMELINE_ROW_HEIGHT_PX}px, ${TIMELINE_ROW_HEIGHT_PX}px))` }}
                                  >
                                    {timelineSlots.slice(0, -1).map((slot, index) => (
                                      <div key={slot} className="border-t border-slate-200 px-2 pt-1 text-[11px] font-medium text-slate-500 first:border-t-0">
                                        {(index % Math.max(1, Math.floor(30 / TIMELINE_INTERVAL_MINUTES)) === 0) ? slot : ''}
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                {day.stages.length === 0 && (
                                  <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
                                    <p>아직 stage가 없습니다. 먼저 컬럼을 만들고 블록을 배치해보세요.</p>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                      <button
                                        type="button"
                                        onClick={() => quickAddStage(day.key)}
                                        className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700"
                                      >
                                        + Stage 추가
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => quickAddLineupRow(day.key)}
                                        className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                                      >
                                        아티스트 먼저 추가
                                      </button>
                                    </div>
                                  </div>
                                )}

                                {day.stages.map((stage) => {
                                  const timedRows = stage.rows.filter((row) => row.start_time.trim());
                                  const isEditingStage = editingStageKey === stage.key;

                                  return (
                                    <div key={stage.key} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition-all duration-300 ease-out">
                                      <div className="flex items-center justify-between gap-3">
                                        <div>
                                          {isEditingStage ? (
                                            <div className="flex items-center gap-2">
                                              <input
                                                value={stageRenameDraft}
                                                onChange={(event) => setStageRenameDraft(event.target.value)}
                                                onKeyDown={(event) => {
                                                  if (event.key === 'Enter') {
                                                    event.preventDefault();
                                                    commitStageRename(day.key, stage.label);
                                                  }
                                                  if (event.key === 'Escape') {
                                                    event.preventDefault();
                                                    cancelStageRename();
                                                  }
                                                }}
                                                autoFocus
                                                className="w-32 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-900 outline-none focus:border-slate-400"
                                              />
                                              <button
                                                type="button"
                                                onClick={() => commitStageRename(day.key, stage.label)}
                                                className="rounded-full border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-white"
                                              >
                                                저장
                                              </button>
                                              <button
                                                type="button"
                                                onClick={cancelStageRename}
                                                className="rounded-full border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-white"
                                              >
                                                취소
                                              </button>
                                            </div>
                                          ) : (
                                            <p className="text-base font-semibold text-slate-900">{stage.label}</p>
                                          )}
                                          <p className="mt-1 text-xs text-slate-500">{timedRows.length} scheduled / {stage.rows.length} total</p>
                                        </div>
                                        <div className="flex gap-2">
                                          <button
                                            type="button"
                                            onClick={() => hideStageFromDay(day.key, stage.label)}
                                            className="rounded-full border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-white"
                                          >
                                            숨기기
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => beginStageRename(stage.key, stage.label)}
                                            className="rounded-full border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-white"
                                          >
                                            이름변경
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => deleteStageFromDay(day.key, stage.label)}
                                            disabled={!canDeleteStageFromDay(day.key, stage.label)}
                                            className="rounded-full border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                                          >
                                            삭제
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => moveStageWithinDay(day.key, stage.label, -1)}
                                            className="rounded-full border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-white"
                                          >
                                            ←
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => moveStageWithinDay(day.key, stage.label, 1)}
                                            className="rounded-full border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-white"
                                          >
                                            →
                                          </button>
                                        </div>
                                      </div>

                                      <div
                                        className="relative mt-4 grid overflow-hidden rounded-2xl border border-slate-200 bg-white"
                                        onDragOver={(event) => {
                                          event.preventDefault();
                                          event.dataTransfer.dropEffect = 'move';
                                        }}
                                        onDrop={(event) => {
                                          event.preventDefault();
                                          const draggedClientId = getDraggedClientId(event);
                                          if (!draggedClientId) return;
                                          const startTime = getTimelineDropStartTime(event, timelineSettings, rowCount);
                                          moveLineupRowToTimedSlot(draggedClientId, stage.key, startTime);
                                          setDraggedLineupClientId(null);
                                        }}
                                        style={{ gridTemplateRows: `repeat(${rowCount}, minmax(${TIMELINE_ROW_HEIGHT_PX}px, ${TIMELINE_ROW_HEIGHT_PX}px))` }}
                                      >
                                        {timelineSlots.slice(0, -1).map((slot, index) => (
                                          <div
                                            key={`${stage.key}-${slot}`}
                                            className="pointer-events-none border-t border-slate-100 bg-slate-50/40 first:border-t-0"
                                            style={{ gridRow: index + 1 }}
                                          />
                                        ))}

                                        {timedRows.map((row) => {
                                          const placement = getTimelineRowPlacement(row, timelineSettings);
                                          if (!placement) return null;

                                          return (
                                            <div
                                              key={row.client_id}
                                              draggable
                                              onDragStart={(event) => {
                                                event.dataTransfer.effectAllowed = 'move';
                                                event.dataTransfer.setData('text/plain', row.client_id);
                                                setDraggedLineupClientId(row.client_id);
                                              }}
                                              onDragEnd={() => setDraggedLineupClientId(null)}
                                              style={{ gridRow: `${placement.rowStart} / span ${placement.rowSpan}` }}
                                              className={`relative z-10 mx-2 my-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 shadow-sm transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-md ${
                                                resizeSession?.clientId === row.client_id
                                                  ? 'ring-2 ring-amber-200'
                                                  : selectedLineupClientId === row.client_id
                                                    ? 'border-slate-900 bg-white'
                                                    : ''
                                              }`}
                                              >
                                              <div
                                                onMouseDown={(event) => {
                                                  event.preventDefault();
                                                  event.stopPropagation();
                                                  pushEditorUndoSnapshot();
                                                  const startMinute = parseTimeToMinutes(row.start_time.trim()) ?? 0;
                                                  const endMinute = parseTimeToMinutes(row.end_time.trim()) ?? (startMinute + 50);

                                                  setResizeSession({
                                                    clientId: row.client_id,
                                                    dayKey: day.key,
                                                    startY: event.clientY,
                                                    edge: 'start',
                                                    baseStartMinutes: startMinute,
                                                    baseEndMinutes: endMinute,
                                                  });
                                                }}
                                                className="absolute inset-x-2 top-1 h-2 cursor-ns-resize rounded-full bg-transparent hover:bg-amber-100"
                                              />
                                              <div
                                                onClick={() => setSelectedLineupClientId(row.client_id)}
                                                className="cursor-pointer rounded-lg px-1 py-1"
                                              >
                                                <div className="flex items-start justify-between gap-2">
                                                  <div>
                                                    <p className="text-sm font-semibold text-slate-900">{row.artist_name || 'Untitled Artist'}</p>
                                                    <p className="mt-1 text-xs text-slate-500">
                                                      {row.start_time}{row.end_time ? ` - ${row.end_time}` : ''}
                                                    </p>
                                                  </div>
                                                  {row.is_headliner && (
                                                    <span className="rounded-full bg-amber-300 px-2 py-1 text-[11px] font-semibold text-slate-950">
                                                      H
                                                    </span>
                                                  )}
                                                </div>
                                              </div>
                                              <div
                                                onMouseDown={(event) => {
                                                  event.preventDefault();
                                                  event.stopPropagation();
                                                  pushEditorUndoSnapshot();
                                                  const startMinute = parseTimeToMinutes(row.start_time.trim()) ?? 0;
                                                  const endMinute = parseTimeToMinutes(row.end_time.trim()) ?? (startMinute + 50);

                                                  setResizeSession({
                                                    clientId: row.client_id,
                                                    dayKey: day.key,
                                                    startY: event.clientY,
                                                    edge: 'end',
                                                    baseStartMinutes: startMinute,
                                                    baseEndMinutes: endMinute,
                                                  });
                                                }}
                                                className="absolute inset-x-2 bottom-1 h-2 cursor-ns-resize rounded-full bg-transparent hover:bg-amber-100"
                                              />
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    ))}

                    {visibleLineupBoardDays.length === 0 && (
                      <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
                        <p>선택한 Day에는 아직 라인업 블록이 없습니다.</p>
                        <div className="mt-4 flex flex-wrap justify-center gap-3">
                          <button
                            type="button"
                            onClick={() => quickAddLineupRow(activeLineupDayKey || defaultAdminDayKey)}
                            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
                          >
                            선택한 Day 아티스트 추가
                          </button>
                          <button
                            type="button"
                            onClick={() => quickAddStage(activeLineupDayKey || defaultAdminDayKey)}
                            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                          >
                            + Stage 추가
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-6 flex gap-3">
                  <button type="button" onClick={() => void saveLineupRows()} disabled={!isSupabaseReady || !selectedEventId || isSavingLineup} className="rounded-md bg-indigo-600 px-4 py-2 text-white disabled:opacity-50">
                    {!isSupabaseReady ? 'Supabase 연결 필요' : !selectedEventId ? '이벤트 저장 후 사용 가능' : isSavingLineup ? '저장 중...' : '라인업 저장'}
                  </button>
                  <p className="text-sm text-slate-500">
                    {!isSupabaseReady
                      ? '지금은 mock 모드라 실제 저장이 비활성화되어 있습니다.'
                      : !selectedEventId
                        ? '새 이벤트 기본 정보를 먼저 저장해야 라인업을 DB에 저장할 수 있습니다.'
                        : '같은 날짜/스테이지 그룹의 시작/종료 시간이 모두 있어야 시간 순 정렬을 적용합니다. 그 전까지는 순서를 유지하고 시간만 표시합니다.'}
                  </p>
                </div>
              </section>
            )}

                {activeSection === 'lineup' && selectedLineupRow && (
              <aside className="fixed bottom-6 left-4 top-24 z-40 w-[320px] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl xl:left-[348px] xl:w-[340px] 2xl:left-[380px]">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <h4 className="text-lg font-semibold text-slate-900">Block Metadata</h4>
                    <HelpHint
                      title="Block Metadata"
                      body="선택한 블록의 메타데이터를 왼쪽 drawer에서 수정합니다. 보드는 넓게 유지하고, 상세 입력은 별도 패널에서 처리하는 구조입니다."
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedLineupClientId(null)}
                    className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                  >
                    닫기
                  </button>
                </div>

                <div className="mt-5 space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">Artist</label>
                    <input
                      value={selectedLineupRow.artist_name}
                      onChange={(event) => updateLineupRow(selectedLineupRow.client_id, { artist_name: event.target.value })}
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">Date</label>
                      <input
                        type="date"
                        value={selectedLineupRow.performance_date}
                        onChange={(event) => updateLineupRow(selectedLineupRow.client_id, { performance_date: event.target.value })}
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">Stage</label>
                      <select
                        value={selectedLineupRow.stage_name}
                        onChange={(event) => updateLineupRow(selectedLineupRow.client_id, { stage_name: event.target.value })}
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      >
                        <option value="">Stage 선택</option>
                        {selectedLineupStageOptions.map((stageName) => (
                          <option key={stageName} value={stageName}>
                            {stageName}
                          </option>
                        ))}
                      </select>
                      <div className="mt-2 flex gap-2">
                        <input
                          value={newStageNameByDay[selectedLineupDayKey] ?? ''}
                          onChange={(event) =>
                            setNewStageNameByDay((current) => ({
                              ...current,
                              [selectedLineupDayKey]: event.target.value,
                            }))
                          }
                          placeholder="새 stage 이름"
                          className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const nextStageName = (newStageNameByDay[selectedLineupDayKey] ?? '').trim();
                            if (!nextStageName) {
                              setMessage('추가할 stage 이름을 입력해주세요.');
                              return;
                            }
                            addStageToDay(selectedLineupDayKey, nextStageName);
                            updateLineupRow(selectedLineupRow.client_id, { stage_name: nextStageName });
                          }}
                          className="rounded-md border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
                        >
                          + Stage
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <label className="block text-sm font-medium text-slate-700">Start</label>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => nudgeLineupRowTime(selectedLineupRow.client_id, 'start_time', -5)}
                            className="rounded-full border border-slate-300 px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
                          >
                            -5m
                          </button>
                          <button
                            type="button"
                            onClick={() => nudgeLineupRowTime(selectedLineupRow.client_id, 'start_time', 5)}
                            className="rounded-full border border-slate-300 px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
                          >
                            +5m
                          </button>
                        </div>
                      </div>
                      <input
                        type="time"
                        step={300}
                        value={selectedLineupRow.start_time}
                        onFocus={() => beginUndoInputSession(`lineup:${selectedLineupRow.client_id}:start_time`)}
                        onBlur={endUndoInputSession}
                        onChange={(event) => updateLineupRow(selectedLineupRow.client_id, { start_time: event.target.value })}
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <label className="block text-sm font-medium text-slate-700">End</label>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => nudgeLineupRowTime(selectedLineupRow.client_id, 'end_time', -5)}
                            className="rounded-full border border-slate-300 px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
                          >
                            -5m
                          </button>
                          <button
                            type="button"
                            onClick={() => nudgeLineupRowTime(selectedLineupRow.client_id, 'end_time', 5)}
                            className="rounded-full border border-slate-300 px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
                          >
                            +5m
                          </button>
                        </div>
                      </div>
                      <input
                        type="time"
                        step={300}
                        value={selectedLineupRow.end_time}
                        onFocus={() => beginUndoInputSession(`lineup:${selectedLineupRow.client_id}:end_time`)}
                        onBlur={endUndoInputSession}
                        onChange={(event) => updateLineupRow(selectedLineupRow.client_id, { end_time: event.target.value })}
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">Priority</label>
                      <input
                        value={selectedLineupRow.display_order}
                        onChange={(event) => updateLineupRow(selectedLineupRow.client_id, { display_order: event.target.value })}
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">Status</label>
                      <select
                        value={selectedLineupRow.announcement_status}
                        onChange={(event) => updateLineupRow(selectedLineupRow.client_id, { announcement_status: event.target.value as EventArtistStatus })}
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      >
                        {lineupStatusOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                      </select>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={selectedLineupRow.is_headliner}
                      onChange={(event) => updateLineupRow(selectedLineupRow.client_id, { is_headliner: event.target.checked })}
                    />
                    Headliner
                  </label>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">Note</label>
                    <textarea
                      value={selectedLineupRow.note}
                      onChange={(event) => updateLineupRow(selectedLineupRow.client_id, { note: event.target.value })}
                      rows={4}
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  {lineupOrderingState.mismatchMap.has(selectedLineupRow.client_id) && (
                    <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
                      현재 priority는 시간이 모두 입력된 뒤 예상되는 시간 순서와 다릅니다. 저장 시 해당 그룹의 시간이 모두 있으면 시간 순으로 반영됩니다.
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => void deleteLineupRow(selectedLineupRow)}
                    className="w-full rounded-md border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                  >
                    블록 삭제
                  </button>
                </div>
              </aside>
            )}

                {(activeSection === 'timetable') && (
              <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-3 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <h2 className="text-2xl font-semibold text-slate-900">Timetable Manager</h2>
                    <p className="mt-2 text-sm text-slate-500">스테이지별 시간표를 직접 입력하거나, 엑셀/TSV 붙여넣기로 한 번에 추가할 수 있습니다.</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleUndoEditor}
                    disabled={editorUndoStack.length === 0}
                    title="Ctrl/Cmd+Z"
                    className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Undo {editorUndoStack.length > 0 ? `(${editorUndoStack.length})` : ''}
                  </button>
                  <button
                    type="button"
                    onClick={handleRedoEditor}
                    disabled={editorRedoStack.length === 0}
                    title="Ctrl/Cmd+Shift+Z 또는 Ctrl/Cmd+Y"
                    className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Redo {editorRedoStack.length > 0 ? `(${editorRedoStack.length})` : ''}
                  </button>
                  <button
                    type="button"
                    onClick={() => quickAddTimetableRow(activeTimetableDayKey)}
                    className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                  >
                    선택한 Day 행 추가
                  </button>
                </div>

                <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">TSV import 예시</p>
                  <p className="mt-2 whitespace-pre-wrap text-xs leading-6 text-slate-600">
                    date	stage	order	artist	start	end	title	source
                    {'\n'}
                    2026-03-22	Stage126	3	Kiro Akiyama	14:30	15:20	Sony Music verified	manual
                  </p>
                  <textarea
                    value={timetableImportText}
                    onChange={(event) => setTimetableImportText(event.target.value)}
                    rows={5}
                    className="mt-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    placeholder="엑셀에서 복사한 표를 그대로 붙여넣으세요."
                  />
                  <div className="mt-3 flex gap-3">
                    <button type="button" onClick={importTimetableRows} className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white">붙여넣기 가져오기</button>
                    <p className="text-sm text-slate-500">시작/종료 시간은 `HH:mm` 또는 `YYYY-MM-DDTHH:mm` 형식을 지원합니다.</p>
                  </div>
                </div>

                {renderAdminDaySelector('timetable')}

                <div className="mt-6 space-y-4">
                  {visibleTimetableRows.map((row) => (
                    <div key={row.client_id} className="rounded-2xl border border-slate-200 p-4">
                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <input value={row.artist_name} onFocus={() => beginUndoInputSession(`timetable:${row.client_id}:artist_name`)} onBlur={endUndoInputSession} onChange={(event) => updateTimetableRow(row.client_id, { artist_name: event.target.value })} placeholder="아티스트명" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
                        <input value={row.stage_name} onFocus={() => beginUndoInputSession(`timetable:${row.client_id}:stage_name`)} onBlur={endUndoInputSession} onChange={(event) => updateTimetableRow(row.client_id, { stage_name: event.target.value })} placeholder="스테이지명" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
                        <select value={row.slot_type} onFocus={() => beginUndoInputSession(`timetable:${row.client_id}:slot_type`)} onBlur={endUndoInputSession} onChange={(event) => updateTimetableRow(row.client_id, { slot_type: event.target.value as ScheduleSlotType })} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
                          {scheduleTypeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                        </select>
                        <input value={row.title} onFocus={() => beginUndoInputSession(`timetable:${row.client_id}:title`)} onBlur={endUndoInputSession} onChange={(event) => updateTimetableRow(row.client_id, { title: event.target.value })} placeholder="타이틀/메모" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
                        <input type="datetime-local" value={row.start_at} onFocus={() => beginUndoInputSession(`timetable:${row.client_id}:start_at`)} onBlur={endUndoInputSession} onChange={(event) => updateTimetableRow(row.client_id, { start_at: event.target.value })} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
                        <input type="datetime-local" value={row.end_at} onFocus={() => beginUndoInputSession(`timetable:${row.client_id}:end_at`)} onBlur={endUndoInputSession} onChange={(event) => updateTimetableRow(row.client_id, { end_at: event.target.value })} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
                        <input value={row.source} onFocus={() => beginUndoInputSession(`timetable:${row.client_id}:source`)} onBlur={endUndoInputSession} onChange={(event) => updateTimetableRow(row.client_id, { source: event.target.value })} placeholder="source" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
                        <label className="flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700">
                          <input type="checkbox" checked={row.is_cancelled} onFocus={() => beginUndoInputSession(`timetable:${row.client_id}:is_cancelled`)} onBlur={endUndoInputSession} onChange={(event) => updateTimetableRow(row.client_id, { is_cancelled: event.target.checked })} />
                          취소됨
                        </label>
                      </div>
                      <div className="mt-4 flex justify-end">
                        <button type="button" onClick={() => void deleteTimetableRow(row)} className="text-sm text-red-600 hover:text-red-700">삭제</button>
                      </div>
                    </div>
                  ))}

                  {visibleTimetableRows.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
                      <p>{activeTimetableDayKey ? '선택한 Day에 타임테이블 행이 없습니다.' : '아직 타임테이블 행이 없습니다.'}</p>
                      <div className="mt-4 flex flex-wrap justify-center gap-3">
                        <button
                          type="button"
                          onClick={() => quickAddTimetableRow(activeTimetableDayKey || defaultAdminDayKey)}
                          className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
                        >
                          선택한 Day 행 추가
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setImportTarget('timetable');
                            setActiveSection('imports');
                          }}
                          className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                        >
                          import로 가져오기
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-6 flex gap-3">
                  <button type="button" onClick={() => void saveTimetableRows()} disabled={!isSupabaseReady || !selectedEventId || isSavingTimetable} className="rounded-md bg-indigo-600 px-4 py-2 text-white disabled:opacity-50">
                    {isSavingTimetable ? '저장 중...' : '타임테이블 저장'}
                  </button>
                </div>
              </section>
            )}

                {(activeSection === 'tickets') && (
              <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-3 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <h2 className="text-2xl font-semibold text-slate-900">Ticket Link Manager</h2>
                    <p className="mt-2 text-sm text-slate-500">예매처 링크와 판매 상태를 직접 수정하고, TSV로 한 번에 가져올 수 있습니다.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTicketRows((current) => [...current, createEmptyTicketRow()])}
                    className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                  >
                    행 추가
                  </button>
                </div>

                <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">TSV import 예시</p>
                  <p className="mt-2 whitespace-pre-wrap text-xs leading-6 text-slate-600">
                    provider	url	type	status	opens_at	price_note	is_primary
                    {'\n'}
                    Melon Ticket	https://ticket.melon.com/performance/index.htm?prodId=212651	general	open	2026-01-29T16:00	1일권 121,000원 / 2일권 193,000원	true
                  </p>
                  <textarea
                    value={ticketImportText}
                    onChange={(event) => setTicketImportText(event.target.value)}
                    rows={5}
                    className="mt-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    placeholder="엑셀에서 복사한 표를 그대로 붙여넣으세요."
                  />
                  <div className="mt-3 flex gap-3">
                    <button type="button" onClick={importTicketRows} className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white">붙여넣기 가져오기</button>
                    <p className="text-sm text-slate-500">primary 링크는 사용자 화면의 대표 CTA로 사용됩니다.</p>
                  </div>
                </div>

                <div className="mt-6 space-y-4">
                  {ticketRows.map((row) => (
                    <div key={row.client_id} className="rounded-2xl border border-slate-200 p-4">
                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <input value={row.provider_name} onChange={(event) => setTicketRows((current) => current.map((item) => item.client_id === row.client_id ? { ...item, provider_name: event.target.value } : item))} placeholder="예매처명" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
                        <input value={row.provider_code} onChange={(event) => setTicketRows((current) => current.map((item) => item.client_id === row.client_id ? { ...item, provider_code: event.target.value } : item))} placeholder="provider code" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
                        <select value={row.link_type} onChange={(event) => setTicketRows((current) => current.map((item) => item.client_id === row.client_id ? { ...item, link_type: event.target.value as TicketLinkType } : item))} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
                          {ticketTypeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                        </select>
                        <select value={row.sales_status} onChange={(event) => setTicketRows((current) => current.map((item) => item.client_id === row.client_id ? { ...item, sales_status: event.target.value as TicketSalesStatus } : item))} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
                          {ticketStatusOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                        </select>
                        <input value={row.url} onChange={(event) => setTicketRows((current) => current.map((item) => item.client_id === row.client_id ? { ...item, url: event.target.value } : item))} placeholder="https://..." className="rounded-md border border-slate-300 px-3 py-2 text-sm md:col-span-2" />
                        <input type="datetime-local" value={row.opens_at} onChange={(event) => setTicketRows((current) => current.map((item) => item.client_id === row.client_id ? { ...item, opens_at: event.target.value } : item))} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
                        <input type="datetime-local" value={row.ends_at} onChange={(event) => setTicketRows((current) => current.map((item) => item.client_id === row.client_id ? { ...item, ends_at: event.target.value } : item))} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
                        <input value={row.price_note} onChange={(event) => setTicketRows((current) => current.map((item) => item.client_id === row.client_id ? { ...item, price_note: event.target.value } : item))} placeholder="가격/권종 메모" className="rounded-md border border-slate-300 px-3 py-2 text-sm md:col-span-3" />
                        <label className="flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700">
                          <input type="checkbox" checked={row.is_primary} onChange={(event) => setTicketRows((current) => current.map((item) => item.client_id === row.client_id ? { ...item, is_primary: event.target.checked } : item))} />
                          primary CTA
                        </label>
                      </div>
                      <div className="mt-4 flex justify-end">
                        <button type="button" onClick={() => void deleteTicketRow(row)} className="text-sm text-red-600 hover:text-red-700">삭제</button>
                      </div>
                    </div>
                  ))}

                  {ticketRows.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
                      <p>아직 티켓 링크 행이 없습니다.</p>
                      <div className="mt-4 flex flex-wrap justify-center gap-3">
                        <button
                          type="button"
                          onClick={() => setTicketRows((current) => [...current, createEmptyTicketRow()])}
                          className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
                        >
                          첫 티켓 링크 추가
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-6 flex gap-3">
                  <button type="button" onClick={() => void saveTicketRows()} disabled={!isSupabaseReady || !selectedEventId || isSavingTickets} className="rounded-md bg-indigo-600 px-4 py-2 text-white disabled:opacity-50">
                    {isSavingTickets ? '저장 중...' : '티켓 링크 저장'}
                  </button>
                </div>
              </section>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
