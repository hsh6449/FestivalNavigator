'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { supabase } from '@/lib/supabase/client';

type Notification = {
  id: string;
  event_id: string;
  type: 'ticket' | 'event';
  notification_date: string;
  events: {
    title: string;
    venue: string;
  };
};

type NotificationListProps = {
  notifications: Notification[];
};

export default function NotificationList({ notifications: initialNotifications }: NotificationListProps) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    try {
      setIsLoading(id);
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

  const handleUpdateTime = async (id: string, hours: number) => {
    try {
      setIsLoading(id);
      const notification = notifications.find(n => n.id === id);
      if (!notification) return;

      const newDate = new Date(notification.notification_date);
      newDate.setHours(newDate.getHours() - hours);

      const { error } = await supabase
        .from('notifications')
        .update({ notification_date: newDate.toISOString() })
        .eq('id', id);

      if (error) throw error;

      setNotifications(notifications.map(n => 
        n.id === id 
          ? { ...n, notification_date: newDate.toISOString() }
          : n
      ));
    } catch (error) {
      console.error('Error updating notification time:', error);
      alert('알림 시간 변경에 실패했습니다.');
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
              <h3 className="font-semibold">{notification.events.title}</h3>
              <p className="text-sm text-gray-600">{notification.events.venue}</p>
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
                {notification.type === 'ticket' ? '티켓팅' : '행사 시작'} 알림
              </span>
              <span className="mx-2">•</span>
              <span>
                {format(new Date(notification.notification_date), 'PPP HH:mm', { locale: ko })}
              </span>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => handleUpdateTime(notification.id, 1)}
                disabled={isLoading === notification.id}
                className="text-blue-500 hover:text-blue-600 disabled:opacity-50"
              >
                1시간 전
              </button>
              <button
                onClick={() => handleUpdateTime(notification.id, 24)}
                disabled={isLoading === notification.id}
                className="text-blue-500 hover:text-blue-600 disabled:opacity-50"
              >
                1일 전
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
} 