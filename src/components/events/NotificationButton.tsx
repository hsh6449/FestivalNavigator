'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';

type NotificationButtonProps = {
  eventId: string;
  type: 'ticket' | 'event';
  date: string;
};

export default function NotificationButton({
  eventId,
  type,
  date,
}: NotificationButtonProps) {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubscribe = async () => {
    try {
      setIsLoading(true);

      // OneSignal 구독 요청
      if (!window.OneSignal) {
        console.error('OneSignal is not initialized');
        return;
      }

      const isPushSupported = await window.OneSignal.isPushNotificationsSupported();
      if (!isPushSupported) {
        alert('이 브라우저는 푸시 알림을 지원하지 않습니다.');
        return;
      }

      const permission = await window.OneSignal.Notifications.requestPermission();
      if (!permission) {
        alert('알림 권한이 필요합니다.');
        return;
      }

      // Supabase에 알림 설정 저장
      const { error } = await supabase.from('notifications').insert({
        event_id: eventId,
        type,
        notification_date: date,
        user_id: (await supabase.auth.getUser()).data.user?.id,
      });

      if (error) throw error;

      setIsSubscribed(true);
      alert('알림이 설정되었습니다!');
    } catch (error) {
      console.error('Error setting notification:', error);
      alert('알림 설정에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleSubscribe}
      disabled={isLoading || isSubscribed}
      className={`${
        isSubscribed
          ? 'bg-gray-500'
          : 'bg-green-500 hover:bg-green-600'
      } text-white px-4 py-2 rounded transition-colors disabled:opacity-50`}
    >
      {isLoading
        ? '설정 중...'
        : isSubscribed
        ? '알림 설정됨'
        : '알림 설정'}
    </button>
  );
} 