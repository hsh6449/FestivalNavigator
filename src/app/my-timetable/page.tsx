'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  PlannerItem,
  PlannerItemType,
  formatPlannerTime,
  getLatestPlannerEnd,
  getPlannerItems,
  isPlannerItemCustomized,
  removePlannerItem,
  removePlannerItemsForScope,
  resetPlannerItemToDefault,
  upsertPlannerItem,
} from '@/lib/saved-timetable';

const plannerTypeLabel: Record<PlannerItemType, string> = {
  performance: 'performance',
  meal: 'meal',
  rest: 'rest',
  move: 'move',
  custom: 'custom',
};

const addMinutes = (dateTime: string, minutes: number) => {
  const parsed = new Date(dateTime);
  if (Number.isNaN(parsed.getTime())) return dateTime;
  parsed.setMinutes(parsed.getMinutes() + minutes);
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}T${String(parsed.getHours()).padStart(2, '0')}:${String(parsed.getMinutes()).padStart(2, '0')}`;
};

type PlannerDraft = {
  key: string;
  eventId: string;
  eventTitle: string;
  eventVenue: string;
  eventImageUrl: string | null;
  date: string;
  dayLabel: string;
  itemType: PlannerItemType;
  title: string;
  stage: string;
  plannedStart: string;
  plannedEnd: string;
  note: string;
};

const buildDraft = (contextItem: PlannerItem, itemType: PlannerItemType): PlannerDraft => {
  const latestEnd = getLatestPlannerEnd(contextItem.eventId, contextItem.date) ?? `${contextItem.date}T11:00`;
  const defaultTitle =
    itemType === 'meal'
      ? '밥타임'
      : itemType === 'rest'
        ? '휴식'
        : itemType === 'move'
          ? '무대 이동'
          : '커스텀 일정';

  return {
    key: `${contextItem.eventId}::${contextItem.date}`,
    eventId: contextItem.eventId,
    eventTitle: contextItem.eventTitle,
    eventVenue: contextItem.eventVenue,
    eventImageUrl: contextItem.eventImageUrl,
    date: contextItem.date,
    dayLabel: contextItem.dayLabel,
    itemType,
    title: defaultTitle,
    stage: '',
    plannedStart: latestEnd,
    plannedEnd: addMinutes(latestEnd, itemType === 'move' ? 20 : 60),
    note: '',
  };
};

export default function MyTimetablePage() {
  const [items, setItems] = useState<PlannerItem[]>([]);
  const [draft, setDraft] = useState<PlannerDraft | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    setItems(getPlannerItems());
  }, []);

  const groupedItems = useMemo(() => {
    return items.reduce<Record<string, PlannerItem[]>>((groups, item) => {
      const key = `${item.eventTitle}__${item.date}`;
      groups[key] = [...(groups[key] ?? []), item].sort((left, right) => left.plannedStart.localeCompare(right.plannedStart));
      return groups;
    }, {});
  }, [items]);

  const handleSaveDraft = () => {
    if (!draft) return;

    const result = upsertPlannerItem({
      id: `planner::manual::${Date.now()}`,
      eventId: draft.eventId,
      eventTitle: draft.eventTitle,
      eventVenue: draft.eventVenue,
      eventImageUrl: draft.eventImageUrl,
      date: draft.date,
      dayLabel: draft.dayLabel,
      itemType: draft.itemType,
      title: draft.title,
      stage: draft.stage || null,
      artist: null,
      defaultStart: null,
      defaultEnd: null,
      plannedStart: draft.plannedStart,
      plannedEnd: draft.plannedEnd,
      order: null,
      note: draft.note || null,
      source: 'manual',
      linkedSlotId: null,
      isActive: true,
    });

    if (!result.ok) {
      setMessage(result.message);
      return;
    }

    setItems(result.items);
    setDraft(null);
    setMessage('커스텀 자산을 추가했습니다.');
  };

  const handleResetItem = (item: PlannerItem) => {
    const resetItem = resetPlannerItemToDefault(item);
    if (!resetItem) {
      setMessage('이 항목은 원본으로 되돌릴 기본 시간이 없습니다.');
      return;
    }

    const result = upsertPlannerItem(resetItem);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }

    setItems(result.items);
    setMessage('선택한 항목을 원본 timetable 기준으로 되돌렸습니다.');
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f7f3ec_0%,#ffffff_100%)] py-10">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">My Timetable</p>
              <h1 className="mt-3 text-3xl font-semibold text-slate-900">활성화한 플래너 레이어</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
                admin이 만든 public event는 그대로 두고, 여기에는 네가 선택하거나 수정한 개인 override만 따로 쌓입니다.
              </p>
            </div>
            <Link
              href="/events"
              className="inline-flex h-fit items-center justify-center rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              페스티벌 탐색으로 돌아가기
            </Link>
          </div>

          {message && (
            <div className="mt-6 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {message}
            </div>
          )}

          {items.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-lg font-medium text-slate-900">아직 활성화한 계획이 없습니다.</p>
              <p className="mt-3 text-sm text-slate-500">이벤트 상세의 Timetable 탭에서 세트를 활성화하거나 Asset을 추가해보세요.</p>
            </div>
          ) : (
            <div className="mt-8 space-y-8">
              {Object.entries(groupedItems).map(([groupKey, groupItems]) => {
                const latestEnd = groupItems[groupItems.length - 1]?.plannedEnd ?? null;
                const draftKey = `${groupItems[0].eventId}::${groupItems[0].date}`;

                return (
                  <section key={groupKey} className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
                    <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 md:flex-row md:items-end md:justify-between">
                      <div>
                        <h2 className="text-2xl font-semibold text-slate-900">{groupItems[0].eventTitle}</h2>
                        <p className="mt-1 text-sm text-slate-500">{groupItems[0].date} · {groupItems[0].dayLabel}</p>
                      </div>
                      <div className="text-sm text-slate-500">
                        <p>{groupItems[0].eventVenue}</p>
                        <p className="mt-1">현재 마지막 계획 종료: {formatPlannerTime(latestEnd)}</p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setItems(removePlannerItemsForScope(groupItems[0].eventId, groupItems[0].date));
                          setMessage('선택한 day의 개인 planner layer를 초기화했습니다.');
                        }}
                        className="rounded-full border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
                      >
                        {groupItems[0].dayLabel} reset
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setItems(removePlannerItemsForScope(groupItems[0].eventId));
                          setMessage('이 이벤트의 planner layer를 전체 초기화했습니다.');
                        }}
                        className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                      >
                        이벤트 전체 reset
                      </button>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {([
                        { type: 'meal' as const, label: '+ Meal' },
                        { type: 'rest' as const, label: '+ Rest' },
                        { type: 'move' as const, label: '+ Move' },
                        { type: 'custom' as const, label: '+ Custom' },
                      ]).map((item) => (
                        <button
                          key={item.type}
                          type="button"
                          onClick={() => {
                            setMessage('');
                            setDraft(buildDraft(groupItems[0], item.type));
                          }}
                          className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>

                    {draft?.key === draftKey && (
                      <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <h3 className="text-lg font-semibold text-slate-900">커스텀 자산 추가</h3>
                            <p className="mt-1 text-sm text-slate-500">
                              다음 계획은 {formatPlannerTime(latestEnd)} 이후부터 추가할 수 있습니다.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setDraft(null)}
                            className="text-sm font-medium text-slate-500 hover:text-slate-700"
                          >
                            닫기
                          </button>
                        </div>

                        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                          <div>
                            <label className="mb-2 block text-sm font-medium text-slate-700">유형</label>
                            <select
                              value={draft.itemType}
                              onChange={(event) =>
                                setDraft((current) =>
                                  current
                                    ? {
                                        ...current,
                                        itemType: event.target.value as PlannerItemType,
                                      }
                                    : current
                                )
                              }
                              className="w-full rounded-md border border-slate-300 px-3 py-2"
                            >
                              <option value="meal">meal</option>
                              <option value="rest">rest</option>
                              <option value="move">move</option>
                              <option value="custom">custom</option>
                            </select>
                          </div>
                          <div>
                            <label className="mb-2 block text-sm font-medium text-slate-700">타이틀</label>
                            <input
                              value={draft.title}
                              onChange={(event) => setDraft((current) => (current ? { ...current, title: event.target.value } : current))}
                              className="w-full rounded-md border border-slate-300 px-3 py-2"
                            />
                          </div>
                          <div>
                            <label className="mb-2 block text-sm font-medium text-slate-700">시작</label>
                            <input
                              type="datetime-local"
                              value={draft.plannedStart}
                              onChange={(event) => setDraft((current) => (current ? { ...current, plannedStart: event.target.value } : current))}
                              className="w-full rounded-md border border-slate-300 px-3 py-2"
                            />
                          </div>
                          <div>
                            <label className="mb-2 block text-sm font-medium text-slate-700">종료</label>
                            <input
                              type="datetime-local"
                              value={draft.plannedEnd}
                              onChange={(event) => setDraft((current) => (current ? { ...current, plannedEnd: event.target.value } : current))}
                              className="w-full rounded-md border border-slate-300 px-3 py-2"
                            />
                          </div>
                          <div className="md:col-span-2">
                            <label className="mb-2 block text-sm font-medium text-slate-700">장소 / 메모 지점</label>
                            <input
                              value={draft.stage}
                              onChange={(event) => setDraft((current) => (current ? { ...current, stage: event.target.value } : current))}
                              className="w-full rounded-md border border-slate-300 px-3 py-2"
                            />
                          </div>
                          <div className="md:col-span-2">
                            <label className="mb-2 block text-sm font-medium text-slate-700">메모</label>
                            <input
                              value={draft.note}
                              onChange={(event) => setDraft((current) => (current ? { ...current, note: event.target.value } : current))}
                              className="w-full rounded-md border border-slate-300 px-3 py-2"
                            />
                          </div>
                        </div>

                        <div className="mt-4">
                          <button
                            type="button"
                            onClick={handleSaveDraft}
                            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white"
                          >
                            자산 추가
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="mt-5 space-y-3">
                      {groupItems.map((item) => (
                        <div key={item.id} className="grid gap-3 rounded-2xl bg-white px-4 py-4 md:grid-cols-[160px_1fr_120px] md:items-center">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">
                              {formatPlannerTime(item.plannedStart)} - {formatPlannerTime(item.plannedEnd)}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {plannerTypeLabel[item.itemType]} · {isPlannerItemCustomized(item) ? '개인 조정됨' : '원본 기준'}
                            </p>
                          </div>
                          <div>
                            <p className="text-lg font-semibold text-slate-900">{item.title}</p>
                            <p className="mt-1 text-sm text-slate-500">{item.stage ?? item.artist ?? 'Custom asset'}</p>
                            {item.note && <p className="mt-1 text-sm text-slate-500">{item.note}</p>}
                          </div>
                          <div className="flex justify-end gap-3">
                            {item.source === 'festival-slot' && isPlannerItemCustomized(item) && (
                              <button
                                type="button"
                                onClick={() => handleResetItem(item)}
                                className="text-sm font-medium text-slate-600 hover:text-slate-800"
                              >
                                원본으로
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setItems(removePlannerItem(item.id))}
                              className="text-sm font-medium text-red-600 hover:text-red-700"
                            >
                              제거
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
