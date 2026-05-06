'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { FestivalPOCContent } from '@/lib/festival-content';
import { mockEvents } from '@/lib/mock-events';
import { fetchEventDetailById, fetchEvents as fetchEventsFromSource } from '@/lib/events';
import { Event } from '@/types/database';

type EventMenu = 'festival' | 'concert';

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [featuredFestivalDetail, setFeaturedFestivalDetail] = useState<FestivalPOCContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMenu, setSelectedMenu] = useState<EventMenu>('festival');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string>('all');

  const genres = ['all', 'indie', 'alternative', 'electronic', 'rock', 'pop', 'jazz'];

  const fetchEvents = useCallback(async () => {
    try {
      const data = await fetchEventsFromSource();
      setEvents(data && data.length > 0 ? data : mockEvents);
    } catch (error) {
      console.error('Error fetching events:', error);
      setEvents(mockEvents);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchEvents();
  }, [fetchEvents]);

  const effectiveEvents = events.length > 0 ? events : mockEvents;
  const festivalEvents = effectiveEvents.filter((event) => event.event_type !== 'concert');

  const filteredEvents = festivalEvents.filter((event) => {
    const matchesSearch = event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.artist.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesGenre = selectedGenre === 'all' || event.genre === selectedGenre;
    return matchesSearch && matchesGenre;
  });

  const featuredFestival = filteredEvents[0];
  const formatDateRangeLabel = (event: Event) =>
    `${new Date(event.start_date).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })} · ${new Date(event.end_date).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })}`;

  useEffect(() => {
    const run = async () => {
      if (!featuredFestival) {
        setFeaturedFestivalDetail(null);
        return;
      }

      try {
        const detailPayload = await fetchEventDetailById(featuredFestival.id);
        setFeaturedFestivalDetail(detailPayload.detail);
      } catch (error) {
        console.error('Error loading featured festival detail:', error);
        setFeaturedFestivalDetail(null);
      }
    };

    void run();
  }, [featuredFestival]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f7f1e8_0%,#f8fbff_42%,#ffffff_100%)] py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-[2rem] bg-[#13212c] text-white shadow-xl">
          <div className="grid gap-8 px-6 py-10 md:grid-cols-[1.3fr_0.9fr] md:px-10">
            <div>
              <p className="text-sm uppercase tracking-[0.28em] text-amber-200">Event Discovery</p>
              <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
                페스티벌 중심으로 탐색하는
                <span className="block text-amber-300">FestivalNavigator POC</span>
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-200 sm:text-lg">
                이번 POC는 콘서트보다 페스티벌 경험에 집중합니다. The Glow 2026과 서울재즈페스티벌처럼
                성격이 다른 실제 행사를 함께 두고, 라인업, 위치, 예매, 타임테이블 동선까지 이어지는 구조를 검증합니다.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedMenu('festival')}
                  className={`rounded-full px-5 py-2.5 text-sm font-medium transition-colors ${
                    selectedMenu === 'festival'
                      ? 'bg-amber-300 text-slate-950'
                      : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  Festivals POC
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedMenu('concert')}
                  className={`rounded-full px-5 py-2.5 text-sm font-medium transition-colors ${
                    selectedMenu === 'concert'
                      ? 'bg-white text-slate-950'
                      : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  Concerts
                </button>
              </div>
            </div>

            <div className="rounded-[1.5rem] bg-white/8 p-6 backdrop-blur">
              <p className="text-sm font-medium text-amber-200">이번 단계에서 확인할 것</p>
              <div className="mt-4 space-y-4 text-sm text-slate-200">
                <div>
                  <p className="font-semibold text-white">1. 실제 행사 하나를 깊게 본다</p>
                  <p className="mt-1">단일 행사만 보지 않고, The Glow와 서울재즈처럼 성격이 다른 페스티벌을 함께 비교합니다.</p>
                </div>
                <div>
                  <p className="font-semibold text-white">2. 내 일정 설계의 기반</p>
                  <p className="mt-1">라인업, 스테이지, 동선, 예매를 연결해 나중에 타임테이블 저장 UX로 이어질 구조를 만듭니다.</p>
                </div>
                <div>
                  <p className="font-semibold text-white">3. Concert 메뉴는 후속 준비</p>
                  <p className="mt-1">지금은 메뉴만 두고, 실제 데이터 모델과 UI는 페스티벌 중심으로 검증합니다.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="mt-8 flex flex-col gap-4 rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">
              {selectedMenu === 'festival' ? 'Festival Events' : 'Concert Events'}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {selectedMenu === 'festival'
                ? '라인업과 타임테이블 중심으로 페스티벌 POC를 먼저 확인합니다.'
                : '콘서트 메뉴는 다음 단계에서 공연 유형과 티켓 플로우를 분리해 확장할 예정입니다.'}
            </p>
          </div>

          {selectedMenu === 'festival' && (
            <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row">
              <input
                type="text"
                placeholder="페스티벌 또는 아티스트 검색"
                className="rounded-full border border-slate-300 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <select
                className="rounded-full border border-slate-300 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                value={selectedGenre}
                onChange={(e) => setSelectedGenre(e.target.value)}
              >
                {genres.map((genre) => (
                  <option key={genre} value={genre}>
                    {genre === 'all' ? '전체 분위기' : genre}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {selectedMenu === 'festival' ? (
          <>
            {featuredFestival && (
              <Link href={`/events/${featuredFestival.id}`} className="mt-8 block">
                <article className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-lg transition-transform hover:-translate-y-1">
                  <div className="grid gap-0 lg:grid-cols-[1.15fr_0.85fr]">
                    <div className="relative min-h-[360px] bg-slate-900">
                      {featuredFestival.image_url && (
                        <Image
                          src={featuredFestival.image_url}
                          alt={featuredFestival.title}
                          fill
                          unoptimized
                          sizes="(min-width: 1024px) 60vw, 100vw"
                          className="absolute inset-0 h-full w-full object-cover opacity-80"
                        />
                      )}
                      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(10,18,28,0.82),rgba(10,18,28,0.35))]" />
                      <div className="relative flex h-full flex-col justify-end p-8 text-white">
                        <div className="inline-flex w-fit rounded-full bg-amber-300 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-950">
                          Featured Festival
                        </div>
                          <h3 className="mt-4 text-3xl font-semibold tracking-tight">{featuredFestival.title}</h3>
                        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-200">
                          {featuredFestivalDetail?.tagline ?? featuredFestival.description}
                        </p>
                        <div className="mt-6 flex flex-wrap gap-2 text-xs text-slate-200">
                          {(featuredFestivalDetail?.stages ?? []).map((stage) => (
                            <span key={stage} className="rounded-full border border-white/20 px-3 py-1">
                              {stage}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="p-8">
                      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-1">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Date</p>
                          <p className="mt-2 text-lg font-semibold text-slate-900">
                            {formatDateRangeLabel(featuredFestival)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Venue</p>
                          <p className="mt-2 text-lg font-semibold text-slate-900">{featuredFestival.venue}</p>
                          <p className="mt-1 text-sm text-slate-500">{featuredFestival.venue_address}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Lineup Preview</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {(featuredFestivalDetail?.lineupSummary ?? []).map((artist) => (
                              <span key={artist} className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">
                                {artist}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="rounded-2xl bg-amber-50 p-4">
                          <p className="text-sm font-medium text-slate-900">POC 포인트</p>
                          <p className="mt-2 text-sm leading-6 text-slate-600">
                            공연 성격이 다른 실제 페스티벌을 seed로 유지하면서, 라인업, stage order, 예매, 지도, 길찾기 정보를
                            하나의 상세 페이지에서 비교 검증합니다.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              </Link>
            )}

            {filteredEvents.length > 0 && (
              <section className="mt-8 rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-2 border-b border-slate-200 pb-5 md:flex-row md:items-end md:justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Festival List</p>
                    <h3 className="mt-2 text-2xl font-semibold text-slate-900">
                      지금 확인 가능한 페스티벌 {filteredEvents.length}
                    </h3>
                  </div>
                  <p className="text-sm text-slate-500">
                    seed 이벤트와 DB 이벤트를 함께 보여주고, public 상세에서 바로 검수할 수 있습니다.
                  </p>
                </div>

                <div className="mt-6 grid gap-4 lg:grid-cols-2">
                  {filteredEvents.map((event, index) => (
                    <Link
                      key={event.id}
                      href={`/events/${event.id}`}
                      className="group rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5 transition-colors hover:border-amber-300 hover:bg-amber-50/60"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                          {index === 0 ? 'Featured' : event.genre || 'festival'}
                        </span>
                        <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-500">
                          {event.event_type ?? 'festival'}
                        </span>
                      </div>

                      <div className="mt-4">
                        <h4 className="text-2xl font-semibold text-slate-900 group-hover:text-slate-950">{event.title}</h4>
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          {event.description}
                        </p>
                      </div>

                      <div className="mt-5 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl bg-white px-4 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Date</p>
                          <p className="mt-2 text-sm font-medium text-slate-900">{formatDateRangeLabel(event)}</p>
                        </div>
                        <div className="rounded-2xl bg-white px-4 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Venue</p>
                          <p className="mt-2 text-sm font-medium text-slate-900">{event.venue}</p>
                        </div>
                      </div>

                      <div className="mt-5 flex flex-wrap gap-2">
                        {event.artist
                          .split(',')
                          .map((artist) => artist.trim())
                          .filter(Boolean)
                          .slice(0, 4)
                          .map((artist) => (
                            <span key={artist} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">
                              {artist}
                            </span>
                          ))}
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {featuredFestival && (
              <div className="mt-8 rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Next Build Focus</p>
                    <h3 className="mt-3 text-2xl font-semibold text-slate-900">Festival ingestion 다음 구현 체크포인트</h3>
                  </div>
                  <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                    Multi-seed validation
                  </span>
                </div>
                <div className="mt-6 grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-900">1. 타임테이블 고도화</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      현재는 stage order 기준입니다. 공식 timetable 이미지나 게시물을 확보하면 exact time으로 교체합니다.
                    </p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-900">2. 내 동선 저장</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      보고 싶은 세트를 저장하고 스테이지 이동 충돌을 계산할 수 있게 확장합니다.
                    </p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-900">3. 데이터 수집 자동화</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      일정, 장소, 예매처는 자동 수집 후보로 두고, 라인업과 timetable은 운영자 검수 흐름으로 연결합니다.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="mt-8 rounded-[2rem] border border-dashed border-slate-300 bg-white p-12 text-center shadow-sm">
            <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Coming Soon</p>
            <h3 className="mt-4 text-3xl font-semibold text-slate-900">Concert 메뉴는 다음 단계에서 확장합니다.</h3>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-slate-600">
              콘서트는 페스티벌과 다르게 단일 공연, 좌석/회차, 티켓 오픈 방식이 달라 별도 정보 구조가 필요합니다.
              이번 POC에서는 메뉴만 열어두고 실제 구현은 페스티벌 플로우 검증 후 진행합니다.
            </p>
          </div>
        )}

        {selectedMenu === 'festival' && filteredEvents.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">검색 결과가 없습니다.</p>
          </div>
        )}
      </div>
    </div>
  );
} 
