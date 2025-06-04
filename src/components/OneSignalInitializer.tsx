'use client';

import Script from 'next/script';
import { useEffect } from 'react';

export default function OneSignalInitializer() {
  const handleScriptLoad = () => {
    if (typeof window !== 'undefined') {
      window.OneSignal = window.OneSignal || [];
      window.OneSignal.push(function() {
        window.OneSignal.init({
          appId: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID!,
          allowLocalhostAsSecureOrigin: true,
          notifyButton: {
            enable: false,
          },
        });
      });
    }
  };

  return (
    <Script
      src="https://cdn.onesignal.com/sdks/OneSignalSDK.js"
      strategy="afterInteractive"
      onLoad={handleScriptLoad}
    />
  );
} 