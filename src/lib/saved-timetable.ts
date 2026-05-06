import { createLocalFirstCollectionStore } from '@/lib/user-state-storage';

export type PlannerItemType = 'performance' | 'meal' | 'rest' | 'move' | 'custom';

export type PlannerItem = {
  id: string;
  eventId: string;
  eventTitle: string;
  eventVenue: string;
  eventImageUrl: string | null;
  date: string;
  dayLabel: string;
  itemType: PlannerItemType;
  title: string;
  stage: string | null;
  artist: string | null;
  defaultStart: string | null;
  defaultEnd: string | null;
  plannedStart: string;
  plannedEnd: string;
  order: number | null;
  note: string | null;
  source: 'festival-slot' | 'manual';
  linkedSlotId: string | null;
  isActive: boolean;
};

const STORAGE_KEY = 'festival-navigator:planner-items';

const sortPlannerItems = (items: PlannerItem[]) =>
  items.slice().sort((left, right) => {
    if (left.date !== right.date) {
      return left.date.localeCompare(right.date);
    }

    if (left.plannedStart !== right.plannedStart) {
      return left.plannedStart.localeCompare(right.plannedStart);
    }

    return (left.order ?? 999) - (right.order ?? 999);
  });

const isPlannerItem = (value: unknown): value is PlannerItem => {
  if (typeof value !== 'object' || value === null) return false;

  const candidate = value as Partial<PlannerItem>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.eventId === 'string' &&
    typeof candidate.eventTitle === 'string' &&
    typeof candidate.eventVenue === 'string' &&
    typeof candidate.date === 'string' &&
    typeof candidate.dayLabel === 'string' &&
    typeof candidate.itemType === 'string' &&
    typeof candidate.title === 'string' &&
    typeof candidate.plannedStart === 'string' &&
    typeof candidate.plannedEnd === 'string' &&
    typeof candidate.source === 'string' &&
    typeof candidate.isActive === 'boolean'
  );
};

const plannerItemsStore = createLocalFirstCollectionStore<PlannerItem>({
  storageKey: STORAGE_KEY,
  futureRemoteTable: 'planner_items',
  isItem: isPlannerItem,
  sortItems: sortPlannerItems,
  onReadError: (error) => {
    console.error('Failed to read planner items:', error);
  },
  onWriteError: (error) => {
    console.error('Failed to write planner items:', error);
  },
});

export const plannerItemsStorageInfo = plannerItemsStore.storageInfo;

export const combinePlannerDateTime = (date: string, time: string | null) => {
  if (!date || !time) return '';
  if (time.includes('T')) return time.slice(0, 16);
  return `${date}T${time}`;
};

export const formatPlannerTime = (value: string | null) => {
  if (!value) return '시간 미정';
  return value.slice(11, 16);
};

export const getPlannerItems = (): PlannerItem[] => {
  return plannerItemsStore.getAll();
};

export const setPlannerItems = (items: PlannerItem[]) => {
  plannerItemsStore.setAll(items);
};

export const replacePlannerItems = (items: PlannerItem[]) => {
  return plannerItemsStore.replaceAll(items);
};

export const getPlannerItemsForDay = (eventId: string, date: string, excludeId?: string) =>
  getPlannerItems().filter((item) => item.eventId === eventId && item.date === date && item.id !== excludeId);

export const getLatestPlannerEnd = (eventId: string, date: string, excludeId?: string) => {
  const sameDayItems = getPlannerItemsForDay(eventId, date, excludeId);
  if (sameDayItems.length === 0) return null;

  return sameDayItems.reduce((latest, item) => {
    if (!latest) return item.plannedEnd;
    return item.plannedEnd > latest ? item.plannedEnd : latest;
  }, '' as string | null);
};

export const validatePlannerItem = (candidate: PlannerItem) => {
  if (!candidate.plannedStart || !candidate.plannedEnd) {
    return { ok: false, message: '계획 시작과 종료 시간을 모두 입력해주세요.' };
  }

  if (candidate.plannedEnd <= candidate.plannedStart) {
    return { ok: false, message: '종료 시간은 시작 시간보다 늦어야 합니다.' };
  }

  return { ok: true as const, message: '' };
};

export const upsertPlannerItem = (candidate: PlannerItem) => {
  const validation = validatePlannerItem(candidate);
  if (!validation.ok) {
    return { ok: false as const, items: getPlannerItems(), message: validation.message };
  }

  const current = getPlannerItems();
  const next = current.some((item) => item.id === candidate.id)
    ? current.map((item) => (item.id === candidate.id ? candidate : item))
    : [...current, candidate];

  return { ok: true as const, items: replacePlannerItems(next), message: '' };
};

export const isPlannerItemCustomized = (item: PlannerItem) => {
  if (item.source === 'manual') return true;
  if (!item.defaultStart || !item.defaultEnd) return false;
  return item.plannedStart !== item.defaultStart || item.plannedEnd !== item.defaultEnd;
};

export const resetPlannerItemToDefault = (item: PlannerItem) => {
  if (item.source !== 'festival-slot' || !item.defaultStart || !item.defaultEnd) {
    return null;
  }

  return {
    ...item,
    plannedStart: item.defaultStart,
    plannedEnd: item.defaultEnd,
  };
};

export const removePlannerItem = (itemId: string) => {
  const next = getPlannerItems().filter((item) => item.id !== itemId);
  return replacePlannerItems(next);
};

export const removePlannerItemsForScope = (eventId: string, date?: string) => {
  const next = getPlannerItems().filter((item) => {
    if (item.eventId !== eventId) return true;
    if (!date) return false;
    return item.date !== date;
  });

  return replacePlannerItems(next);
};

export const isPlannerSlotActive = (linkedSlotId: string) =>
  getPlannerItems().some((item) => item.linkedSlotId === linkedSlotId);

export const getPlannerItemByLinkedSlotId = (linkedSlotId: string) =>
  getPlannerItems().find((item) => item.linkedSlotId === linkedSlotId) ?? null;
