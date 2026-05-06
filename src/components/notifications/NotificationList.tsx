'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { createClient } from '@/lib/supabase/client';
import { Notification } from '@/types/database';

type NotificationListProps = {
  notifications: Notification[];
};

export default function NotificationList({ notifications: initialNotifications }: NotificationListProps) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    try {
      setIsLoading(id);
      const supabase = createClient();
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setNotifications(notifications.filter(n => n.id !== id));
    } catch (error) {
      console.error('Error deleting notification:', error);
      alert('알림 삭제에 실패했습니다.');
    } finally {
      setIsLoading(null);
    }
  };

  if (notifications.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        설정된 알림이 없습니다.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className="bg-white rounded-lg shadow p-4"
        >
          <div className="flex justify-between items-start mb-2">
            <div>
              <h3 className="font-semibold">{notification.events?.title ?? '공연 정보 없음'}</h3>
              <p className="text-sm text-gray-600">{notification.events?.venue ?? '공연장 정보 없음'}</p>
            </div>
            <button
              onClick={() => handleDelete(notification.id)}
              disabled={isLoading === notification.id}
              className="text-red-500 hover:text-red-600 disabled:opacity-50"
            >
              삭제
            </button>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <div>
              <span className="text-gray-500">
                {notification.type === 'ticketing' ? '티켓팅' : '공연 시작'} 알림
              </span>
              <span className="mx-2">•</span>
              <span>
                {notification.type === 'ticketing'
                  ? notification.events?.ticket_open_time
                    ? format(new Date(notification.events.ticket_open_time), 'PPP HH:mm', { locale: ko })
                    : '티켓 오픈 일정 미정'
                  : notification.events?.start_date
                    ? format(new Date(notification.events.start_date), 'PPP HH:mm', { locale: ko })
                    : '공연 일정 미정'}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
} 
