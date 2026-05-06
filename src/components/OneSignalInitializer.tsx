'use client';

import Script from 'next/script';

export default function OneSignalInitializer() {
  const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;

  if (!appId) {
    return null;
  }

  const handleScriptLoad = () => {
    if (typeof window !== 'undefined') {
      const oneSignal = window.OneSignal;

      if (!oneSignal) {
        return;
      }

      oneSignal.push(() => {
        oneSignal.init({
          appId,
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
