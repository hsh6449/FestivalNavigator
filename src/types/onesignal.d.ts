interface OneSignal {
  isPushNotificationsSupported(): Promise<boolean>;
  Notifications: {
    requestPermission(): Promise<boolean>;
  };
}

declare global {
  interface Window {
    OneSignal: any;
  }
} 