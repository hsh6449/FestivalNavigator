type OneSignalInitOptions = {
  appId: string;
  allowLocalhostAsSecureOrigin?: boolean;
  notifyButton?: {
    enable?: boolean;
  };
};

type OneSignalNotificationsApi = {
  requestPermission?: () => Promise<void>;
};

type OneSignalApi = {
  push: (callback: () => void) => number;
  init: (options: OneSignalInitOptions) => void;
  isPushNotificationsSupported?: () => Promise<boolean>;
  Notifications?: OneSignalNotificationsApi;
};

declare global {
  interface Window {
    OneSignal?: OneSignalApi;
  }
}

export {};
