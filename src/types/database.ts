Need to install the following packages:
supabase@2.24.3
Ok to proceed? (y) 

export interface Event {
  id: string;
  title: string;
  artist: string;
  description: string;
  start_date: string;
  end_date: string;
  venue: string;
  genre: string;
  image_url?: string;
  created_at: string;
  updated_at: string;
}

export interface Review {
  id: string;
  event_id: string;
  user_id: string;
  rating: number;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  event_id: string;
  type: 'ticketing' | 'start';
  created_at: string;
  updated_at: string;
}

export interface NotificationHistory {
  id: string;
  notification_id: string;
  user_id: string;
  sent_at: string;
  status: 'sent' | 'failed';
  created_at: string;
  updated_at: string;
} 