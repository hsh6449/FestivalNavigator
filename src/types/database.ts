export interface Event {
  id: string;
  title: string;
  artist: string;
  description: string;
  start_date: string;
  end_date: string;
  venue: string;
  venue_address?: string;
  venue_lat?: number;
  venue_lng?: number;
  genre: string;
  image_url?: string;
  price_range?: string;
  ticket_url?: string;
  ticket_open_time?: string;
  age_limit?: string;
  artist_profile?: string;
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
