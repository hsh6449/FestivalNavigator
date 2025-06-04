'use client';

import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

type NotificationHistoryItem = {
  id: string;
  event_id: string;
  type: 'ticket' | 'event';
  events: {
    title: string;
  };
  created_at: string;
};

type NotificationHistoryProps = {
  history: NotificationHistoryItem[];
};

export default function NotificationHistory({ history }: NotificationHistoryProps) {
  if (history.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        알림 히스토리가 없습니다.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {history.map((item) => (
        <div
          key={item.id}
          className="bg-white rounded-lg shadow p-4"
        >
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-semibold">{item.events.title}</h3>
              <p className="text-sm text-gray-500">
                {item.type === 'ticket' ? '티켓팅' : '행사 시작'} 알림
              </p>
            </div>
            <span className="text-sm text-gray-500">
              {format(new Date(item.created_at), 'PPP HH:mm', { locale: ko })}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
} 