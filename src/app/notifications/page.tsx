'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Notification, NotificationHistory } from '@/types/database';
import Link from 'next/link';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [history, setHistory] = useState<NotificationHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
    fetchHistory();
  }, []);

  const fetchNotifications = async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;

      const { data, error } = await supabase
        .from('notifications')
        .select(`
          *,
          events (
            title,
            start_date,
            venue
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotifications(data || []);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const fetchHistory = async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;

      const { data, error } = await supabase
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
        .order('sent_at', { ascending: false });

      if (error) throw error;
      setHistory(data || []);
    } catch (error) {
      console.error('Error fetching notification history:', error);
    } finally {
      setLoading(false);
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
      fetchNotifications();
    } catch (error) {
      console.error('Error deleting notification:', error);
      alert('알림 삭제 중 오류가 발생했습니다.');
    }
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
                        {new Date(notification.events?.start_date || '').toLocaleDateString('ko-KR')}
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