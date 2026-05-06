import { createClient, hasSupabaseEnv } from '@/lib/supabase/client';
import { FestivalDaySchedule, FestivalPOCContent, FestivalTicketLink, getFestivalContentForEvent } from '@/lib/festival-content';
import { decodeLineupNote } from '@/lib/lineup-metadata';
import { mockEvents } from '@/lib/mock-events';
import { Event, EventArtist, EventStage, ScheduleSlot, TicketLink } from '@/types/database';

const apiUrl = process.env.NEXT_PUBLIC_EVENTS_API_URL;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const toEvent = (data: unknown): Event | null => {
  if (!isRecord(data)) return null;

  return {
    id: String(data.id ?? ''),
    title: String(data.title ?? ''),
    artist: String(data.artist ?? ''),
    description: String(data.description ?? ''),
    start_date: String(data.start_date ?? ''),
    end_date: String(data.end_date ?? ''),
    venue: String(data.venue ?? ''),
    venue_address: data.venue_address ? String(data.venue_address) : null,
    venue_lat: typeof data.venue_lat === 'number' ? data.venue_lat : null,
    venue_lng: typeof data.venue_lng === 'number' ? data.venue_lng : null,
    genre: String(data.genre ?? ''),
    event_type:
      data.event_type === 'festival' || data.event_type === 'concert'
        ? data.event_type
        : null,
    image_url: data.image_url ? String(data.image_url) : null,
    price_range: data.price_range ? String(data.price_range) : null,
    ticket_url: data.ticket_url ? String(data.ticket_url) : null,
    ticket_open_time: data.ticket_open_time ? String(data.ticket_open_time) : null,
    age_limit: data.age_limit ? String(data.age_limit) : null,
    artist_profile: data.artist_profile ? String(data.artist_profile) : null,
    created_at: String(data.created_at ?? ''),
    updated_at: String(data.updated_at ?? ''),
  };
};

const coerceEvents = (payload: unknown): Event[] => {
  if (!Array.isArray(payload)) return [];
  return payload.map(toEvent).filter((event): event is Event => Boolean(event));
};

const mergeEventsWithMocks = (events: Event[]) => {
  const merged = new Map<string, Event>();

  mockEvents.forEach((event) => {
    merged.set(event.id, event);
  });

  events.forEach((event) => {
    merged.set(event.id, event);
  });

  return Array.from(merged.values()).sort((left, right) => left.start_date.localeCompare(right.start_date));
};

const findMockEventById = (id: string) => mockEvents.find((event) => event.id === id) ?? null;

const formatTime = (value: string | null | undefined) => (value ? String(value).slice(11, 16) : null);

const formatTicketStatus = (status: TicketLink['sales_status']): FestivalTicketLink['status'] => {
  if (status === 'open') return 'open';
  if (status === 'upcoming') return 'coming_soon';
  return 'sold_out';
};

const getDateRange = (startDate: string, endDate: string) => {
  const dates: string[] = [];
  const start = startDate.slice(0, 10);
  const finish = endDate.slice(0, 10);
  const current = new Date(`${start}T00:00:00`);
  const end = new Date(`${finish}T00:00:00`);

  if (Number.isNaN(current.getTime()) || Number.isNaN(end.getTime())) {
    return dates;
  }

  while (current <= end) {
    dates.push(
      `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`
    );
    current.setDate(current.getDate() + 1);
  }

  return dates;
};

type EventDetailPayload = {
  event: Event | null;
  detail: FestivalPOCContent | null;
};

const buildDbFestivalDetail = (
  event: Event,
  eventArtists: EventArtist[],
  eventStages: EventStage[],
  scheduleSlots: ScheduleSlot[],
  ticketLinks: TicketLink[]
): FestivalPOCContent | null => {
  const baseDetail = getFestivalContentForEvent(event);
  const performanceSlots = scheduleSlots.filter((slot) => slot.slot_type === 'performance');
  const visibleEventStages = eventStages
    .filter((stage) => !stage.is_hidden)
    .slice()
    .sort((left, right) => {
      if ((left.performance_date ?? '') !== (right.performance_date ?? '')) {
        return (left.performance_date ?? '').localeCompare(right.performance_date ?? '');
      }

      const leftOrder = left.display_order ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = right.display_order ?? Number.MAX_SAFE_INTEGER;
      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }

      return left.stage_name.localeCompare(right.stage_name);
    });

  const slotByEventArtistId = new Map(
    performanceSlots
      .filter((slot) => slot.event_artist_id)
      .map((slot) => [String(slot.event_artist_id), slot])
  );

  const dayOrder = Array.from(
    new Set([
      ...getDateRange(event.start_date, event.end_date),
      ...eventArtists.map((row) => row.performance_date).filter((value): value is string => Boolean(value)),
      ...performanceSlots.map((slot) => String(slot.start_at).slice(0, 10)),
      ...(baseDetail?.daySchedules.map((day) => day.date) ?? []),
    ])
  ).sort((left, right) => left.localeCompare(right));

  const mappedDaySchedules = dayOrder.map((date, index): FestivalDaySchedule | null => {
      const dayStagePositionMap = new Map(
        visibleEventStages
          .filter((stage) => stage.performance_date === date || (!stage.performance_date && dayOrder.length === 1))
          .map((stage) => [stage.stage_name, stage.display_order ?? Number.MAX_SAFE_INTEGER])
      );
      const eventArtistRows = eventArtists
        .filter((row) => row.performance_date === date || (!row.performance_date && dayOrder.length === 1))
        .map<FestivalDaySchedule['acts'][number]>((row, rowIndex) => {
          const linkedSlot = slotByEventArtistId.get(row.id);
          const fallbackSlot = performanceSlots.find(
            (slot) =>
              !slot.event_artist_id &&
              slot.artist_id === row.artist_id &&
              String(slot.start_at).slice(0, 10) === date
          );
          const slot = linkedSlot ?? fallbackSlot ?? null;
          const parsedNote = decodeLineupNote(row.note);
          const stageName = slot?.stage_name ?? parsedNote.metadata.stageName ?? 'Stage TBD';
          const stagePosition =
            dayStagePositionMap.get(stageName) ??
            parsedNote.metadata.stagePosition ??
            Number.MAX_SAFE_INTEGER;

          return {
            artist: row.artists?.name ?? 'Artist',
            start: formatTime(slot?.start_at),
            end: formatTime(slot?.end_at),
            stage: stageName,
            order: row.display_order ?? rowIndex + 1,
            highlight: row.is_headliner || row.role === 'headliner',
            note: parsedNote.visibleNote || undefined,
            stagePosition,
          };
        });

      const fallbackDay = baseDetail?.daySchedules.find((day) => day.date === date);
      const fallbackActs: FestivalDaySchedule['acts'] =
        fallbackDay?.acts.map((act) => ({
          ...act,
          stagePosition: dayStagePositionMap.get(act.stage) ?? Number.MAX_SAFE_INTEGER,
        })) ?? [];
      const acts = (eventArtistRows.length > 0 ? eventArtistRows : fallbackActs).slice().sort((left, right) => {
        const leftStagePosition = left.stagePosition ?? Number.MAX_SAFE_INTEGER;
        const rightStagePosition = right.stagePosition ?? Number.MAX_SAFE_INTEGER;

        if (leftStagePosition !== rightStagePosition) {
          return leftStagePosition - rightStagePosition;
        }

        if (left.stage !== right.stage) {
          return left.stage.localeCompare(right.stage);
        }

        if (left.order !== right.order) {
          return left.order - right.order;
        }

        return left.artist.localeCompare(right.artist);
      });
      if (acts.length === 0) return null;

      const earliestTime = acts
        .map((act) => act.start)
        .filter((value): value is string => Boolean(value))
        .sort((left, right) => left.localeCompare(right))[0];

      return {
        date,
        label: fallbackDay?.label ?? `Day ${index + 1}`,
        startTimeLabel: earliestTime
          ? `공연 시작 ${earliestTime}`
          : (fallbackDay?.startTimeLabel ?? '공연 시간 업데이트 예정'),
        acts,
      };
    });

  const daySchedules: FestivalDaySchedule[] = mappedDaySchedules.filter(
    (day): day is FestivalDaySchedule => day !== null
  );

  const stagePositionMap = new Map<string, number>();
  visibleEventStages.forEach((stage) => {
    const stagePosition = stage.display_order ?? Number.MAX_SAFE_INTEGER;
    const currentPosition = stagePositionMap.get(stage.stage_name) ?? Number.MAX_SAFE_INTEGER;
    stagePositionMap.set(stage.stage_name, Math.min(currentPosition, stagePosition));
  });

  const allActs = daySchedules.flatMap((day) => day.acts);
  const hasCanonicalStageData =
    visibleEventStages.length > 0 ||
    allActs.some((act) => Boolean(act.stage && act.stage !== 'Stage TBD')) ||
    performanceSlots.some((slot) => Boolean(slot.stage_name));
  const stageNames = (
    visibleEventStages.length > 0
      ? Array.from(new Set(visibleEventStages.map((stage) => stage.stage_name).filter(Boolean)))
      : Array.from(
          new Set([
            ...allActs.map((act) => act.stage).filter(Boolean),
            ...performanceSlots.map((slot) => slot.stage_name).filter(Boolean),
            ...(!hasCanonicalStageData ? (baseDetail?.stages ?? []) : []),
          ])
        )
  ).sort((left, right) => {
    const leftPosition = stagePositionMap.get(left) ?? Number.MAX_SAFE_INTEGER;
    const rightPosition = stagePositionMap.get(right) ?? Number.MAX_SAFE_INTEGER;

    if (leftPosition !== rightPosition) {
      return leftPosition - rightPosition;
    }

    return left.localeCompare(right);
  });
  const shouldSortSummaryByTime = allActs.length > 0 && allActs.every((act) => Boolean(act.start) && Boolean(act.end));

  const dynamicLineupSummary = allActs
    .slice()
    .sort((left, right) => {
      if (shouldSortSummaryByTime && left.start && right.start && left.start !== right.start) {
        return left.start.localeCompare(right.start);
      }
      if (left.order !== right.order) {
        return left.order - right.order;
      }
      return left.artist.localeCompare(right.artist);
    })
    .map((act) => act.artist);

  const dynamicTicketLinks: FestivalTicketLink[] = ticketLinks.map((row) => {
    const opensAt = row.opens_at ? String(row.opens_at).slice(0, 16).replace('T', ' ') : null;
    return {
      label: row.provider_name,
      url: row.url,
      status: formatTicketStatus(row.sales_status),
      note: row.price_note ?? (opensAt ? `오픈 ${opensAt}` : '관리자 저장 링크'),
    };
  });

  if (daySchedules.length === 0 && dynamicTicketLinks.length === 0 && !baseDetail) {
    return null;
  }

  return {
    city: baseDetail?.city ?? event.venue.split(' ')[0] ?? 'Festival',
    tagline: baseDetail?.tagline ?? event.description,
    heroNote:
      baseDetail?.heroNote ??
      '현재 상세 정보는 관리자 입력 데이터와 기본 이벤트 정보를 함께 사용합니다.',
    lineupSummary:
      dynamicLineupSummary.length > 0
        ? Array.from(new Set(dynamicLineupSummary)).slice(0, 8)
        : (baseDetail?.lineupSummary ?? []),
    stages:
      hasCanonicalStageData
        ? stageNames
        : stageNames.length > 0
        ? stageNames
        : (baseDetail?.stages ?? []),
    factCards: [
      { label: '일정', value: `${event.start_date.slice(0, 10)} - ${event.end_date.slice(0, 10)}` },
      { label: '장소', value: event.venue },
      {
        label: '스테이지',
        value:
          hasCanonicalStageData
            ? `${stageNames.length}개 스테이지 운영`
            : stageNames.length > 0
            ? `${stageNames.length}개 스테이지 운영`
            : (baseDetail?.factCards.find((card) => card.label === '스테이지')?.value ?? '스테이지 정보 업데이트 예정'),
      },
      {
        label: '예매처',
        value:
          dynamicTicketLinks.length > 0
            ? Array.from(new Set(ticketLinks.map((row) => row.provider_name))).join(', ')
            : (baseDetail?.factCards.find((card) => card.label === '예매처')?.value ?? '예매 링크 업데이트 예정'),
      },
    ],
    transportTips: baseDetail?.transportTips ?? ['공연장 위치 정보와 동선 안내는 운영자 검수 기준으로 업데이트합니다.'],
    plannerTips: baseDetail?.plannerTips ?? ['라인업과 타임테이블을 시간 기준으로 저장하면 이후 개인 플래너 연결이 쉬워집니다.'],
    syncPlan: baseDetail?.syncPlan ?? ['관리자 입력 데이터를 기준으로 이벤트 상세를 갱신합니다.'],
    daySchedules: daySchedules.length > 0 ? daySchedules : (baseDetail?.daySchedules ?? []),
    ticketLinks: dynamicTicketLinks.length > 0 ? dynamicTicketLinks : (baseDetail?.ticketLinks ?? []),
    travelLinks: baseDetail?.travelLinks ?? [],
    sources: baseDetail?.sources ?? [],
  };
};

export const fetchEvents = async (): Promise<Event[]> => {
  try {
    if (apiUrl) {
      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error('Failed to fetch events from API');
      }
      const payload = await response.json();
      return mergeEventsWithMocks(coerceEvents(payload));
    }

    if (!hasSupabaseEnv()) {
      return mergeEventsWithMocks([]);
    }

    const supabase = createClient();
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .order('start_date', { ascending: true });

    if (error) throw error;
    return mergeEventsWithMocks(data || []);
  } catch {
    return mergeEventsWithMocks([]);
  }
};

export const fetchEventById = async (id: string): Promise<Event | null> => {
  if (apiUrl) {
    const response = await fetch(`${apiUrl}/${id}`);
    if (!response.ok) {
      throw new Error('Failed to fetch event from API');
    }
    const payload = await response.json();
    return toEvent(payload);
  }

  if (!hasSupabaseEnv()) {
    return mockEvents.find((event) => event.id === id) ?? null;
  }

  const supabase = createClient();
  const fallbackMockEvent = findMockEventById(id);
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (fallbackMockEvent && error.code === 'PGRST116') {
      return fallbackMockEvent;
    }

    throw error;
  }

  return data ?? fallbackMockEvent;
};

export const fetchEventDetailById = async (id: string): Promise<EventDetailPayload> => {
  if (apiUrl) {
    const event = await fetchEventById(id);
    return {
      event,
      detail: event ? getFestivalContentForEvent(event) : null,
    };
  }

  if (!hasSupabaseEnv()) {
    const event = mockEvents.find((item) => item.id === id) ?? null;
    return {
      event,
      detail: event ? getFestivalContentForEvent(event) : null,
    };
  }

  const supabase = createClient();
  const fallbackMockEvent = findMockEventById(id);
  const [eventResponse, eventArtistsResponse, scheduleSlotsResponse, ticketLinksResponse] = await Promise.all([
    supabase.from('events').select('*').eq('id', id).single(),
    supabase
      .from('event_artists')
      .select(
        `
          *,
          artists (
            id,
            name,
            name_en
          )
        `
      )
      .eq('event_id', id)
      .order('performance_date', { ascending: true })
      .order('display_order', { ascending: true }),
    supabase
      .from('schedule_slots')
      .select(
        `
          *,
          artists (
            id,
            name,
            name_en
          )
        `
      )
      .eq('event_id', id)
      .order('start_at', { ascending: true }),
    supabase
      .from('ticket_links')
      .select('*')
      .eq('event_id', id)
      .order('is_primary', { ascending: false })
      .order('opens_at', { ascending: true }),
  ]);
  let eventStagesData: EventStage[] = [];
  try {
    const eventStagesResponse = await supabase
      .from('event_stages')
      .select('*')
      .eq('event_id', id)
      .order('performance_date', { ascending: true })
      .order('display_order', { ascending: true });

    if (eventStagesResponse.error) {
      console.warn('Error loading event stages:', eventStagesResponse.error);
    } else {
      eventStagesData = (eventStagesResponse.data as EventStage[]) ?? [];
    }
  } catch (error) {
    console.warn('event_stages query unavailable, falling back to lineup note metadata.', error);
  }

  if ((eventResponse.error?.code === 'PGRST116' || !eventResponse.data) && fallbackMockEvent) {
    return {
      event: fallbackMockEvent,
      detail: getFestivalContentForEvent(fallbackMockEvent),
    };
  }

  if (eventResponse.error) throw eventResponse.error;
  if (eventArtistsResponse.error) throw eventArtistsResponse.error;
  if (scheduleSlotsResponse.error) throw scheduleSlotsResponse.error;
  if (ticketLinksResponse.error) throw ticketLinksResponse.error;

  const event = eventResponse.data ?? null;
  if (!event) {
    return { event: null, detail: null };
  }

  return {
    event,
    detail: buildDbFestivalDetail(
      event,
      (eventArtistsResponse.data as EventArtist[]) ?? [],
      eventStagesData,
      (scheduleSlotsResponse.data as ScheduleSlot[]) ?? [],
      (ticketLinksResponse.data as TicketLink[]) ?? []
    ),
  };
};
