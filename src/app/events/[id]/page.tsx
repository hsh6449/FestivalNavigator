'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import EventInfoBox from '@/components/events/EventInfoBox';
import EventReviews from '@/components/events/EventReviews';
import NotificationButton from '@/components/events/NotificationButton';
import VenueMap from '@/components/events/VenueMap';
import { fetchEventDetailById } from '@/lib/events';
import { FollowedArtist, getFollowedArtists, normalizeArtistName, toggleFollowedArtist } from '@/lib/followed-artists';
import { FestivalAct, FestivalDaySchedule, FestivalPOCContent, FestivalTab } from '@/lib/festival-content';
import {
  PlannerItem,
  PlannerItemType,
  combinePlannerDateTime,
  formatPlannerTime,
  getPlannerItemByLinkedSlotId,
  getPlannerItems,
  getLatestPlannerEnd,
  isPlannerItemCustomized,
  removePlannerItemsForScope,
  replacePlannerItems,
  removePlannerItem,
  upsertPlannerItem,
} from '@/lib/saved-timetable';
import { Event } from '@/types/database';

const tabs: FestivalTab[] = ['overview', 'lineup', 'timetable', 'map', 'tickets'];
const TIMELINE_INTERVAL_MINUTES = 5;
const TIMELINE_ROW_HEIGHT_PX = 16;
const MINI_TIMELINE_INTERVAL_MINUTES = 15;
const MINI_TIMELINE_ROW_HEIGHT_PX = 8;
const EMPTY_EVENT: Event = {
  id: '',
  title: '',
  artist: '',
  description: '',
  start_date: '',
  end_date: '',
  venue: '',
  venue_address: null,
  venue_lat: null,
  venue_lng: null,
  genre: '',
  event_type: null,
  image_url: null,
  price_range: null,
  ticket_url: null,
  ticket_open_time: null,
  age_limit: null,
  artist_profile: null,
  created_at: '',
  updated_at: '',
};

const formatScheduleTime = (start: string | null, end: string | null) => {
  if (start && end) return `${start} - ${end}`;
  if (start) return `${start} 시작`;
  if (end) return `${end} 종료 예정`;
  return '공식 타임테이블 세부 시간 연동 예정';
};

const placeholderStageNames = new Set(['Official lineup order']);

const isPlaceholderStage = (stage: string | null | undefined) =>
  Boolean(stage && placeholderStageNames.has(stage.trim()));

const formatStageLabel = (stage: string | null | undefined) => {
  if (!stage) return 'Stage TBD';
  if (isPlaceholderStage(stage)) return '공개 라인업 순서';
  return stage;
};

const compareFestivalActs = (left: FestivalAct, right: FestivalAct, preferTimeOrder = false) => {
  if (preferTimeOrder && left.start && right.start && left.start !== right.start) {
    return String(left.start).localeCompare(String(right.start));
  }

  if (left.order !== right.order) {
    return left.order - right.order;
  }

  return left.artist.localeCompare(right.artist);
};

const parseTimeToMinutes = (value: string | null | undefined) => {
  if (!value) return null;
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

const getDateTimeMinutes = (value: string | null) => {
  if (!value) return null;
  return parseTimeToMinutes(value.slice(11, 16));
};

const buildTimelineSlots = (
  startTime: string,
  endTime: string,
  intervalMinutes = TIMELINE_INTERVAL_MINUTES
) => {
  const startMinute = parseTimeToMinutes(startTime) ?? 10 * 60;
  const endMinute = Math.max(
    startMinute + intervalMinutes,
    parseTimeToMinutes(endTime) ?? 22 * 60
  );
  const slots: string[] = [];

  for (let current = startMinute; current <= endMinute; current += intervalMinutes) {
    slots.push(formatMinutesToTime(current));
  }

  return slots;
};

const getDayTimelineWindow = (
  day: FestivalDaySchedule,
  intervalMinutes = TIMELINE_INTERVAL_MINUTES
) => {
  const timedMinutes = day.acts
    .flatMap((act) => [act.start, act.end])
    .map((value) => parseTimeToMinutes(value))
    .filter((value): value is number => value !== null);

  if (timedMinutes.length === 0) return null;

  const minMinute = Math.min(...timedMinutes);
  const maxMinute = Math.max(...timedMinutes);
  const startMinute = Math.floor(minMinute / intervalMinutes) * intervalMinutes;
  const endMinute = Math.max(
    startMinute + 60,
    Math.ceil(maxMinute / intervalMinutes) * intervalMinutes
  );

  return {
    startTime: formatMinutesToTime(startMinute),
    endTime: formatMinutesToTime(endMinute),
  };
};

const getActTimelinePlacement = (
  act: FestivalAct,
  startTime: string,
  intervalMinutes = TIMELINE_INTERVAL_MINUTES
) => {
  const startMinute = parseTimeToMinutes(act.start);
  if (startMinute === null) return null;

  const endMinute = parseTimeToMinutes(act.end);
  const gridStartMinute = parseTimeToMinutes(startTime) ?? 10 * 60;
  const effectiveEndMinute = endMinute !== null && endMinute > startMinute
    ? endMinute
    : startMinute + 50;
  const rowStart = Math.max(1, Math.floor((startMinute - gridStartMinute) / intervalMinutes) + 1);
  const rowSpan = Math.max(1, Math.ceil((effectiveEndMinute - startMinute) / intervalMinutes));

  return { rowStart, rowSpan };
};

const getVisibleNote = (note?: string) => {
  if (!note) return null;
  if (note.includes('관리자 저장 데이터') || note.includes('시간 정보 업데이트 대기')) {
    return null;
  }
  return note;
};

const getDaySummary = (day: FestivalDaySchedule, fallbackStages: string[]) => {
  const stages = getStagesForDay(day, fallbackStages);
  const namedStages = stages.filter((stage) => !isPlaceholderStage(stage));
  const highlightCount = day.acts.filter((act) => act.highlight).length;
  const timedCount = day.acts.filter((act) => act.start && act.end).length;

  return {
    stageCount: namedStages.length > 0 ? namedStages.length : stages.length,
    hasPlaceholderStages: namedStages.length === 0 && stages.length > 0,
    highlightCount,
    timedCount,
  };
};

const getActsByStage = (day: FestivalDaySchedule, stage: string) => {
  const stageActs = day.acts.filter((act) => act.stage === stage);
  const shouldSortByTime =
    stageActs.length > 0 && stageActs.every((act) => Boolean(act.start) && Boolean(act.end));

  return stageActs.sort((left, right) => compareFestivalActs(left, right, shouldSortByTime));
};

const getStagesForDay = (day: FestivalDaySchedule, fallbackStages: string[]) => {
  const stagePositionMap = new Map<string, number>();
  const stagesWithActs = new Set(
    day.acts.map((act) => act.stage.trim()).filter(Boolean)
  );

  day.acts.forEach((act) => {
    if (!act.stage) return;
    const nextPosition = act.stagePosition ?? Number.MAX_SAFE_INTEGER;
    const currentPosition = stagePositionMap.get(act.stage) ?? Number.MAX_SAFE_INTEGER;
    stagePositionMap.set(act.stage, Math.min(currentPosition, nextPosition));
  });

  return Array.from(
    new Set([
      ...day.acts.map((act) => act.stage.trim()).filter(Boolean),
      ...fallbackStages.filter((stage) => stagesWithActs.has(stage)),
    ])
  ).sort((left, right) => {
    const leftPosition = stagePositionMap.get(left) ?? Number.MAX_SAFE_INTEGER;
    const rightPosition = stagePositionMap.get(right) ?? Number.MAX_SAFE_INTEGER;

    if (leftPosition !== rightPosition) {
      return leftPosition - rightPosition;
    }

    const leftFallbackIndex = fallbackStages.indexOf(left);
    const rightFallbackIndex = fallbackStages.indexOf(right);

    if (leftFallbackIndex !== -1 && rightFallbackIndex !== -1 && leftFallbackIndex !== rightFallbackIndex) {
      return leftFallbackIndex - rightFallbackIndex;
    }

    return left.localeCompare(right);
  });
};

const addMinutes = (dateTime: string, minutes: number) => {
  const parsed = new Date(dateTime);
  if (Number.isNaN(parsed.getTime())) return dateTime;
  parsed.setMinutes(parsed.getMinutes() + minutes);
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}T${String(parsed.getHours()).padStart(2, '0')}:${String(parsed.getMinutes()).padStart(2, '0')}`;
};

const getDayStartDateTime = (day: FestivalDaySchedule) => {
  const matched = day.startTimeLabel.match(/(\d{2}:\d{2})/);
  return combinePlannerDateTime(day.date, matched?.[1] ?? '11:00');
};

const getSnappedMinuteFromRelativeY = (
  relativeY: number,
  elementHeight: number,
  minMinute: number,
  maxMinute: number
) => {
  const totalMinutes = Math.max(5, maxMinute - minMinute);
  return (
    minMinute +
    Math.round(((Math.max(0, Math.min(relativeY, elementHeight)) / Math.max(elementHeight, 1)) * totalMinutes) / 5) * 5
  );
};

type DragDraft = {
  plannedStart: string;
  plannedEnd: string;
};

type DragState = {
  key: string;
  edge: 'start' | 'end';
  minMinute: number;
  maxMinute: number;
  currentStartMinute: number;
  currentEndMinute: number;
  date: string;
  item: PlannerItem;
};

type StickerDragState = {
  key: string;
  dayDate: string;
  item: PlannerItem;
  durationMinutes: number;
  minMinute: number;
  maxMinute: number;
  availableStages: string[];
};

type StickerDragDraft = {
  stage: string | null;
  plannedStart: string;
  plannedEnd: string;
};

type JourneyConnector = {
  id: string;
  moveItemId: string;
  startX: number;
  startY: number;
  midX: number;
  midY: number;
  endX: number;
  endY: number;
  routeY: number;
  controlOffset: number;
  label: string;
};

type LineupFilter = 'all' | 'followed' | 'highlights';

export default function EventDetailPage() {
  const params = useParams();
  const [event, setEvent] = useState<Event | null>(null);
  const [detail, setDetail] = useState<FestivalPOCContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FestivalTab>('overview');
  const [selectedDayByTab, setSelectedDayByTab] = useState<{ overview: string; lineup: string; timetable: string }>({
    overview: '',
    lineup: '',
    timetable: '',
  });
  const [plannerItems, setPlannerItems] = useState<PlannerItem[]>([]);
  const [plannerMessage, setPlannerMessage] = useState('');
  const [plannerTool, setPlannerTool] = useState<'default' | 'move'>('default');
  const [plannerViewMode, setPlannerViewMode] = useState<'all' | 'issues' | 'selected'>('all');
  const [pendingMoveSourceId, setPendingMoveSourceId] = useState<string | null>(null);
  const [dragDrafts, setDragDrafts] = useState<Record<string, DragDraft>>({});
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [stickerDragState, setStickerDragState] = useState<StickerDragState | null>(null);
  const [stickerDragDrafts, setStickerDragDrafts] = useState<Record<string, StickerDragDraft>>({});
  const [journeyConnectors, setJourneyConnectors] = useState<JourneyConnector[]>([]);
  const [selectedJourneyConnectorId, setSelectedJourneyConnectorId] = useState<string | null>(null);
  const [followedArtists, setFollowedArtists] = useState<FollowedArtist[]>([]);
  const [lineupFilter, setLineupFilter] = useState<LineupFilter>('all');
  const gridRef = useRef<HTMLDivElement | null>(null);
  const plannerBlockRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const stageColumnRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const activeEvent = event ?? EMPTY_EVENT;

  useEffect(() => {
    const run = async () => {
      try {
        const data = await fetchEventDetailById(String(params.id));
        setEvent(data.event);
        setDetail(data.detail);
      } catch (error) {
        console.error('Error fetching event:', error);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [params.id]);

  useEffect(() => {
    setPlannerItems(getPlannerItems());
  }, [event?.id]);

  useEffect(() => {
    setFollowedArtists(getFollowedArtists());
  }, []);

  useEffect(() => {
    if (!detail?.daySchedules.length) return;

    const firstDay = detail.daySchedules[0]?.date ?? '';
    setSelectedDayByTab((current) => ({
      overview: detail.daySchedules.some((day) => day.date === current.overview) ? current.overview : firstDay,
      lineup: detail.daySchedules.some((day) => day.date === current.lineup) ? current.lineup : firstDay,
      timetable: detail.daySchedules.some((day) => day.date === current.timetable) ? current.timetable : firstDay,
    }));
  }, [detail]);

  useEffect(() => {
    if (!plannerMessage) return;

    const timeout = window.setTimeout(() => {
      setPlannerMessage('');
    }, 2800);

    return () => window.clearTimeout(timeout);
  }, [plannerMessage]);

  useEffect(() => {
    if (!selectedJourneyConnectorId) return;
    if (journeyConnectors.some((connector) => connector.id === selectedJourneyConnectorId)) return;
    setSelectedJourneyConnectorId(null);
  }, [journeyConnectors, selectedJourneyConnectorId]);

  useEffect(() => {
    if (activeTab === 'timetable') return;
    if (plannerTool === 'default' && !pendingMoveSourceId) return;

    setPlannerTool('default');
    setPendingMoveSourceId(null);
  }, [activeTab, pendingMoveSourceId, plannerTool]);

  const getLinkedSlotId = useCallback(
    (day: FestivalDaySchedule, act: FestivalAct) =>
      `${activeEvent.id}::${day.date}::${act.stage}::${act.order}::${act.artist}`,
    [activeEvent.id]
  );

  const followedArtistLookup = new Set(
    followedArtists.map((artist) => artist.slug)
  );

  const isFollowedArtist = (artistName: string) =>
    followedArtistLookup.has(normalizeArtistName(artistName));

  const getFilteredActsForLineup = (acts: FestivalAct[]) => {
    if (lineupFilter === 'followed') {
      return acts.filter((act) => isFollowedArtist(act.artist));
    }

    if (lineupFilter === 'highlights') {
      return acts.filter((act) => act.highlight);
    }

    return acts;
  };

  const handleToggleArtistFollow = (act: Pick<FestivalAct, 'artist' | 'stage'>, day: FestivalDaySchedule) => {
    const result = toggleFollowedArtist({
      artistName: act.artist,
      eventId: activeEvent.id,
      eventTitle: activeEvent.title,
      date: day.date,
      stage: act.stage,
    });

    setFollowedArtists(result.artists);

    if (!result.followed && result.artists.length === 0 && lineupFilter === 'followed') {
      setLineupFilter('all');
    }
  };

  const syncPlannerItemsWithSource = useCallback((itemsToSync: PlannerItem[]) => {
    if (!detail) return itemsToSync;

    const sourceByLinkedSlotId = new Map<string, { day: FestivalDaySchedule; act: FestivalAct }>();

    detail.daySchedules.forEach((day) => {
      day.acts.forEach((act) => {
        sourceByLinkedSlotId.set(getLinkedSlotId(day, act), { day, act });
      });
    });

    let hasChanges = false;

    const nextItems = itemsToSync.map((item) => {
      if (item.eventId !== activeEvent.id || item.source !== 'festival-slot' || !item.linkedSlotId) {
        return item;
      }

      const source = sourceByLinkedSlotId.get(item.linkedSlotId);
      if (!source) {
        return item;
      }

      const nextDefaultStart = combinePlannerDateTime(source.day.date, source.act.start) || null;
      const nextDefaultEnd = combinePlannerDateTime(source.day.date, source.act.end) || null;
      const isCustomized = isPlannerItemCustomized(item);

      const nextItem: PlannerItem = {
        ...item,
        date: source.day.date,
        dayLabel: source.day.label,
        title: source.act.artist,
        stage: source.act.stage,
        artist: source.act.artist,
        order: source.act.order,
        defaultStart: nextDefaultStart,
        defaultEnd: nextDefaultEnd,
        plannedStart: isCustomized ? item.plannedStart : nextDefaultStart ?? item.plannedStart,
        plannedEnd: isCustomized ? item.plannedEnd : nextDefaultEnd ?? item.plannedEnd,
      };

      if (JSON.stringify(nextItem) !== JSON.stringify(item)) {
        hasChanges = true;
      }

      return nextItem;
    });

    if (!hasChanges) return itemsToSync;
    return replacePlannerItems(nextItems);
  }, [activeEvent.id, detail, getLinkedSlotId]);

  const getDayPlannerItems = useCallback(
    (date: string) =>
      plannerItems
        .filter((item) => item.eventId === activeEvent.id && item.date === date)
        .sort((left, right) => left.plannedStart.localeCompare(right.plannedStart)),
    [activeEvent.id, plannerItems]
  );

  const getDayManualPlannerItems = (date: string) =>
    getDayPlannerItems(date).filter((item) => item.linkedSlotId === null);

  const findFirstAvailablePlannerStart = (date: string, durationMinutes: number, fallbackStart: string) => {
    const sameDayItems = getDayPlannerItems(date);
    const dayEnd = combinePlannerDateTime(date, '23:55');
    let cursor = fallbackStart;

    while (cursor < dayEnd) {
      const candidateEnd = addMinutes(cursor, durationMinutes);
      const overlaps = sameDayItems.some(
        (item) => cursor < item.plannedEnd && item.plannedStart < candidateEnd
      );

      if (!overlaps) {
        return cursor;
      }

      cursor = addMinutes(cursor, TIMELINE_INTERVAL_MINUTES);
    }

    return sameDayItems[sameDayItems.length - 1]?.plannedEnd ?? fallbackStart;
  };

  const findGapPlacementForManualItem = (day: FestivalDaySchedule, durationMinutes: number) => {
    const sameDayItems = getDayPlannerItems(day.date)
      .filter((item) => item.itemType !== 'move')
      .sort((left, right) => left.plannedStart.localeCompare(right.plannedStart));

    const dayStart = getDayStartDateTime(day);
    const dayEnd = combinePlannerDateTime(day.date, '23:55');
    const latestRelevantItem = sameDayItems[sameDayItems.length - 1] ?? null;

    if (sameDayItems.length === 0) {
      return {
        start: dayStart,
        stage: detail ? getStagesForDay(day, detail.stages)[0] ?? null : null,
      };
    }

    const availableGaps: Array<{ start: string; stage: string | null; score: number }> = [];
    let previousItem: PlannerItem | null = null;

    for (const item of sameDayItems) {
      const gapStart = previousItem ? previousItem.plannedEnd : dayStart;
      const gapEnd = item.plannedStart;
      if (addMinutes(gapStart, durationMinutes) <= gapEnd) {
        const gapStartMinute = getDateTimeMinutes(gapStart) ?? 0;
        const gapEndMinute = getDateTimeMinutes(gapEnd) ?? gapStartMinute;
        const gapSpan = Math.max(0, gapEndMinute - gapStartMinute);
        const anchorMinute = latestRelevantItem
          ? getDateTimeMinutes(latestRelevantItem.plannedEnd) ?? gapStartMinute
          : gapStartMinute;
        const stagePenalty =
          latestRelevantItem?.stage &&
          (previousItem?.stage ?? item.stage ?? null) &&
          latestRelevantItem.stage !== (previousItem?.stage ?? item.stage ?? null)
            ? 20
            : 0;

        availableGaps.push({
          start: gapStart,
          stage: previousItem?.stage ?? item.stage ?? null,
          score: Math.abs(gapStartMinute - anchorMinute) + Math.max(0, gapSpan - durationMinutes) + stagePenalty,
        });
      }

      previousItem = item;
    }

    if (availableGaps.length > 0) {
      const bestGap = availableGaps.sort((left, right) => left.score - right.score)[0];
      return {
        start: bestGap.start,
        stage: bestGap.stage,
      };
    }

    const appendStart =
      latestRelevantItem && latestRelevantItem.plannedEnd < dayEnd
        ? latestRelevantItem.plannedEnd
        : sameDayItems[sameDayItems.length - 1]?.plannedEnd ?? dayStart;

    return {
      start: appendStart,
      stage: latestRelevantItem?.stage ?? sameDayItems[sameDayItems.length - 1]?.stage ?? null,
    };
  };

  const getItemDragKey = (item: PlannerItem) => item.linkedSlotId ?? item.id;
  const encodeMoveLinkNote = (sourceId: string, targetId: string) => `move-link::${sourceId}::${targetId}`;
  const parseMoveLinkNote = useCallback((note: string | null, candidates: PlannerItem[] = []) => {
    if (!note?.startsWith('move-link::')) return null;

    const naive = note.split('::');
    if (naive.length === 3) {
      const [, sourceId, targetId] = naive;
      if (sourceId && targetId) {
        return { sourceId, targetId };
      }
    }

    for (const source of candidates) {
      for (const target of candidates) {
        if (source.id === target.id) continue;
        if (note === encodeMoveLinkNote(source.id, target.id)) {
          return { sourceId: source.id, targetId: target.id };
        }
      }
    }

    return null;
  }, []);

  const getPlannerFeedback = (date: string) => {
    const plannerItemsForDay = getDayPlannerItems(date);
    const sameDayItems = plannerItemsForDay.filter((item) => item.itemType !== 'move');
    const moveItems = plannerItemsForDay.filter((item) => item.itemType === 'move');
    const conflictMap = new Map<string, number>();
    const tightMoveMap = new Map<string, number>();
    const moveLinks = new Set<string>();

    moveItems.forEach((item) => {
      const parsed = parseMoveLinkNote(item.note, sameDayItems);
      if (!parsed) return;
      moveLinks.add(`${parsed.sourceId}::${parsed.targetId}`);
      moveLinks.add(`${parsed.targetId}::${parsed.sourceId}`);
    });

    sameDayItems.forEach((item) => {
      let count = 0;

      sameDayItems.forEach((other) => {
        if (item.id === other.id) return;
        if (item.plannedStart < other.plannedEnd && other.plannedStart < item.plannedEnd) {
          count += 1;
        }
      });

      if (count > 0) {
        conflictMap.set(item.id, count);
      }
    });

    sameDayItems
      .slice()
      .sort((left, right) => left.plannedStart.localeCompare(right.plannedStart))
      .forEach((item, index, ordered) => {
        if (index === 0) return;
        const previous = ordered[index - 1];
        if (!previous.stage || !item.stage || previous.stage === item.stage) return;
        if (moveLinks.has(`${previous.id}::${item.id}`)) return;

        const previousEndMinute = getDateTimeMinutes(previous.plannedEnd);
        const currentStartMinute = getDateTimeMinutes(item.plannedStart);
        if (previousEndMinute === null || currentStartMinute === null) return;

        const gapMinutes = currentStartMinute - previousEndMinute;
        if (gapMinutes >= 0 && gapMinutes < 15) {
          tightMoveMap.set(item.id, gapMinutes);
        }
      });

    return {
      conflictMap,
      tightMoveMap,
      overlapCount: conflictMap.size,
      tightMoveCount: tightMoveMap.size,
    };
  };

  const buildPerformancePlannerItem = (
    day: FestivalDaySchedule,
    act: FestivalAct,
    overrides: Partial<Pick<PlannerItem, 'plannedStart' | 'plannedEnd' | 'note'>> = {}
  ): PlannerItem => {
    const linkedSlotId = getLinkedSlotId(day, act);
    const existing = getPlannerItemByLinkedSlotId(linkedSlotId);
    const fallbackStart = getLatestPlannerEnd(activeEvent.id, day.date, existing?.id) ?? getDayStartDateTime(day);
    const defaultStart = combinePlannerDateTime(day.date, act.start) || null;
    const defaultEnd = combinePlannerDateTime(day.date, act.end) || null;
    const plannedStart = existing?.plannedStart ?? defaultStart ?? fallbackStart;
    const plannedEnd = existing?.plannedEnd ?? defaultEnd ?? addMinutes(plannedStart, 50);

    return {
      id: existing?.id ?? `planner::${linkedSlotId}::${Date.now()}`,
      eventId: activeEvent.id,
      eventTitle: activeEvent.title,
      eventVenue: activeEvent.venue,
      eventImageUrl: activeEvent.image_url,
      linkedSlotId,
      date: day.date,
      dayLabel: day.label,
      itemType: 'performance',
      title: act.artist,
      stage: act.stage,
      artist: act.artist,
      plannedStart: overrides.plannedStart ?? plannedStart,
      plannedEnd: overrides.plannedEnd ?? plannedEnd,
      defaultStart,
      defaultEnd,
      order: act.order,
      note: overrides.note ?? existing?.note ?? act.note ?? null,
      source: 'festival-slot',
      isActive: true,
    };
  };

  const buildCustomPlannerItem = (
    day: FestivalDaySchedule,
    itemType: PlannerItemType = 'meal',
    options: {
      durationMinutes?: number;
      title?: string;
      stage?: string | null;
      note?: string | null;
    } = {}
  ): PlannerItem => {
    const durationMinutes = options.durationMinutes ?? (itemType === 'move' ? 20 : 60);
    const fallbackStart = findFirstAvailablePlannerStart(day.date, durationMinutes, getDayStartDateTime(day));
    const defaultStage = options.stage ?? (detail ? getStagesForDay(day, detail.stages)[0] ?? null : null);
    const defaultTitle =
      options.title ??
      (itemType === 'meal'
        ? '밥타임'
        : itemType === 'rest'
          ? '휴식'
          : itemType === 'move'
            ? '무대 이동'
            : '커스텀 일정');

    return {
      id: `planner::manual::${itemType}::${Date.now()}`,
      eventId: activeEvent.id,
      eventTitle: activeEvent.title,
      eventVenue: activeEvent.venue,
      eventImageUrl: activeEvent.image_url,
      date: day.date,
      dayLabel: day.label,
      itemType,
      title: defaultTitle,
      stage: defaultStage,
      artist: null,
      plannedStart: fallbackStart,
      plannedEnd: addMinutes(fallbackStart, durationMinutes),
      defaultStart: null,
      defaultEnd: null,
      order: null,
      note: options.note ?? null,
      source: 'manual',
      linkedSlotId: null,
      isActive: true,
    };
  };

  const buildContextualCustomPlannerItem = (
    day: FestivalDaySchedule,
    itemType: Exclude<PlannerItemType, 'performance' | 'move'>,
    options: {
      durationMinutes?: number;
      title?: string;
      note?: string | null;
    } = {}
  ) => {
    const candidate = buildCustomPlannerItem(day, itemType, options);
    const candidateDuration =
      (getDateTimeMinutes(candidate.plannedEnd) ?? 0) - (getDateTimeMinutes(candidate.plannedStart) ?? 0);
    const durationMinutes = Math.max(15, candidateDuration || 60);
    const placement = findGapPlacementForManualItem(day, durationMinutes);

    return {
      ...candidate,
      stage: placement.stage ?? candidate.stage,
      plannedStart: placement.start,
      plannedEnd: addMinutes(placement.start, durationMinutes),
    };
  };

  const savePlannerItemToState = (candidate: PlannerItem, successMessage: string) => {
    const result = upsertPlannerItem(candidate);

    if (!result.ok) {
      setPlannerMessage(result.message);
      return;
    }

    setPlannerItems(result.items);
    if (successMessage.trim()) {
      setPlannerMessage(successMessage);
    }
  };

  const getDraftRangeForItem = (item: PlannerItem) => dragDrafts[getItemDragKey(item)] ?? null;
  const getStickerDraftForItem = (item: PlannerItem) => stickerDragDrafts[item.id] ?? null;

  const commitPlannerRangeAtPoint = (
    item: PlannerItem,
    date: string,
    minMinute: number,
    maxMinute: number,
    relativeY: number,
    elementHeight: number,
    edge: 'start' | 'end'
  ) => {
    const snappedMinute = getSnappedMinuteFromRelativeY(relativeY, elementHeight, minMinute, maxMinute);
    const currentStartMinute = getDateTimeMinutes(item.plannedStart) ?? minMinute;
    const currentEndMinute = getDateTimeMinutes(item.plannedEnd) ?? maxMinute;
    let nextStartMinute = currentStartMinute;
    let nextEndMinute = currentEndMinute;

    if (edge === 'start') {
      nextStartMinute = Math.max(minMinute, Math.min(snappedMinute, currentEndMinute - 5));
    } else {
      nextEndMinute = Math.min(maxMinute, Math.max(snappedMinute, currentStartMinute + 5));
    }

    savePlannerItemToState(
      {
        ...item,
        plannedStart: combinePlannerDateTime(date, formatMinutesToTime(nextStartMinute)),
        plannedEnd: combinePlannerDateTime(date, formatMinutesToTime(nextEndMinute)),
      },
      edge === 'start' ? '입장 시간을 조정했습니다.' : '퇴장 시간을 조정했습니다.'
    );
  };

  const handleRemovePlannerItem = (itemId: string) => {
    setPlannerItems(removePlannerItem(itemId));
    if (pendingMoveSourceId === itemId) {
      setPendingMoveSourceId(null);
      setPlannerTool('default');
    }
    setPlannerMessage('계획에서 제거했습니다.');
  };

  const renderArtistFollowButton = (act: Pick<FestivalAct, 'artist' | 'stage'>, day: FestivalDaySchedule) => {
    const followed = isFollowedArtist(act.artist);

    return (
      <span
        role="button"
        tabIndex={0}
        onClick={(event) => {
          event.stopPropagation();
          handleToggleArtistFollow(act, day);
        }}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          event.stopPropagation();
          handleToggleArtistFollow(act, day);
        }}
        className={`inline-flex cursor-pointer rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
          followed
            ? 'bg-amber-300 text-slate-950 hover:bg-amber-200'
            : 'bg-white/90 text-slate-600 hover:bg-white'
        }`}
        aria-pressed={followed}
      >
        {followed ? 'Following' : '+ Follow'}
      </span>
    );
  };

  const handleResetPlannerDay = (date: string) => {
    setPlannerItems(removePlannerItemsForScope(activeEvent.id, date));
    setPendingMoveSourceId(null);
    setPlannerTool('default');
    setPlannerMessage('선택한 day의 개인 planner layer를 초기화했습니다.');
  };

  const handleResetPlannerEvent = () => {
    setPlannerItems(removePlannerItemsForScope(activeEvent.id));
    setPendingMoveSourceId(null);
    setPlannerTool('default');
    setPlannerMessage('이 이벤트의 개인 planner layer를 전체 초기화했습니다.');
  };

  const ensurePerformancePlannerItem = (day: FestivalDaySchedule, act: FestivalAct) => {
    const linkedSlotId = getLinkedSlotId(day, act);
    const existing = getPlannerItemByLinkedSlotId(linkedSlotId);

    if (existing) {
      return existing;
    }

    const candidate = buildPerformancePlannerItem(day, act);
    const result = upsertPlannerItem(candidate);

    if (!result.ok) {
      setPlannerMessage(result.message);
      return null;
    }

    setPlannerItems(result.items);
    return result.items.find((item) => item.id === candidate.id) ?? candidate;
  };

  const buildMovePlannerItemBetween = (
    day: FestivalDaySchedule,
    sourceItem: PlannerItem,
    targetItem: PlannerItem
  ) => {
    const [fromItem, toItem] =
      sourceItem.plannedStart <= targetItem.plannedStart
        ? [sourceItem, targetItem]
        : [targetItem, sourceItem];

    const moveItem = buildCustomPlannerItem(day, 'move');
    const anchorStart = fromItem.plannedEnd <= toItem.plannedStart ? fromItem.plannedEnd : toItem.plannedStart;
    const anchorEnd = fromItem.plannedEnd <= toItem.plannedStart ? toItem.plannedStart : fromItem.plannedEnd;

    return {
      ...moveItem,
      title: `${fromItem.stage ?? fromItem.title} -> ${toItem.stage ?? toItem.title}`,
      stage: fromItem.stage ?? toItem.stage,
      plannedStart: anchorStart,
      plannedEnd: anchorStart < anchorEnd ? anchorEnd : addMinutes(anchorStart, 5),
      note: encodeMoveLinkNote(sourceItem.id, targetItem.id),
    };
  };

  const togglePlannerSelection = (day: FestivalDaySchedule, act: FestivalAct) => {
    const linkedSlotId = getLinkedSlotId(day, act);
    const activeItem = getPlannerItemByLinkedSlotId(linkedSlotId);

    if (plannerTool === 'move') {
      const plannerItem = ensurePerformancePlannerItem(day, act);
      if (!plannerItem) return;

      if (!pendingMoveSourceId) {
        setPendingMoveSourceId(plannerItem.id);
        setPlannerMessage('Move 시작 block을 선택했습니다. 연결할 다음 block을 눌러주세요.');
        return;
      }

      if (pendingMoveSourceId === plannerItem.id) {
        setPendingMoveSourceId(null);
        setPlannerTool('default');
        setPlannerMessage('Move 연결을 취소했습니다.');
        return;
      }

      const sourceItem = getDayPlannerItems(day.date).find((item) => item.id === pendingMoveSourceId);
      if (!sourceItem) {
        setPendingMoveSourceId(plannerItem.id);
        setPlannerMessage('Move 시작 block을 다시 선택해주세요.');
        return;
      }

      const moveItem = buildMovePlannerItemBetween(day, sourceItem, plannerItem);
      savePlannerItemToState(moveItem, 'Move overlay를 추가했습니다.');
      setPendingMoveSourceId(null);
      setPlannerTool('default');
      return;
    }

    if (activeItem) {
      handleRemovePlannerItem(activeItem.id);
      return;
    }

    savePlannerItemToState(
      buildPerformancePlannerItem(day, act),
      '블록을 내 일정에 담았습니다.'
    );
  };

  const getPlannerSelectionMetrics = (day: FestivalDaySchedule, act: FestivalAct) => {
    const activeItem = getPlannerItemByLinkedSlotId(getLinkedSlotId(day, act));
    if (!activeItem || !act.start || !act.end) return null;
    const draftRange = getDraftRangeForItem(activeItem);

    const actStart = parseTimeToMinutes(act.start);
    const actEnd = parseTimeToMinutes(act.end);
    const plannedStart = parseTimeToMinutes((draftRange?.plannedStart ?? activeItem.plannedStart).slice(11, 16));
    const plannedEnd = parseTimeToMinutes((draftRange?.plannedEnd ?? activeItem.plannedEnd).slice(11, 16));

    if (
      actStart === null ||
      actEnd === null ||
      plannedStart === null ||
      plannedEnd === null ||
      actEnd <= actStart
    ) {
      return null;
    }

    const totalDuration = actEnd - actStart;
    const clampedStart = Math.max(actStart, Math.min(plannedStart, actEnd));
    const clampedEnd = Math.max(clampedStart, Math.min(plannedEnd, actEnd));

    return {
      topPercent: ((clampedStart - actStart) / totalDuration) * 100,
      heightPercent: Math.max(((clampedEnd - clampedStart) / totalDuration) * 100, 8),
      bottomPercent: 100 - (((clampedStart - actStart) / totalDuration) * 100 + Math.max(((clampedEnd - clampedStart) / totalDuration) * 100, 8)),
      label: `${formatPlannerTime(draftRange?.plannedStart ?? activeItem.plannedStart)} - ${formatPlannerTime(draftRange?.plannedEnd ?? activeItem.plannedEnd)}`,
    };
  };

  const getPlannerItemTimelinePlacement = (item: PlannerItem, startTime: string, endTime?: string | null) => {
    const draftRange = getDraftRangeForItem(item);
    const itemStart = parseTimeToMinutes((draftRange?.plannedStart ?? item.plannedStart).slice(11, 16));
    const itemEnd = parseTimeToMinutes((draftRange?.plannedEnd ?? item.plannedEnd).slice(11, 16));
    const gridStartMinute = parseTimeToMinutes(startTime) ?? 10 * 60;
    const gridEndMinute = parseTimeToMinutes(endTime) ?? 24 * 60;

    if (itemStart === null || itemEnd === null || itemEnd <= itemStart) {
      return null;
    }

    const visibleStart = Math.max(itemStart, gridStartMinute);
    const visibleEnd = Math.min(itemEnd, gridEndMinute);

    if (visibleEnd <= visibleStart) {
      return null;
    }

    return {
      rowStart: Math.max(1, Math.floor((visibleStart - gridStartMinute) / TIMELINE_INTERVAL_MINUTES) + 1),
      rowSpan: Math.max(1, Math.ceil((visibleEnd - visibleStart) / TIMELINE_INTERVAL_MINUTES)),
    };
  };

  const beginDragForItem = (
    item: PlannerItem,
    edge: 'start' | 'end',
    minMinute: number,
    maxMinute: number
  ) => {
    const currentStartMinute = getDateTimeMinutes(item.plannedStart);
    const currentEndMinute = getDateTimeMinutes(item.plannedEnd);

    if (currentStartMinute === null || currentEndMinute === null) return;

    setDragState({
      key: getItemDragKey(item),
      edge,
      minMinute,
      maxMinute,
      currentStartMinute,
      currentEndMinute,
      date: item.plannedStart.slice(0, 10),
      item,
    });
  };

  const beginStickerDragForItem = (
    day: FestivalDaySchedule,
    item: PlannerItem,
    startTime: string,
    endTime: string | null,
    availableStages: string[]
  ) => {
    const currentStartMinute = getDateTimeMinutes(item.plannedStart);
    const currentEndMinute = getDateTimeMinutes(item.plannedEnd);

    if (currentStartMinute === null || currentEndMinute === null) return;

    setStickerDragState({
      key: item.id,
      dayDate: day.date,
      item,
      durationMinutes: Math.max(5, currentEndMinute - currentStartMinute),
      minMinute: parseTimeToMinutes(startTime) ?? 10 * 60,
      maxMinute: parseTimeToMinutes(endTime) ?? 24 * 60,
      availableStages,
    });
  };

  const renderPlannerLane = (
    day: FestivalDaySchedule,
    startTime: string,
    rowCount: number,
    timelineSlots: string[]
  ) => {
    const manualPlannerItems = getDayManualPlannerItems(day.date).filter((item) => item.itemType !== 'move');
    const plannerFeedback = getPlannerFeedback(day.date);
    const conflictMap = plannerFeedback.conflictMap;
    const tightMoveMap = plannerFeedback.tightMoveMap;
    const isIssueFocus = plannerViewMode === 'issues';
    const isSelectedFocus = plannerViewMode === 'selected';
    const availableStages = detail ? getStagesForDay(day, detail.stages) : [];
    const boardRect = gridRef.current?.getBoundingClientRect() ?? null;

    return (
      <div className="pointer-events-none absolute inset-0 z-40">
        <div className="pointer-events-none relative h-full w-full">
          {stickerDragState?.dayDate === day.date ? (
            (() => {
              const draft = stickerDragDrafts[stickerDragState.key];
              const previewStage = draft?.stage ?? stickerDragState.item.stage ?? 'Any stage';
              const previewStart = formatPlannerTime(
                draft?.plannedStart ?? stickerDragState.item.plannedStart
              );
              const previewEnd = formatPlannerTime(
                draft?.plannedEnd ?? stickerDragState.item.plannedEnd
              );

              return (
                <div className="pointer-events-none absolute right-4 top-3 z-20 rounded-full border border-slate-300 bg-white/95 px-3 py-1.5 text-[11px] font-medium text-slate-700 shadow-sm backdrop-blur">
                  {previewStage} · {previewStart}
                  {stickerDragState.item.itemType !== 'custom' ? ` - ${previewEnd}` : ''}
                </div>
              );
            })()
          ) : null}
          {manualPlannerItems.map((item) => {
            const stickerDraft = getStickerDraftForItem(item);
            const visualItem = stickerDraft ? { ...item, ...stickerDraft } : item;
            const placement = getPlannerItemTimelinePlacement(
              visualItem,
              startTime,
              timelineSlots[timelineSlots.length - 1] ?? null
            );
            if (!placement) return null;
            const stageKey = visualItem.stage ? `${day.date}::${visualItem.stage}` : null;
            const stageRect =
              stageKey && boardRect ? stageColumnRefs.current[stageKey]?.getBoundingClientRect() ?? null : null;

            const itemTone =
              item.itemType === 'meal'
                ? 'border-slate-300 bg-white/95 text-slate-900'
                : item.itemType === 'rest'
                  ? 'border-slate-300 bg-white/95 text-slate-900'
                  : item.itemType === 'move'
                    ? 'border-slate-400 bg-slate-100/95 text-slate-900'
                    : 'border-slate-300 bg-white/95 text-slate-900';
            const itemLabelTone =
              item.itemType === 'meal'
                ? 'bg-orange-100 text-orange-800'
                : item.itemType === 'rest'
                  ? 'bg-sky-100 text-sky-800'
                  : item.itemType === 'move'
                    ? 'bg-slate-800 text-white'
                    : 'bg-slate-200 text-slate-700';
            const itemLabel =
              item.itemType === 'meal'
                ? 'MEAL'
                : item.itemType === 'rest'
                  ? 'REST'
                  : item.itemType === 'move'
                    ? 'MOVE'
                    : 'NOTE';
            const isMove = item.itemType === 'move';
            const conflictCount = conflictMap.get(item.id) ?? 0;
            const tightMoveMinutes = tightMoveMap.get(item.id);
            const hasIssue = conflictCount > 0 || tightMoveMinutes !== undefined;
            const shouldFade =
              (isIssueFocus && !hasIssue) ||
              (isSelectedFocus && false);
            const isDraggingSticker = stickerDragState?.key === item.id;
            const isCompactSticker = item.itemType === 'meal' || item.itemType === 'rest';
            const isNoteSticker = item.itemType === 'custom';
            const preferredWidth =
              isCompactSticker
                ? 92
                : isNoteSticker
                  ? 152
                  : 180;

            return (
              <div
                key={item.id}
                ref={(node) => {
                  plannerBlockRefs.current[item.id] = node;
                }}
                style={{
                  top: (placement.rowStart - 1) * TIMELINE_ROW_HEIGHT_PX + 6,
                  height: isCompactSticker
                    ? 92
                    : Math.max(placement.rowSpan * TIMELINE_ROW_HEIGHT_PX - 12, TIMELINE_ROW_HEIGHT_PX - 8),
                  ...(stageRect && boardRect
                    ? {
                        left: stageRect.left - boardRect.left + 12,
                        width: isCompactSticker
                          ? preferredWidth
                          : Math.max(Math.min(stageRect.width - 24, preferredWidth), 132),
                      }
                    : {
                        right: 12,
                        width: preferredWidth,
                      }),
                }}
                onMouseDown={(event) => {
                  const target = event.target as HTMLElement;
                  if (target.closest('button')) return;
                  event.preventDefault();
                  event.stopPropagation();
                  beginStickerDragForItem(
                    day,
                    item,
                    startTime,
                    timelineSlots[timelineSlots.length - 1] ?? null,
                    availableStages
                  );
                }}
                className={`pointer-events-auto absolute z-10 overflow-hidden ${isCompactSticker || isMove ? 'rounded-full' : 'rounded-2xl'} border ${isCompactSticker ? 'px-2 py-2' : isNoteSticker ? 'px-3 py-2.5' : 'px-3 py-3'} shadow-lg will-change-[top,left,height,width,transform] transition-[top,height,left,width,transform,background-color,border-color,opacity,box-shadow] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${isDraggingSticker ? 'cursor-grabbing opacity-90 scale-[1.02] shadow-xl' : 'cursor-grab hover:-translate-y-0.5'} ${shouldFade ? 'opacity-35 saturate-50' : ''} ${hasIssue ? 'ring-1 ring-inset ring-amber-200/80' : ''} ${itemTone}`}
              >
                {isMove && (
                  <div className="pointer-events-none absolute right-[-12px] top-1/2 h-6 w-6 -translate-y-1/2 rotate-45 border-r-2 border-t-2 border-slate-500 bg-white shadow-sm" />
                )}
                {isCompactSticker ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleRemovePlannerItem(item.id)}
                      className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-white/80 text-[10px] font-medium text-slate-500 hover:bg-white"
                    >
                      ×
                    </button>
                    <div className="flex h-full flex-col items-center justify-center text-center">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-[0.08em] shadow-sm ${itemLabelTone}`}>
                        {itemLabel}
                      </span>
                      <span className="mt-1 text-[10px] font-medium text-slate-500">
                        {formatPlannerTime(getStickerDraftForItem(item)?.plannedStart ?? item.plannedStart)}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold tracking-[0.12em] shadow-sm ${itemLabelTone}`}>
                        {itemLabel}
                      </span>
                      {conflictCount > 0 ? (
                        <div className="inline-flex rounded-full bg-rose-100 px-2 py-1 text-[10px] font-semibold text-rose-700 shadow-sm">
                          Overlap {conflictCount}
                        </div>
                      ) : tightMoveMinutes !== undefined ? (
                        <div className="inline-flex rounded-full bg-amber-100 px-2 py-1 text-[10px] font-semibold text-amber-700 shadow-sm">
                          Tight {tightMoveMinutes}m
                        </div>
                      ) : null}
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{item.title}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemovePlannerItem(item.id)}
                        className="rounded-full bg-white/80 px-2 py-1 text-[11px] font-medium text-slate-500 hover:bg-white"
                      >
                        x
                      </button>
                    </div>

                    <div className="mt-2 text-[11px] text-slate-600">
                      {formatPlannerTime(getStickerDraftForItem(item)?.plannedStart ?? getDraftRangeForItem(item)?.plannedStart ?? item.plannedStart)}
                      {!isNoteSticker
                        ? ` - ${formatPlannerTime(getStickerDraftForItem(item)?.plannedEnd ?? getDraftRangeForItem(item)?.plannedEnd ?? item.plannedEnd)}`
                        : ''}
                    </div>
                    {!isNoteSticker ? (
                      <div className="mt-2 inline-flex rounded-full bg-white/90 px-2 py-1 text-[10px] font-medium text-slate-600 shadow-sm">
                        {visualItem.stage ?? '아무 stage'}
                      </div>
                    ) : null}
                  </>
                )}
                <button
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    beginDragForItem(item, 'start', parseTimeToMinutes(startTime) ?? 10 * 60, parseTimeToMinutes(timelineSlots[timelineSlots.length - 1]) ?? 24 * 60);
                  }}
                  className="absolute inset-x-3 top-1 h-2 cursor-ns-resize rounded-full bg-white/90 shadow"
                  aria-label="시작 시간 드래그"
                />
                <button
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    beginDragForItem(item, 'end', parseTimeToMinutes(startTime) ?? 10 * 60, parseTimeToMinutes(timelineSlots[timelineSlots.length - 1]) ?? 24 * 60);
                  }}
                  className="absolute inset-x-3 bottom-1 h-2 cursor-ns-resize rounded-full bg-white/90 shadow"
                  aria-label="종료 시간 드래그"
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  useEffect(() => {
    if (!event || !detail) return;
    setPlannerItems(syncPlannerItemsWithSource(getPlannerItems()));
  }, [detail, event, syncPlannerItemsWithSource]);

  useEffect(() => {
    if (!dragState) return;

    const handleMouseMove = (event: MouseEvent) => {
      const element = plannerBlockRefs.current[dragState.key];
      if (!element) return;

      const rect = element.getBoundingClientRect();
      const relativeY = Math.max(0, Math.min(event.clientY - rect.top, rect.height));
      const totalMinutes = Math.max(5, dragState.maxMinute - dragState.minMinute);
      const snappedMinutes =
        dragState.minMinute +
        Math.round(((relativeY / Math.max(rect.height, 1)) * totalMinutes) / 5) * 5;

      let nextStartMinute = dragState.currentStartMinute;
      let nextEndMinute = dragState.currentEndMinute;

      if (dragState.edge === 'start') {
        nextStartMinute = Math.max(dragState.minMinute, Math.min(snappedMinutes, dragState.currentEndMinute - 5));
      } else {
        nextEndMinute = Math.min(dragState.maxMinute, Math.max(snappedMinutes, dragState.currentStartMinute + 5));
      }

      setDragDrafts((current) => ({
        ...current,
        [dragState.key]: {
          plannedStart: combinePlannerDateTime(dragState.date, formatMinutesToTime(nextStartMinute)),
          plannedEnd: combinePlannerDateTime(dragState.date, formatMinutesToTime(nextEndMinute)),
        },
      }));
    };

    const handleMouseUp = () => {
      const draft = dragDrafts[dragState.key];
      if (draft) {
        savePlannerItemToState(
          {
            ...dragState.item,
            plannedStart: draft.plannedStart,
            plannedEnd: draft.plannedEnd,
          },
          '색 영역을 조정해 시간을 업데이트했습니다.'
        );
      }

      setDragDrafts((current) => {
        const next = { ...current };
        delete next[dragState.key];
        return next;
      });
      setDragState(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragDrafts, dragState]);

  useEffect(() => {
    if (!stickerDragState) return;

    const handleMouseMove = (event: MouseEvent) => {
      const boardRect = gridRef.current?.getBoundingClientRect();
      if (!boardRect) return;

      const snappedMinuteRaw = getSnappedMinuteFromRelativeY(
        event.clientY - boardRect.top,
        boardRect.height,
        stickerDragState.minMinute,
        stickerDragState.maxMinute
      );
      const snappedMinute = Math.max(
        stickerDragState.minMinute,
        Math.min(snappedMinuteRaw, stickerDragState.maxMinute - stickerDragState.durationMinutes)
      );
      const plannedStart = combinePlannerDateTime(
        stickerDragState.dayDate,
        formatMinutesToTime(snappedMinute)
      );
      const plannedEnd = addMinutes(plannedStart, stickerDragState.durationMinutes);

      let nearestStage: string | null = stickerDragState.item.stage;
      let smallestDistance = Number.POSITIVE_INFINITY;
      let hoveredStage: string | null = null;

      stickerDragState.availableStages.forEach((stage) => {
        const rect = stageColumnRefs.current[`${stickerDragState.dayDate}::${stage}`]?.getBoundingClientRect();
        if (!rect) return;
        if (event.clientX >= rect.left - 24 && event.clientX <= rect.right + 24) {
          hoveredStage = stage;
        }
        const centerX = rect.left + rect.width / 2;
        const distance = Math.abs(event.clientX - centerX);
        if (distance < smallestDistance) {
          smallestDistance = distance;
          nearestStage = stage;
        }
      });

      setStickerDragDrafts((current) => ({
        ...current,
        [stickerDragState.key]: {
          stage: hoveredStage ?? nearestStage,
          plannedStart,
          plannedEnd,
        },
      }));
    };

    const handleMouseUp = () => {
      const draft = stickerDragDrafts[stickerDragState.key];
      if (draft) {
        savePlannerItemToState(
          {
            ...stickerDragState.item,
            stage: draft.stage,
            plannedStart: draft.plannedStart,
            plannedEnd: draft.plannedEnd,
          },
          '스티커 위치를 업데이트했습니다.'
        );
      }

      setStickerDragDrafts((current) => {
        const next = { ...current };
        delete next[stickerDragState.key];
        return next;
      });
      setStickerDragState(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [stickerDragDrafts, stickerDragState]);

  useEffect(() => {
    if (activeTab !== 'timetable' || !detail || !gridRef.current) {
      setJourneyConnectors([]);
      return;
    }

    const activeDay =
      detail.daySchedules.find((day) => day.date === selectedDayByTab.timetable) ??
      detail.daySchedules[0] ??
      null;

    if (!activeDay) {
      setJourneyConnectors([]);
      return;
    }

    const sameDayItems = getDayPlannerItems(activeDay.date);
    const moveItems = sameDayItems.filter((item) => item.itemType === 'move');
    const nonMoveItems = sameDayItems.filter((item) => item.itemType !== 'move');
    const boardRect = gridRef.current.getBoundingClientRect();
    const connectors: JourneyConnector[] = [];

    moveItems.forEach((item, index) => {
      const moveLink = parseMoveLinkNote(item.note, nonMoveItems);
      if (!moveLink) return;

      const previous = nonMoveItems.find((candidate) => candidate.id === moveLink.sourceId);
      const next = nonMoveItems.find((candidate) => candidate.id === moveLink.targetId);
      if (!previous || !next) return;

      const fromRef = plannerBlockRefs.current[getItemDragKey(previous)];
      const toRef = plannerBlockRefs.current[getItemDragKey(next)];
      if (!fromRef || !toRef) return;

      const fromRect = fromRef.getBoundingClientRect();
      const toRect = toRef.getBoundingClientRect();
      const start = getDateTimeMinutes(previous.plannedEnd);
      const end = getDateTimeMinutes(next.plannedStart);
      const rawGapMinutes = start !== null && end !== null ? end - start : null;
      const gapMinutes = rawGapMinutes !== null ? Math.max(0, rawGapMinutes) : null;
      const isForward = toRect.left >= fromRect.right;
      const startX = (isForward ? fromRect.right : fromRect.left) - boardRect.left;
      const endX = (isForward ? toRect.left : toRect.right) - boardRect.left;
      const midX = (startX + endX) / 2;
      const horizontalDistance = Math.abs(endX - startX);
      const startY = fromRect.top + fromRect.height / 2 - boardRect.top;
      const endY = toRect.top + toRect.height / 2 - boardRect.top;
      const verticalDistance = Math.abs(endY - startY);
      const travelBias = !isForward || horizontalDistance > 220 ? 1.2 : 1;
      const routeLift = Math.max(
        22,
        Math.min(72, (18 + horizontalDistance * 0.06 + verticalDistance * 0.18) * travelBias)
      );
      const routeY = Math.max(18, Math.min(startY, endY) - routeLift);
      const controlOffset = Math.max(32, Math.min(!isForward || horizontalDistance > 220 ? 88 : 56, horizontalDistance * 0.28));
      const midY = routeY;
      const isValidConnector =
        Number.isFinite(startX) &&
        Number.isFinite(startY) &&
        Number.isFinite(midX) &&
        Number.isFinite(midY) &&
        Number.isFinite(endX) &&
        Number.isFinite(endY) &&
        Number.isFinite(routeY) &&
        Number.isFinite(controlOffset);

      if (!isValidConnector) {
        return;
      }

      connectors.push({
        id: `${item.id}-${index}`,
        moveItemId: item.id,
        startX,
        startY,
        midX,
        midY,
        endX,
        endY,
        routeY,
        controlOffset,
        label:
          rawGapMinutes === null
            ? 'move'
            : rawGapMinutes < 0
              ? `${Math.abs(rawGapMinutes)}m overlap`
              : `${gapMinutes}m`,
      });
    });

    setJourneyConnectors(connectors);
  }, [activeTab, detail, getDayPlannerItems, parseMoveLinkNote, plannerItems, selectedDayByTab.timetable]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500 text-lg">공연 정보를 찾을 수 없습니다.</p>
      </div>
    );
  }

  const renderJourneyOverlay = () => {
    if (journeyConnectors.length === 0) return null;

    const selectedConnector =
      journeyConnectors.find((connector) => connector.id === selectedJourneyConnectorId) ?? null;
    const deleteButtonTop =
      selectedConnector && Number.isFinite(selectedConnector.routeY) ? Math.max(8, selectedConnector.routeY - 34) : null;
    const deleteButtonLeft =
      selectedConnector && Number.isFinite(selectedConnector.midX) ? selectedConnector.midX + 10 : null;

    return (
      <>
        <svg className="pointer-events-none absolute inset-0 z-30 h-full w-full overflow-visible">
          <defs>
            <marker id="journey-arrowhead" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
              <path d="M0,0 L7,3.5 L0,7 z" fill="#475569" />
            </marker>
          </defs>
          {journeyConnectors.map((connector) => {
            const horizontalDirection = connector.endX >= connector.startX ? 1 : -1;
            const curvePath = `M ${connector.startX} ${connector.startY}
                 C ${connector.startX + connector.controlOffset * horizontalDirection} ${connector.routeY},
                   ${connector.endX - connector.controlOffset * horizontalDirection} ${connector.routeY},
                   ${connector.endX} ${connector.endY}`;
            const labelY = connector.routeY - 8;
            const isSelected = connector.id === selectedJourneyConnectorId;
            const isRenderable =
              Number.isFinite(connector.startX) &&
              Number.isFinite(connector.startY) &&
              Number.isFinite(connector.midX) &&
              Number.isFinite(labelY) &&
              Number.isFinite(connector.endX) &&
              Number.isFinite(connector.endY);

            if (!isRenderable) {
              return null;
            }

            return (
              <g key={connector.id}>
                <path
                  d={curvePath}
                  fill="none"
                  stroke={isSelected ? '#1e293b' : '#475569'}
                  strokeWidth={isSelected ? 3 : 2.25}
                  markerEnd="url(#journey-arrowhead)"
                  className="pointer-events-auto cursor-pointer transition-all duration-200"
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedJourneyConnectorId((current) => (current === connector.id ? null : connector.id));
                  }}
                />
                <text
                  x={connector.midX}
                  y={labelY}
                  textAnchor="middle"
                  className="pointer-events-auto cursor-pointer fill-slate-700 text-[10px] font-semibold"
                  style={{ paintOrder: 'stroke', stroke: 'rgba(255,255,255,0.92)', strokeWidth: 3 }}
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedJourneyConnectorId((current) => (current === connector.id ? null : connector.id));
                  }}
                >
                  {connector.label}
                </text>
              </g>
            );
          })}
        </svg>
        {selectedConnector && deleteButtonTop !== null && deleteButtonLeft !== null ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              handleRemovePlannerItem(selectedConnector.moveItemId);
              setSelectedJourneyConnectorId(null);
            }}
            className="absolute z-40 flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 bg-white text-sm font-semibold text-slate-600 shadow-sm transition hover:border-rose-300 hover:text-rose-500"
            style={{ top: deleteButtonTop, left: deleteButtonLeft }}
            aria-label="이동 화살표 삭제"
          >
            ×
          </button>
        ) : null}
      </>
    );
  };

  const renderDayTimelineBoard = (
    day: FestivalDaySchedule,
    options: { showPlannerLane?: boolean } = {}
  ) => {
    if (!detail) return null;

    const stageOrder = getStagesForDay(day, detail.stages);
    const timelineWindow = getDayTimelineWindow(day);
    const unscheduledActs = day.acts.filter((act) => !act.start || !act.end || !act.stage.trim());

    if (stageOrder.length === 0) {
      return (
        <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
          아직 표시할 라인업이 없습니다.
        </div>
      );
    }

    if (!timelineWindow) {
      return (
        <div className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-3">
            {stageOrder.map((stage) => {
              const stageActs = getActsByStage(day, stage);
              if (stageActs.length === 0) return null;

              return (
                <div
                  key={`${day.date}-${stage}`}
                  ref={(node) => {
                    stageColumnRefs.current[`${day.date}::${stage}`] = node;
                  }}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="text-lg font-semibold text-slate-900">{stage}</h4>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-500">
                      {stageActs.length} acts
                    </span>
                  </div>

                  <div className="mt-4 space-y-3">
                    {stageActs.map((act) => {
                      const activeItem = getPlannerItemByLinkedSlotId(getLinkedSlotId(day, act));
                      const isActive = Boolean(activeItem);
                      const isMoveAnchor = activeItem?.id === pendingMoveSourceId;

                      return (
                      <button
                        key={`${day.date}-${stage}-${act.order}-${act.artist}`}
                        type="button"
                        onClick={() => togglePlannerSelection(day, act)}
                        className={`w-full rounded-2xl p-4 text-left transition-colors ${
                          isActive
                            ? 'border border-slate-400 bg-slate-100'
                            : 'bg-white hover:bg-slate-100'
                        } ${isMoveAnchor ? 'ring-2 ring-slate-700 ring-offset-2' : ''}`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                            Slot {act.order}
                          </span>
                          <div className="flex items-center gap-2">
                            {isFollowedArtist(act.artist) && (
                              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-900">
                                Following
                              </span>
                            )}
                            {act.highlight && (
                              <span className="rounded-full bg-amber-300 px-2.5 py-1 text-xs font-semibold text-slate-950">
                                Highlight
                              </span>
                            )}
                            {renderArtistFollowButton(act, day)}
                          </div>
                        </div>
                        <p className="mt-2 text-lg font-semibold text-slate-900">{act.artist}</p>
                        {isMoveAnchor && (
                          <div className="mt-2 inline-flex rounded-full bg-slate-900 px-2 py-1 text-[10px] font-semibold text-white">
                            Move start
                          </div>
                        )}
                        {getVisibleNote(act.note) && (
                          <p className="mt-1 text-sm text-slate-500">{getVisibleNote(act.note)}</p>
                        )}
                      </button>
                    )})}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    const timelineSlots = buildTimelineSlots(timelineWindow.startTime, timelineWindow.endTime);
    const rowCount = Math.max(1, timelineSlots.length - 1);
    const timedStageOrder = stageOrder.filter((stage) =>
      getActsByStage(day, stage).some((act) => act.start && act.end)
    );
    const plannerFeedback = getPlannerFeedback(day.date);
    const conflictMap = plannerFeedback.conflictMap;
    const tightMoveMap = plannerFeedback.tightMoveMap;
    const sameDayPlannerItems = getDayPlannerItems(day.date).filter((item) => item.itemType !== 'move');
    const isIssueFocus = options.showPlannerLane && plannerViewMode === 'issues';
    const isSelectedFocus = options.showPlannerLane && plannerViewMode === 'selected';
    const activeStickerStage =
      stickerDragState?.dayDate === day.date
        ? stickerDragDrafts[stickerDragState.key]?.stage ?? stickerDragState.item.stage
        : null;
    const selectedStageNames = new Set(
      sameDayPlannerItems.map((item) => item.stage).filter((stage): stage is string => Boolean(stage))
    );
    const issueStageNames = new Set(
      sameDayPlannerItems
        .filter((item) => (conflictMap.get(item.id) ?? 0) > 0 || tightMoveMap.has(item.id))
        .map((item) => item.stage)
        .filter((stage): stage is string => Boolean(stage))
    );
    const visibleTimedStageOrder = timedStageOrder.filter((stage) => {
      if (isIssueFocus) {
        return issueStageNames.has(stage);
      }
      if (isSelectedFocus) {
        return selectedStageNames.has(stage);
      }
      return true;
    });

    if (options.showPlannerLane && (isIssueFocus || isSelectedFocus) && visibleTimedStageOrder.length === 0) {
      return (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center">
          <p className="text-sm font-semibold text-slate-900">
            {isIssueFocus ? '현재 바로 손볼 문제는 없습니다.' : '아직 선택한 block이 없습니다.'}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            {isIssueFocus
              ? '전체 보기로 돌아가 다른 블록을 확인하거나, 겹치는 일정을 먼저 만들어 비교할 수 있습니다.'
              : '공연 블록을 눌러 먼저 담아두면 선택한 일정만 집중해서 볼 수 있습니다.'}
          </p>
          <button
            type="button"
            onClick={() => setPlannerViewMode('all')}
            className="mt-4 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            전체 보기로 돌아가기
          </button>
        </div>
      );
    }

    return (
      <div className="space-y-4 overflow-x-auto">
        <div
          ref={gridRef}
          className="relative min-w-[980px]"
        >
          <div
            className="grid gap-4"
            style={{ gridTemplateColumns: `88px repeat(${Math.max(visibleTimedStageOrder.length, 1)}, minmax(220px, 1fr))` }}
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

            {visibleTimedStageOrder.map((stage) => {
              const timedActs = getActsByStage(day, stage).filter((act) => act.start && act.end);
              const stageIssueCount = timedActs.reduce((count, act) => {
                const activeItem = getPlannerItemByLinkedSlotId(getLinkedSlotId(day, act));
                if (!activeItem) return count;
                const hasOverlap = (conflictMap.get(activeItem.id) ?? 0) > 0;
                const hasTightMove = tightMoveMap.has(activeItem.id);
                return hasOverlap || hasTightMove ? count + 1 : count;
              }, 0);
              const stageSelectedCount = timedActs.reduce((count, act) => {
                const activeItem = getPlannerItemByLinkedSlotId(getLinkedSlotId(day, act));
                return activeItem ? count + 1 : count;
              }, 0);

              return (
                <div
                  key={`${day.date}-${stage}`}
                  ref={(node) => {
                    stageColumnRefs.current[`${day.date}::${stage}`] = node;
                  }}
                  className={`rounded-2xl border bg-slate-50 p-4 transition-[background-color,border-color,opacity,box-shadow] duration-200 ${
                    activeStickerStage === stage
                      ? 'border-slate-500 bg-slate-100 shadow-[0_0_0_2px_rgba(71,85,105,0.12)]'
                      : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-slate-900">{stage}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span>{timedActs.length} scheduled</span>
                        {stageIssueCount > 0 ? (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-700">
                            {stageIssueCount} issue
                          </span>
                        ) : null}
                        {stageSelectedCount > 0 && isSelectedFocus ? (
                          <span className="rounded-full bg-slate-200 px-2 py-0.5 font-semibold text-slate-700">
                            {stageSelectedCount} selected
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div
                    className="relative mt-4 grid overflow-hidden rounded-2xl border border-slate-200 bg-white"
                    style={{ gridTemplateRows: `repeat(${rowCount}, minmax(${TIMELINE_ROW_HEIGHT_PX}px, ${TIMELINE_ROW_HEIGHT_PX}px))` }}
                  >
                    {timelineSlots.slice(0, -1).map((slot, index) => (
                      <div
                        key={`${day.date}-${stage}-${slot}`}
                        className="pointer-events-none border-t border-slate-100 bg-slate-50/40 first:border-t-0"
                        style={{ gridRow: index + 1 }}
                      />
                    ))}

                    {timedActs.map((act) => {
                      const placement = getActTimelinePlacement(act, timelineWindow.startTime);
                      if (!placement) return null;
                      const linkedSlotId = getLinkedSlotId(day, act);
                      const activeItem = getPlannerItemByLinkedSlotId(linkedSlotId);
                      const isActive = Boolean(activeItem);
                      const isMoveAnchor = activeItem?.id === pendingMoveSourceId;
                      const selectionMetrics = getPlannerSelectionMetrics(day, act);
                      const isArtistFollowed = isFollowedArtist(act.artist);
                      const conflictCount = activeItem ? conflictMap.get(activeItem.id) ?? 0 : 0;
                      const tightMoveMinutes = activeItem ? tightMoveMap.get(activeItem.id) : undefined;
                      const hasIssue = conflictCount > 0 || tightMoveMinutes !== undefined;
                      const shouldFade =
                        (isIssueFocus && !hasIssue) ||
                        (isSelectedFocus && !isActive);

                      return (
                        <div
                          key={`${day.date}-${stage}-${act.order}-${act.artist}`}
                          ref={(node) => {
                            plannerBlockRefs.current[linkedSlotId] = node;
                          }}
                          style={{ gridRow: `${placement.rowStart} / span ${placement.rowSpan}` }}
                        className={`relative z-10 mx-2 my-1 overflow-hidden rounded-xl border px-3 py-3 shadow-sm transition-[background-color,border-color,box-shadow,opacity,transform] duration-200 ease-out ${
                            isActive
                              ? 'border-slate-400 bg-slate-100'
                              : isArtistFollowed
                                ? 'border-amber-200 bg-amber-50/70'
                                : 'border-slate-200 bg-white'
                          } ${shouldFade ? 'opacity-35 saturate-50' : ''} ${hasIssue ? 'ring-1 ring-inset ring-amber-200/80' : ''} ${isMoveAnchor ? 'ring-2 ring-slate-700 ring-offset-2' : ''}`}
                        >
                          {selectionMetrics && (
                            <>
                              {selectionMetrics.topPercent > 0 ? (
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    if (!activeItem) return;
                                    event.stopPropagation();
                                    const rect =
                                      plannerBlockRefs.current[linkedSlotId]?.getBoundingClientRect();
                                    if (!rect) return;
                                    commitPlannerRangeAtPoint(
                                      activeItem,
                                      day.date,
                                      parseTimeToMinutes(act.start) ?? 0,
                                      parseTimeToMinutes(act.end) ?? 24 * 60,
                                      event.clientY - rect.top,
                                      rect.height,
                                      'start'
                                    );
                                  }}
                                  className="absolute inset-x-0 top-0 z-[5] bg-white/65 transition-[height,opacity,background-color] duration-200 ease-out hover:bg-white/80"
                                  style={{ height: `${selectionMetrics.topPercent}%` }}
                                  aria-label="입장 시간을 빠르게 조정"
                                />
                              ) : null}
                              {selectionMetrics.bottomPercent > 0 ? (
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    if (!activeItem) return;
                                    event.stopPropagation();
                                    const rect =
                                      plannerBlockRefs.current[linkedSlotId]?.getBoundingClientRect();
                                    if (!rect) return;
                                    commitPlannerRangeAtPoint(
                                      activeItem,
                                      day.date,
                                      parseTimeToMinutes(act.start) ?? 0,
                                      parseTimeToMinutes(act.end) ?? 24 * 60,
                                      event.clientY - rect.top,
                                      rect.height,
                                      'end'
                                    );
                                  }}
                                  className="absolute inset-x-0 bottom-0 z-[5] bg-white/65 transition-[height,opacity,background-color] duration-200 ease-out hover:bg-white/80"
                                  style={{ height: `${selectionMetrics.bottomPercent}%` }}
                                  aria-label="퇴장 시간을 빠르게 조정"
                                />
                              ) : null}
                              <div
                                className="pointer-events-none absolute inset-x-1 rounded-lg border border-slate-400/60 bg-slate-400/30 transition-[top,height,opacity] duration-200 ease-out"
                                style={{
                                  top: `${selectionMetrics.topPercent}%`,
                                  height: `${selectionMetrics.heightPercent}%`,
                                }}
                              />
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => togglePlannerSelection(day, act)}
                            className="relative z-10 block w-full text-left"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="text-sm font-semibold text-slate-900">{act.artist}</p>
                                <p className="mt-1 text-xs text-slate-500">{formatScheduleTime(act.start, act.end)}</p>
                                {isArtistFollowed && (
                                  <div className="mt-2 inline-flex rounded-full bg-amber-100 px-2 py-1 text-[10px] font-semibold text-amber-900 shadow-sm">
                                    Following
                                  </div>
                                )}
                                {isMoveAnchor && (
                                  <div className="mt-2 inline-flex rounded-full bg-slate-900 px-2 py-1 text-[10px] font-semibold text-white shadow-sm">
                                    Move start
                                  </div>
                                )}
                                {conflictCount > 0 && (
                                  <div className="mt-2 inline-flex rounded-full bg-rose-100 px-2 py-1 text-[10px] font-semibold text-rose-700 shadow-sm">
                                    Overlap {conflictCount}
                                  </div>
                                )}
                                {!conflictCount && tightMoveMinutes !== undefined && (
                                  <div className="mt-2 inline-flex rounded-full bg-amber-100 px-2 py-1 text-[10px] font-semibold text-amber-700 shadow-sm">
                                    Tight move {tightMoveMinutes}m
                                  </div>
                                )}
                                {getVisibleNote(act.note) && (
                                  <p className="mt-1 text-xs text-slate-500">{getVisibleNote(act.note)}</p>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                {renderArtistFollowButton(act, day)}
                                {act.highlight && (
                                  <span className="rounded-full bg-amber-300 px-2 py-1 text-[11px] font-semibold text-slate-950">
                                    H
                                  </span>
                                )}
                              </div>
                            </div>
                          </button>
                          {isActive && activeItem && (
                            <>
                              <button
                                type="button"
                                onMouseDown={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  beginDragForItem(
                                    activeItem,
                                    'start',
                                    parseTimeToMinutes(act.start) ?? 0,
                                    parseTimeToMinutes(act.end) ?? 24 * 60
                                  );
                                }}
                                className="absolute inset-x-3 top-1 z-20 flex h-4 cursor-ns-resize items-center justify-center rounded-full border border-slate-200 bg-white/95 shadow transition hover:scale-[1.02]"
                                aria-label="관람 시작 시간 드래그"
                              >
                                <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-500">In</span>
                              </button>
                              <button
                                type="button"
                                onMouseDown={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  beginDragForItem(
                                    activeItem,
                                    'end',
                                    parseTimeToMinutes(act.start) ?? 0,
                                    parseTimeToMinutes(act.end) ?? 24 * 60
                                  );
                                }}
                                className="absolute inset-x-3 bottom-1 z-20 flex h-4 cursor-ns-resize items-center justify-center rounded-full border border-slate-200 bg-white/95 shadow transition hover:scale-[1.02]"
                                aria-label="관람 종료 시간 드래그"
                              >
                                <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-500">Out</span>
                              </button>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {options.showPlannerLane && renderPlannerLane(day, timelineWindow.startTime, rowCount, timelineSlots)}
          {renderJourneyOverlay()}
        </div>

        {unscheduledActs.length > 0 && !options.showPlannerLane && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">Time TBD</p>
                <p className="mt-1 text-xs text-slate-500">아직 확정 시간이 없는 라인업입니다.</p>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-500">
                {unscheduledActs.length} acts
              </span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {unscheduledActs.map((act) => {
                const activeItem = getPlannerItemByLinkedSlotId(getLinkedSlotId(day, act));
                const isActive = Boolean(activeItem);
                const isMoveAnchor = activeItem?.id === pendingMoveSourceId;
                const isArtistFollowed = isFollowedArtist(act.artist);
                const conflictCount = activeItem ? conflictMap.get(activeItem.id) ?? 0 : 0;
                const tightMoveMinutes = activeItem ? tightMoveMap.get(activeItem.id) : undefined;
                const hasIssue = conflictCount > 0 || tightMoveMinutes !== undefined;
                const shouldFade =
                  (isIssueFocus && !hasIssue) ||
                  (isSelectedFocus && !isActive);

                return (
                <button
                  key={`${day.date}-${act.stage}-${act.order}-${act.artist}-unscheduled`}
                  type="button"
                  onClick={() => togglePlannerSelection(day, act)}
                  className={`rounded-xl border px-3 py-3 text-left transition-[background-color,border-color,opacity] ${
                    isActive
                      ? 'border-slate-400 bg-slate-100'
                      : isArtistFollowed
                        ? 'border-amber-200 bg-amber-50/70 hover:bg-amber-50'
                        : 'border-slate-200 bg-white hover:bg-slate-100'
                  } ${shouldFade ? 'opacity-35 saturate-50' : ''} ${hasIssue ? 'ring-1 ring-inset ring-amber-200/80' : ''} ${isMoveAnchor ? 'ring-2 ring-slate-700 ring-offset-2' : ''}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">{act.artist}</p>
                    {renderArtistFollowButton(act, day)}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{formatStageLabel(act.stage)} · Slot {act.order}</p>
                  {isArtistFollowed && (
                    <div className="mt-2 inline-flex rounded-full bg-amber-100 px-2 py-1 text-[10px] font-semibold text-amber-900">
                      Following
                    </div>
                  )}
                  {isMoveAnchor && (
                    <div className="mt-2 inline-flex rounded-full bg-slate-900 px-2 py-1 text-[10px] font-semibold text-white">
                      Move start
                    </div>
                  )}
                  {conflictCount > 0 && (
                    <div className="mt-2 inline-flex rounded-full bg-rose-100 px-2 py-1 text-[10px] font-semibold text-rose-700">
                      Overlap {conflictCount}
                    </div>
                  )}
                  {!conflictCount && tightMoveMinutes !== undefined && (
                    <div className="mt-2 inline-flex rounded-full bg-amber-100 px-2 py-1 text-[10px] font-semibold text-amber-700">
                      Tight move {tightMoveMinutes}m
                    </div>
                  )}
                  {getVisibleNote(act.note) && (
                    <p className="mt-1 text-xs text-slate-500">{getVisibleNote(act.note)}</p>
                  )}
                </button>
              )})}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderOverviewMiniTimeline = (day: FestivalDaySchedule) => {
    if (!detail) return null;

    const stageOrder = getStagesForDay(day, detail.stages);
    const timelineWindow = getDayTimelineWindow(day, MINI_TIMELINE_INTERVAL_MINUTES);
    const timedStageOrder = stageOrder.filter((stage) =>
      getActsByStage(day, stage).some((act) => act.start && act.end)
    );

    if (!timelineWindow || timedStageOrder.length === 0) {
      return (
        <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
          아직 미니 timetable에 표시할 확정 시간이 없습니다.
        </div>
      );
    }

    const timelineSlots = buildTimelineSlots(
      timelineWindow.startTime,
      timelineWindow.endTime,
      MINI_TIMELINE_INTERVAL_MINUTES
    );
    const rowCount = Math.max(1, timelineSlots.length - 1);

    return (
      <div className="overflow-x-auto">
        <div
          className="grid min-w-[540px] gap-2"
          style={{ gridTemplateColumns: `52px repeat(${Math.max(timedStageOrder.length, 1)}, minmax(120px, 1fr))` }}
        >
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Time</p>
            <div
              className="mt-3 grid"
              style={{ gridTemplateRows: `repeat(${rowCount}, minmax(${MINI_TIMELINE_ROW_HEIGHT_PX}px, ${MINI_TIMELINE_ROW_HEIGHT_PX}px))` }}
            >
              {timelineSlots.slice(0, -1).map((slot, index) => (
                <div key={`overview-mini-${day.date}-${slot}`} className="border-t border-slate-200 px-1 pt-0.5 text-[10px] text-slate-500 first:border-t-0">
                  {index % Math.max(1, Math.floor(60 / MINI_TIMELINE_INTERVAL_MINUTES)) === 0 ? slot : ''}
                </div>
              ))}
            </div>
          </div>

          {timedStageOrder.map((stage) => {
            const timedActs = getActsByStage(day, stage).filter((act) => act.start && act.end);

            return (
              <div key={`overview-mini-${day.date}-${stage}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-2">
                <div className="border-b border-slate-200 pb-2">
                  <p className="text-xs font-semibold text-slate-900">{stage}</p>
                </div>
                <div
                  className="relative mt-2 grid overflow-hidden rounded-2xl border border-slate-200 bg-white"
                  style={{ gridTemplateRows: `repeat(${rowCount}, minmax(${MINI_TIMELINE_ROW_HEIGHT_PX}px, ${MINI_TIMELINE_ROW_HEIGHT_PX}px))` }}
                >
                  {timelineSlots.slice(0, -1).map((slot, index) => (
                    <div
                      key={`overview-mini-grid-${day.date}-${stage}-${slot}`}
                      className="pointer-events-none border-t border-slate-100 bg-slate-50/40 first:border-t-0"
                      style={{ gridRow: index + 1 }}
                    />
                  ))}

                  {timedActs.map((act) => {
                    const placement = getActTimelinePlacement(
                      act,
                      timelineWindow.startTime,
                      MINI_TIMELINE_INTERVAL_MINUTES
                    );
                    if (!placement) return null;

                    return (
                      <div
                        key={`overview-mini-card-${day.date}-${stage}-${act.order}-${act.artist}`}
                        style={{ gridRow: `${placement.rowStart} / span ${placement.rowSpan}` }}
                        className="relative z-10 mx-1 my-0.5 overflow-hidden rounded-lg border border-slate-200 bg-white px-2 py-1 shadow-sm"
                      >
                        <p className="truncate text-[11px] font-semibold text-slate-900">{act.artist}</p>
                        <p className="mt-0.5 text-[10px] text-slate-500">{formatScheduleTime(act.start, act.end)}</p>
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
  };

  const renderOverview = () => {
    if (!detail) {
      return (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <EventInfoBox event={event} />
        </div>
      );
    }

    const activeOverviewDay =
      detail.daySchedules.find((day) => day.date === selectedDayByTab.overview) ??
      detail.daySchedules[0] ??
      null;
    const overviewStages = Array.from(
      new Set(detail.daySchedules.flatMap((day) => getStagesForDay(day, detail.stages)))
    );
    const openPlannerForDay = (date: string) => {
      setSelectedDayByTab((current) => ({ ...current, timetable: date }));
      setActiveTab('timetable');
    };

    return (
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-semibold text-slate-900">Festival Overview</h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">{detail.tagline}</p>
          <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm leading-7 text-amber-950">
            {detail.heroNote}
          </p>
          <p className="mt-4 text-sm leading-7 text-slate-600">{activeEvent.description}</p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {detail.factCards.map((fact) => (
              <div key={fact.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{fact.label}</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">{fact.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {detail.lineupSummary.map((artist) => (
              <button
                key={artist}
                type="button"
                onClick={() => {
                  const dayContext = activeOverviewDay ?? detail.daySchedules[0];
                  if (!dayContext) return;
                  handleToggleArtistFollow(
                    { artist, stage: 'Lineup summary' },
                    dayContext
                  );
                }}
                className={`rounded-full px-3 py-1 text-sm font-medium transition ${
                  isFollowedArtist(artist)
                    ? 'bg-amber-300 text-slate-950'
                    : 'bg-amber-50 text-amber-900 hover:bg-amber-100'
                }`}
              >
                {isFollowedArtist(artist) ? `Following · ${artist}` : artist}
              </button>
            ))}
          </div>

          <div className="mt-8">
            <EventInfoBox event={event} />
          </div>
        </div>

        <div className="space-y-6">
          {activeOverviewDay && (
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Mini Timetable</h3>
                  <p className="mt-1 text-sm text-slate-500">{activeOverviewDay.label}를 overview에서 바로 훑어보는 미리보기입니다.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                    {activeOverviewDay.startTimeLabel.replace('공연 시작 ', '')}
                  </span>
                  <button
                    type="button"
                    onClick={() => openPlannerForDay(activeOverviewDay.date)}
                    className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                  >
                    이 Day 일정 짜기
                  </button>
                </div>
              </div>
              <div className="mt-4">{renderDayMenu('overview')}</div>
              <div className="mt-4">{renderOverviewMiniTimeline(activeOverviewDay)}</div>
            </div>
          )}

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Plan This Festival</h3>
            <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
              {detail.plannerTips.map((tip) => (
                <div key={tip} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  {tip}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Stages</h3>
            <div className="mt-4 flex flex-wrap gap-2">
              {overviewStages.map((stage) => (
                <span key={stage} className="rounded-full border border-slate-200 px-3 py-1 text-sm text-slate-600">
                  {formatStageLabel(stage)}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Verified Sources</h3>
            <div className="mt-4 space-y-4">
              {detail.sources.map((source) => (
                <a
                  key={source.label}
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-2xl border border-slate-200 p-4 transition-colors hover:border-amber-300 hover:bg-amber-50"
                >
                  <p className="text-sm font-semibold text-slate-900">{source.label}</p>
                  <p className="mt-1 text-sm text-slate-500">{source.note}</p>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderDayMenu = (tab: 'overview' | 'lineup' | 'timetable') => {
    if (!detail || detail.daySchedules.length <= 1) return null;

    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {detail.daySchedules.map((day) => {
            const summary = getDaySummary(day, detail.stages);

            return (
            <button
              key={`${tab}-${day.date}`}
              type="button"
              onClick={() => setSelectedDayByTab((current) => ({ ...current, [tab]: day.date }))}
              className={`rounded-2xl border px-4 py-4 text-left transition-colors ${
                selectedDayByTab[tab] === day.date
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">{day.label}</p>
                  <p className={`mt-1 text-xs ${selectedDayByTab[tab] === day.date ? 'text-slate-300' : 'text-slate-500'}`}>
                    {day.date}
                  </p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  selectedDayByTab[tab] === day.date ? 'bg-white/15 text-white' : 'bg-white text-slate-500'
                }`}>
                  {day.startTimeLabel.replace('공연 시작 ', '')}
                </span>
              </div>
              <div className={`mt-3 flex flex-wrap gap-2 text-[11px] ${
                selectedDayByTab[tab] === day.date ? 'text-slate-200' : 'text-slate-500'
              }`}>
                <span>{summary.hasPlaceholderStages ? 'stage 공개 전' : `${summary.stageCount} stages`}</span>
                <span>{summary.highlightCount} highlights</span>
                <span>{summary.timedCount} timed sets</span>
              </div>
            </button>
            );
          })}
        </div>
      </div>
    );
  };

  const renderLineup = () => {
    if (!detail) return null;
    const activeDay =
      detail.daySchedules.find((day) => day.date === selectedDayByTab.lineup) ??
      detail.daySchedules[0] ??
      null;
    if (!activeDay) return null;
    const filteredActiveDay =
      lineupFilter === 'all'
        ? activeDay
        : {
            ...activeDay,
            acts: getFilteredActsForLineup(activeDay.acts),
          };
    const followedActsCount = activeDay.acts.filter((act) => isFollowedArtist(act.artist)).length;

    return (
      <div className="space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-semibold text-slate-900">Lineup</h2>
          <p className="mt-3 text-sm leading-7 text-slate-500">
            저장된 시간은 stage별 세로 시간축으로 바로 반영하고, 시간이 아직 없는 아티스트는 별도 `Time TBD` 구역에 분리해 보여줍니다.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-1">
              <button
                type="button"
                onClick={() => setLineupFilter('all')}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                  lineupFilter === 'all'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-white'
                }`}
              >
                전체 라인업
              </button>
              <button
                type="button"
                onClick={() => setLineupFilter('followed')}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                  lineupFilter === 'followed'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-white'
                }`}
              >
                팔로우만 보기 {followedArtists.length > 0 ? `(${followedArtists.length})` : ''}
              </button>
              <button
                type="button"
                onClick={() => setLineupFilter('highlights')}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                  lineupFilter === 'highlights'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-white'
                }`}
              >
                Highlight만 보기
              </button>
            </div>
            {followedArtists.length > 0 ? (
              <div className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900">
                이 Day에서 팔로우한 아티스트 {followedActsCount}명
              </div>
            ) : (
              <div className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600">
                아티스트를 팔로우하면 라인업과 알림 화면에서 따로 모아볼 수 있습니다.
              </div>
            )}
          </div>
        </div>
        {renderDayMenu('lineup')}

        <div key={filteredActiveDay.date} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-2 border-b border-slate-200 pb-5 md:flex-row md:items-end md:justify-between">
            <div>
              <h3 className="text-2xl font-semibold text-slate-900">{filteredActiveDay.label}</h3>
              <p className="mt-1 text-sm text-slate-500">{filteredActiveDay.date}</p>
            </div>
            <p className="text-sm text-slate-500">{filteredActiveDay.startTimeLabel}</p>
          </div>

          <div className="mt-6">
            {filteredActiveDay.acts.length > 0 ? (
              renderDayTimelineBoard(filteredActiveDay)
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center">
                <p className="text-sm font-semibold text-slate-900">
                  {lineupFilter === 'followed'
                    ? '이 날짜에는 아직 팔로우한 아티스트가 없습니다.'
                    : '이 날짜에는 highlight로 표시된 아티스트가 없습니다.'}
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  필터를 바꾸거나 overview/lineup 카드에서 아티스트를 먼저 팔로우해보세요.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderTimetable = () => {
    if (!detail) return null;
    const activeDay =
      detail.daySchedules.find((day) => day.date === selectedDayByTab.timetable) ??
      detail.daySchedules[0] ??
      null;
    if (!activeDay) return null;
    const activeDayPlannerItems = getDayPlannerItems(activeDay.date);
    const activeDayFeedback = getPlannerFeedback(activeDay.date);
    const totalIssueCount = activeDayFeedback.overlapCount + activeDayFeedback.tightMoveCount;
    const totalSelectedCount = activeDayPlannerItems.filter((item) => item.itemType !== 'move').length;
    const hasEventPlannerItems = plannerItems.some((item) => item.eventId === activeEvent.id);
    const stickerActionItems = [
      { type: 'meal' as const, label: 'Meal' },
      { type: 'rest' as const, label: 'Rest' },
      { type: 'custom' as const, label: 'Note' },
    ];
    const freeBlockPresets = [
      { label: '15m', durationMinutes: 15 },
      { label: '30m', durationMinutes: 30 },
      { label: '60m', durationMinutes: 60 },
      { label: '90m', durationMinutes: 90 },
    ];

    return (
      <div className="space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-semibold text-slate-900">Timetable Planner</h2>
          <p className="mt-3 text-sm leading-7 text-slate-500">
            공연 블록을 눌러 일정에 담고, 실제로 볼 구간은 회색 범위로 바로 조정하세요. 식사나 휴식은 sticker처럼 올려서 같은 시트 위에서 함께 짤 수 있습니다.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-1">
              <button
                type="button"
                onClick={() => setPlannerViewMode('all')}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                  plannerViewMode === 'all'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-white'
                }`}
              >
                전체 보기
              </button>
              <button
                type="button"
                onClick={() => setPlannerViewMode('issues')}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                  plannerViewMode === 'issues'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-white'
                }`}
              >
                문제만 보기 {totalIssueCount > 0 ? `(${totalIssueCount})` : ''}
              </button>
              <button
                type="button"
                onClick={() => setPlannerViewMode('selected')}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                  plannerViewMode === 'selected'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-white'
                }`}
              >
                선택한 것만 보기 {totalSelectedCount > 0 ? `(${totalSelectedCount})` : ''}
              </button>
            </div>
            <div className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600">
              선택한 block {totalSelectedCount}
            </div>
            {activeDayFeedback.overlapCount > 0 ? (
              <div className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700">
                Overlap {activeDayFeedback.overlapCount}
              </div>
            ) : null}
            {activeDayFeedback.tightMoveCount > 0 ? (
              <div className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
                Tight move {activeDayFeedback.tightMoveCount}
              </div>
            ) : null}
          </div>
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            {plannerViewMode === 'all'
              ? '먼저 담고, 필요한 구간만 회색 범위로 줄여보세요. 충돌은 나중에 정리해도 됩니다.'
              : plannerViewMode === 'issues'
                ? '겹치거나 이동이 빠듯한 block이 있는 stage만 남겨서 보여줍니다.'
                : '선택한 block이 있는 stage만 남겨서, 실제 내 동선만 빠르게 훑어볼 수 있습니다.'}
          </div>
          {plannerMessage && (
            <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">{plannerMessage}</p>
          )}
          <Link
            href="/my-timetable"
            className="mt-4 inline-flex rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            저장한 일정 보기
          </Link>
        </div>
        {renderDayMenu('timetable')}

        <div key={activeDay.date} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h3 className="text-2xl font-semibold text-slate-900">{activeDay.label}</h3>
              <p className="mt-1 text-sm text-slate-500">{activeDay.date}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2 py-2">
                <span className="px-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                  Sticker
                </span>
                {stickerActionItems.map((item) => (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => {
                      savePlannerItemToState(
                        buildContextualCustomPlannerItem(activeDay, item.type),
                        `${item.label} 스티커를 일정 시트에 추가했습니다.`
                      );
                    }}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2 py-2">
                <span className="px-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                  Free Block
                </span>
                {freeBlockPresets.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      savePlannerItemToState(
                        buildContextualCustomPlannerItem(activeDay, 'custom', {
                          durationMinutes: preset.durationMinutes,
                          title: `자유 일정 ${preset.label}`,
                          note: `${preset.label} 자유 블록`,
                        }),
                        `${preset.label} 자유 블록을 일정 시트에 추가했습니다.`
                      );
                    }}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => {
                  const isActivating = plannerTool !== 'move';
                  setPlannerTool(isActivating ? 'move' : 'default');
                  setPendingMoveSourceId(null);
                  setPlannerMessage(
                    isActivating
                      ? 'Move 모드입니다. 연결할 두 block을 순서대로 눌러주세요.'
                      : 'Move 모드를 종료했습니다.'
                  );
                }}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                  plannerTool === 'move'
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-300 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {plannerTool === 'move' ? 'Move 연결 중' : 'Move'}
              </button>
              <p className="text-sm text-slate-500">{activeDay.startTimeLabel}</p>
            </div>
          </div>
          {activeDayPlannerItems.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleResetPlannerDay(activeDay.date)}
                className="rounded-full border border-red-200 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
              >
                {activeDay.label} reset
              </button>
              {hasEventPlannerItems && (
                <button
                  type="button"
                  onClick={handleResetPlannerEvent}
                  className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  이 이벤트 planner 전체 reset
                </button>
              )}
            </div>
          )}

          <div className="mt-6">{renderDayTimelineBoard(activeDay, { showPlannerLane: true })}</div>
        </div>
      </div>
    );
  };

  const renderMap = () => {
    if (!detail) return null;

    return (
      <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-semibold text-slate-900">Map & Route</h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            현재 위치에서 공연장까지 길찾기를 열고, 실내 멀티홀 페스티벌 기준으로 이동 감각을 미리 잡는 용도의 POC입니다.
          </p>
          <div className="mt-6">
            <VenueMap
              title={activeEvent.title}
              venue={activeEvent.venue}
              address={activeEvent.venue_address}
              latitude={activeEvent.venue_lat}
              longitude={activeEvent.venue_lng}
            />
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">이동 팁</h3>
          <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
            {detail.transportTips.map((tip) => (
              <p key={tip}>{tip}</p>
            ))}
          </div>

          <div className="mt-6 space-y-3">
            {detail.travelLinks.map((link) => (
              <a
                key={link.label}
                href={link.url}
                target="_blank"
                rel="noreferrer"
                className="block rounded-2xl border border-slate-200 p-4 transition-colors hover:border-amber-300 hover:bg-amber-50"
              >
                <p className="text-sm font-semibold text-slate-900">{link.label}</p>
                <p className="mt-1 text-sm text-slate-500">{link.note}</p>
              </a>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderTickets = () => {
    if (!detail) return null;

    return (
      <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-semibold text-slate-900">Tickets</h2>
          <div className="mt-6 space-y-4">
            {detail.ticketLinks.map((ticket) => (
              <a
                key={ticket.label}
                href={ticket.url}
                target="_blank"
                rel="noreferrer"
                className="block rounded-2xl border border-slate-200 p-4 transition-colors hover:border-amber-300 hover:bg-amber-50"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-lg font-semibold text-slate-900">{ticket.label}</p>
                    <p className="mt-1 text-sm text-slate-500">{ticket.note}</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                    {ticket.status}
                  </span>
                </div>
              </a>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">예매 전 체크</h3>
          <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
            <p>현재는 공식 멜론티켓 링크와 오픈 공지를 함께 묶어두고, 판매 상태는 운영자가 검수하는 구조가 가장 안전합니다.</p>
            <p>후속 단계에서는 날짜별 권종, 얼리버드 여부, 품절 상태를 ticket_links 테이블로 분리해 구조화할 수 있습니다.</p>
            <p>실서비스 배포 전에는 예매 URL을 자동 노출하기보다 공식 링크 검수 단계를 두는 편이 좋습니다.</p>
          </div>

          <div className="mt-6 space-y-3">
            {detail.sources.map((source) => (
              <a
                key={`ticket-source-${source.label}`}
                href={source.url}
                target="_blank"
                rel="noreferrer"
                className="block rounded-2xl border border-slate-200 p-4 transition-colors hover:border-slate-400"
              >
                <p className="text-sm font-semibold text-slate-900">{source.label}</p>
                <p className="mt-1 text-sm text-slate-500">{source.note}</p>
              </a>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderTabPanel = () => {
    if (!detail) {
      return renderOverview();
    }

    if (activeTab === 'overview') return renderOverview();
    if (activeTab === 'lineup') return renderLineup();
    if (activeTab === 'timetable') return renderTimetable();
    if (activeTab === 'map') return renderMap();
    return renderTickets();
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f6f3ed_0%,#f9fbff_40%,#ffffff_100%)] py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-lg">
          {activeEvent.image_url && (
            <div className="relative h-96">
              <Image
                src={activeEvent.image_url}
                alt={activeEvent.title}
                fill
                unoptimized
                sizes="100vw"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.12),rgba(15,23,42,0.55))]" />
              {detail && (
                <div className="absolute bottom-0 left-0 right-0 p-8 text-white">
                  <p className="text-sm uppercase tracking-[0.24em] text-amber-200">
                    {detail.city} Festival
                  </p>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-200">{detail.tagline}</p>
                </div>
              )}
            </div>
          )}
          {!activeEvent.image_url && detail && (
            <div className="relative overflow-hidden border-b border-slate-200 bg-[radial-gradient(circle_at_top_left,#f8d66d_0%,#f8d66d_14%,#13212c_38%,#101b25_100%)] text-white">
              <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.08),transparent_45%,rgba(255,255,255,0.03)_100%)]" />
              <div className="relative grid gap-6 px-6 py-10 md:grid-cols-[1.15fr_0.85fr] md:px-8">
                <div>
                  <p className="text-sm uppercase tracking-[0.24em] text-amber-100">
                    {detail.city} Festival
                  </p>
                  <p className="mt-4 max-w-3xl text-xl font-semibold leading-8 text-white sm:text-2xl">
                    {detail.tagline}
                  </p>
                  <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-200">
                    {detail.heroNote}
                  </p>
                  <div className="mt-6 flex flex-wrap gap-2 text-xs text-slate-100">
                    <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5">
                      {detail.daySchedules.length} days
                    </span>
                    <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5">
                      {detail.stages.length} stages
                    </span>
                    <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5">
                      verified sources {detail.sources.length}
                    </span>
                    <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5">
                      ticket links {detail.ticketLinks.length}
                    </span>
                  </div>
                </div>

                <div className="rounded-[1.75rem] border border-white/10 bg-white/10 p-5 backdrop-blur-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-100">
                    Festival Snapshot
                  </p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {detail.factCards.slice(0, 4).map((fact) => (
                      <div key={fact.label} className="rounded-2xl bg-white/10 px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">
                          {fact.label}
                        </p>
                        <p className="mt-2 text-sm font-semibold text-white">{fact.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="p-6">
            <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">{activeEvent.title}</h1>
                <p className="mt-2 text-base text-gray-600 md:text-xl">{activeEvent.artist}</p>
              </div>
              {detail && (
                <span className="inline-flex h-fit rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
                  Actual festival seed
                </span>
              )}
            </div>

            <div className="my-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">공연 액션</h2>
                  <p className="mt-1 text-sm text-gray-600">
                    로그인하면 티켓 오픈이나 공연 시작 알림을 저장할 수 있습니다.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  {activeEvent.ticket_open_time && (
                    <NotificationButton
                      eventId={activeEvent.id}
                      type="ticketing"
                      label="티켓 오픈 알림"
                    />
                  )}
                  <NotificationButton
                    eventId={activeEvent.id}
                    type="start"
                    label="공연 시작 알림"
                  />
                  {activeEvent.ticket_url && (
                    <a
                      href={activeEvent.ticket_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center rounded-md border border-indigo-200 bg-white px-4 py-2 text-indigo-600 transition-colors hover:bg-indigo-50 hover:text-indigo-700"
                    >
                      티켓 예매 바로가기
                    </a>
                  )}
                </div>
              </div>
            </div>

            {detail && (
              <div className="sticky top-16 z-20 -mx-2 mb-8 border-b border-slate-200 bg-white/95 px-2 pb-4 pt-2 backdrop-blur">
                <div className="flex flex-wrap gap-3">
                {tabs.map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                      activeTab === tab
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {tab === 'overview' && 'Overview'}
                    {tab === 'lineup' && 'Lineup'}
                    {tab === 'timetable' && 'Timetable'}
                    {tab === 'map' && 'Map'}
                    {tab === 'tickets' && 'Tickets'}
                  </button>
                ))}
                </div>
              </div>
            )}

            <div className="mt-8">{renderTabPanel()}</div>

            {activeEvent.artist_profile && (
              <div className="mt-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">아티스트 소개</h2>
                <p className="text-gray-600 whitespace-pre-line">{activeEvent.artist_profile}</p>
              </div>
            )}

            <div className="mt-8">
              <EventReviews eventId={activeEvent.id} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
