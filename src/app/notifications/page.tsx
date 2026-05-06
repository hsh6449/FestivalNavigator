'use client';

import { useState, useEffect } from 'react';
import { createClient, hasSupabaseEnv } from '@/lib/supabase/client';
import { fetchEventDetailById, fetchEvents } from '@/lib/events';
import { FollowedArtist, getFollowedArtists, normalizeArtistName, removeFollowedArtist } from '@/lib/followed-artists';
import { Notification, NotificationHistory } from '@/types/database';
import Link from 'next/link';

type FollowedArtistMatch = {
  eventId: string;
  eventTitle: string;
  venue: string;
  date: string;
  dayLabel: string;
  artistNames: string[];
};

export default function NotificationsPage() {
  const isSupabaseReady = hasSupabaseEnv();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [history, setHistory] = useState<NotificationHistory[]>([]);
  const [followedArtists, setFollowedArtists] = useState<FollowedArtist[]>([]);
  const [followedArtistMatches, setFollowedArtistMatches] = useState<FollowedArtistMatch[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingFollowedArtists, setLoadingFollowedArtists] = useState(true);

  useEffect(() => {
    if (!isSupabaseReady) {
      setLoading(false);
      return;
    }

    void loadPageData();
  }, [isSupabaseReady]);

  useEffect(() => {
    void loadFollowedArtistData();
  }, []);

  const loadPageData = async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setIsAuthenticated(false);
        setNotifications([]);
        setHistory([]);
        return;
      }

      setIsAuthenticated(true);

      const [notificationResponse, historyResponse] = await Promise.all([
        supabase
          .from('notifications')
          .select(`
            *,
            events (
              title,
              start_date,
              venue,
              ticket_open_time
            )
          `)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('notification_history')
          .select(`
            *,
            notifications (
              events (
                title
              )
            )
          `)
          .eq('user_id', user.id)
          .order('sent_at', { ascending: false }),
      ]);

      if (notificationResponse.error) throw notificationResponse.error;
      if (historyResponse.error) throw historyResponse.error;

      setNotifications((notificationResponse.data as Notification[]) || []);
      setHistory((historyResponse.data as NotificationHistory[]) || []);
    } catch (error) {
      console.error('Error loading notifications page:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadFollowedArtistData = async () => {
    const localArtists = getFollowedArtists();
    setFollowedArtists(localArtists);

    if (localArtists.length === 0) {
      setFollowedArtistMatches([]);
      setLoadingFollowedArtists(false);
      return;
    }

    setLoadingFollowedArtists(true);

    try {
      const artistLookup = new Set(localArtists.map((artist) => artist.slug));
      const events = await fetchEvents();
      const matchBuckets = new Map<string, FollowedArtistMatch>();

      await Promise.all(
        events.map(async (event) => {
          const payload = await fetchEventDetailById(event.id);
          if (!payload.detail) return;

          payload.detail.daySchedules.forEach((day) => {
            const matchedArtists = Array.from(
              new Set(
                day.acts
                  .filter((act) => artistLookup.has(normalizeArtistName(act.artist)))
                  .map((act) => act.artist)
              )
            );

            if (matchedArtists.length === 0) return;

            const key = `${event.id}::${day.date}`;
            matchBuckets.set(key, {
              eventId: event.id,
              eventTitle: event.title,
              venue: event.venue,
              date: day.date,
              dayLabel: day.label,
              artistNames: matchedArtists,
            });
          });
        })
      );

      setFollowedArtistMatches(
        Array.from(matchBuckets.values()).sort((left, right) => {
          if (left.date !== right.date) return left.date.localeCompare(right.date);
          return left.eventTitle.localeCompare(right.eventTitle, 'ko');
        })
      );
    } catch (error) {
      console.error('Error loading followed artists:', error);
      setFollowedArtistMatches([]);
    } finally {
      setLoadingFollowedArtists(false);
    }
  };

  const handleDeleteNotification = async (notificationId: string) => {
    if (!confirm('정말로 이 알림을 삭제하시겠습니까?')) return;

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      if (error) throw error;
      setNotifications((current) =>
        current.filter((notification) => notification.id !== notificationId)
      );
    } catch (error) {
      console.error('Error deleting notification:', error);
      alert('알림 삭제 중 오류가 발생했습니다.');
    }
  };

  const handleRemoveFollowedArtist = (artistName: string) => {
    const nextArtists = removeFollowedArtist(artistName);
    setFollowedArtists(nextArtists);
    setFollowedArtistMatches((current) =>
      current
        .map((item) => ({
          ...item,
          artistNames: item.artistNames.filter((name) => normalizeArtistName(name) !== normalizeArtistName(artistName)),
        }))
        .filter((item) => item.artistNames.length > 0)
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">알림 관리</h1>

        {!isSupabaseReady && (
          <div className="mb-8 rounded-lg border border-dashed border-amber-300 bg-amber-50 p-6 text-sm text-amber-900">
            Supabase 프로젝트를 연결하면 저장한 알림과 알림 기록을 볼 수 있습니다.
          </div>
        )}

        {isSupabaseReady && !isAuthenticated && (
          <div className="mb-8 rounded-lg border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-600">
            로그인한 사용자만 저장한 알림과 알림 기록을 확인할 수 있습니다.
          </div>
        )}

        <section className="mb-8 rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Artist Follow</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-900">팔로우한 아티스트</h2>
              <p className="mt-2 text-sm text-slate-500">
                이벤트 상세에서 팔로우한 아티스트를 여기서 다시 보고, 어떤 이벤트/날짜에 잡혀 있는지도 빠르게 확인할 수 있습니다.
              </p>
            </div>
            <div className="inline-flex h-fit items-center rounded-full bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900">
              총 {followedArtists.length}명
            </div>
          </div>

          {followedArtists.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm font-medium text-slate-900">아직 팔로우한 아티스트가 없습니다.</p>
              <p className="mt-2 text-sm text-slate-500">이벤트 상세의 lineup 카드에서 `+ Follow`를 누르면 여기에 쌓입니다.</p>
            </div>
          ) : (
            <>
              <div className="mt-5 flex flex-wrap gap-2">
                {followedArtists.map((artist) => (
                  <div
                    key={artist.slug}
                    className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950"
                  >
                    <span className="font-semibold">{artist.artistName}</span>
                    {artist.lastEventTitle ? (
                      <span className="text-xs text-amber-800">
                        최근 {artist.lastEventTitle}
                      </span>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => handleRemoveFollowedArtist(artist.artistName)}
                      className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-medium text-amber-900 hover:bg-white"
                    >
                      제거
                    </button>
                  </div>
                ))}
              </div>

              <div className="mt-6">
                <h3 className="text-lg font-semibold text-slate-900">팔로우한 아티스트가 포함된 일정</h3>
                {loadingFollowedArtists ? (
                  <p className="mt-3 text-sm text-slate-500">관련 이벤트와 날짜를 확인하는 중입니다.</p>
                ) : followedArtistMatches.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-500">현재 연결된 이벤트 데이터에서 팔로우한 아티스트 일정을 찾지 못했습니다.</p>
                ) : (
                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    {followedArtistMatches.map((match) => (
                      <Link
                        key={`${match.eventId}-${match.date}`}
                        href={`/events/${match.eventId}`}
                        className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition-colors hover:border-amber-300 hover:bg-amber-50"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-lg font-semibold text-slate-900">{match.eventTitle}</p>
                            <p className="mt-1 text-sm text-slate-500">{match.venue}</p>
                          </div>
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600">
                            {match.dayLabel}
                          </span>
                        </div>
                        <p className="mt-3 text-sm text-slate-600">{match.date}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {match.artistNames.map((artistName) => (
                            <span
                              key={`${match.eventId}-${match.date}-${artistName}`}
                              className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900"
                            >
                              {artistName}
                            </span>
                          ))}
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 예정된 알림 */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">예정된 알림</h2>
            <div className="space-y-4">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className="bg-white rounded-lg shadow p-6"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium text-gray-900">
                        {notification.events?.title}
                      </h3>
                      <p className="text-sm text-gray-500 mt-1">
                        {notification.type === 'ticketing' ? '티켓팅 알림' : '공연 시작 알림'}
                      </p>
                      <p className="text-sm text-gray-500">
                        {notification.type === 'ticketing'
                          ? notification.events?.ticket_open_time
                            ? new Date(notification.events.ticket_open_time).toLocaleString('ko-KR')
                            : '티켓 오픈 일정 미정'
                          : notification.events?.start_date
                            ? new Date(notification.events.start_date).toLocaleString('ko-KR')
                            : '공연 일정 미정'}
                      </p>
                      <p className="text-sm text-gray-500">
                        {notification.events?.venue}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Link
                        href={`/events/${notification.event_id}`}
                        className="text-indigo-600 hover:text-indigo-700"
                      >
                        상세보기
                      </Link>
                      <button
                        onClick={() => handleDeleteNotification(notification.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {notifications.length === 0 && (
                <p className="text-center text-gray-500 py-4">예정된 알림이 없습니다.</p>
              )}
            </div>
          </div>

          {/* 알림 기록 */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">알림 기록</h2>
            <div className="space-y-4">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="bg-white rounded-lg shadow p-6"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium text-gray-900">
                        {item.notifications?.events?.title}
                      </h3>
                      <p className="text-sm text-gray-500 mt-1">
                        {new Date(item.sent_at).toLocaleDateString('ko-KR', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                      <p className={`text-sm ${
                        item.status === 'sent' ? 'text-green-500' : 'text-red-500'
                      }`}>
                        {item.status === 'sent' ? '전송 완료' : '전송 실패'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}

              {history.length === 0 && (
                <p className="text-center text-gray-500 py-4">알림 기록이 없습니다.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 
