'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient, hasSupabaseEnv } from '@/lib/supabase/client';
import { NotificationType } from '@/types/database';

type NotificationButtonProps = {
  eventId: string;
  type: NotificationType;
  label: string;
};

export default function NotificationButton({
  eventId,
  type,
  label,
}: NotificationButtonProps) {
  const isSupabaseReady = hasSupabaseEnv();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const loadSubscription = useCallback(async () => {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setIsSubscribed(false);
        return;
      }

      const { data, error } = await supabase
        .from('notifications')
        .select('id')
        .eq('event_id', eventId)
        .eq('type', type)
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setIsSubscribed(Boolean(data));
    } catch (error) {
      console.error('Error checking notification subscription:', error);
    }
  }, [eventId, type]);

  useEffect(() => {
    if (!isSupabaseReady) {
      setIsSubscribed(false);
      return;
    }

    void loadSubscription();
  }, [isSupabaseReady, loadSubscription]);

  const handleSubscribe = async () => {
    try {
      setIsLoading(true);

      if (!isSupabaseReady) {
        alert('Supabase 설정을 완료하면 알림을 저장할 수 있습니다.');
        return;
      }

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        alert('알림을 저장하려면 먼저 로그인해야 합니다.');
        return;
      }

      if (
        window.OneSignal &&
        typeof window.OneSignal.isPushNotificationsSupported === 'function' &&
        typeof window.OneSignal.Notifications?.requestPermission === 'function'
      ) {
        const isPushSupported = await window.OneSignal.isPushNotificationsSupported();
        if (isPushSupported) {
          await window.OneSignal.Notifications.requestPermission();
        }
      }

      const { error } = await supabase.from('notifications').insert({
        event_id: eventId,
        type,
        user_id: user.id,
      });

      if (error) throw error;

      setIsSubscribed(true);
      alert(`${label}이 설정되었습니다.`);
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
          : isSupabaseReady
            ? 'bg-green-500 hover:bg-green-600'
            : 'bg-gray-400'
      } inline-flex items-center justify-center rounded-md px-4 py-2 text-white transition-colors disabled:opacity-50`}
    >
      {isLoading
        ? '설정 중...'
        : isSubscribed
        ? '알림 설정됨'
        : label}
    </button>
  );
}
