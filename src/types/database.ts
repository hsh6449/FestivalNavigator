export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type NotificationType = 'ticketing' | 'start';
export type NotificationDeliveryStatus = 'sent' | 'failed';
export type EventType = 'festival' | 'concert';
export type ArtistType = 'solo' | 'band' | 'dj' | 'collective' | 'other';
export type EventArtistRole = 'headliner' | 'lineup' | 'guest' | 'opening';
export type EventArtistStatus = 'confirmed' | 'rumored' | 'cancelled';
export type ScheduleSlotType = 'performance' | 'break' | 'gate_open' | 'signing';
export type TicketLinkType = 'general' | 'vip' | 'waiting' | 'official_info';
export type TicketSalesStatus = 'upcoming' | 'open' | 'sold_out' | 'closed';

export interface Event {
  id: string;
  title: string;
  artist: string;
  description: string;
  start_date: string;
  end_date: string;
  venue: string;
  venue_address: string | null;
  venue_lat: number | null;
  venue_lng: number | null;
  genre: string;
  event_type: EventType | null;
  image_url: string | null;
  price_range: string | null;
  ticket_url: string | null;
  ticket_open_time: string | null;
  age_limit: string | null;
  artist_profile: string | null;
  created_at: string;
  updated_at: string;
}

export interface Artist {
  id: string;
  slug: string;
  name: string;
  name_en: string | null;
  artist_type: ArtistType;
  genres: string[] | null;
  bio: string | null;
  image_url: string | null;
  country_code: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface EventArtist {
  id: string;
  event_id: string;
  artist_id: string;
  role: EventArtistRole;
  display_order: number | null;
  is_headliner: boolean;
  announcement_status: EventArtistStatus;
  performance_date: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
  artists?: Artist | null;
}

export interface EventStage {
  id: string;
  event_id: string;
  performance_date: string | null;
  stage_name: string;
  display_order: number | null;
  is_hidden: boolean;
  created_at: string;
  updated_at: string;
}

export interface EventBoardSetting {
  id: string;
  event_id: string;
  day_key: string;
  visible_start_time: string;
  visible_end_time: string;
  interval_minutes: number;
  created_at: string;
  updated_at: string;
}

export interface ScheduleSlot {
  id: string;
  event_id: string;
  artist_id: string | null;
  event_artist_id: string | null;
  stage_name: string;
  slot_type: ScheduleSlotType;
  title: string | null;
  start_at: string;
  end_at: string;
  is_cancelled: boolean;
  source: string | null;
  created_at: string;
  updated_at: string;
  artists?: Pick<Artist, 'id' | 'name' | 'name_en'> | null;
}

export interface TicketLink {
  id: string;
  event_id: string;
  provider_name: string;
  provider_code: string | null;
  url: string;
  link_type: TicketLinkType;
  sales_status: TicketSalesStatus;
  opens_at: string | null;
  ends_at: string | null;
  price_note: string | null;
  is_primary: boolean;
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

export interface FollowedArtistRecord {
  id: string;
  user_id: string;
  artist_id: string | null;
  artist_slug: string;
  artist_name: string;
  last_event_id: string | null;
  last_event_title: string | null;
  last_seen_date: string | null;
  last_seen_stage: string | null;
  followed_at: string;
  created_at: string;
  updated_at: string;
}

export interface PlannerItemRecord {
  id: string;
  user_id: string;
  client_item_id: string;
  event_id: string;
  event_title: string;
  event_venue: string;
  event_image_url: string | null;
  planner_date: string;
  day_label: string;
  item_type: 'performance' | 'meal' | 'rest' | 'move' | 'custom';
  title: string;
  stage: string | null;
  artist: string | null;
  default_start: string | null;
  default_end: string | null;
  planned_start: string;
  planned_end: string;
  order_index: number | null;
  note: string | null;
  source: 'festival-slot' | 'manual';
  linked_slot_id: string | null;
  is_active: boolean;
  migrated_from_local: boolean;
  created_at: string;
  updated_at: string;
}

export type NotificationEventSummary = Pick<Event, 'title' | 'start_date' | 'venue' | 'ticket_open_time'>;
export type NotificationHistoryEventSummary = Pick<Event, 'title'>;

export interface Notification {
  id: string;
  user_id: string;
  event_id: string;
  type: NotificationType;
  created_at: string;
  updated_at: string;
  events?: NotificationEventSummary | null;
}

export interface NotificationHistory {
  id: string;
  notification_id: string;
  user_id: string;
  sent_at: string;
  status: NotificationDeliveryStatus;
  created_at: string;
  updated_at: string;
  notifications?: {
    events?: NotificationHistoryEventSummary | null;
  } | null;
}

export interface Database {
  public: {
    Tables: {
      events: {
        Row: Event;
        Insert: {
          id?: string;
          title: string;
          artist: string;
          description: string;
          start_date: string;
          end_date: string;
          venue: string;
          venue_address?: string | null;
          venue_lat?: number | null;
          venue_lng?: number | null;
          genre: string;
          event_type?: EventType | null;
          image_url?: string | null;
          price_range?: string | null;
          ticket_url?: string | null;
          ticket_open_time?: string | null;
          age_limit?: string | null;
          artist_profile?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          artist?: string;
          description?: string;
          start_date?: string;
          end_date?: string;
          venue?: string;
          venue_address?: string | null;
          venue_lat?: number | null;
          venue_lng?: number | null;
          genre?: string;
          event_type?: EventType | null;
          image_url?: string | null;
          price_range?: string | null;
          ticket_url?: string | null;
          ticket_open_time?: string | null;
          age_limit?: string | null;
          artist_profile?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      artists: {
        Row: Omit<Artist, 'genres'> & { genres: string[] | null };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          name_en?: string | null;
          artist_type?: ArtistType;
          genres?: string[] | null;
          bio?: string | null;
          image_url?: string | null;
          country_code?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          name?: string;
          name_en?: string | null;
          artist_type?: ArtistType;
          genres?: string[] | null;
          bio?: string | null;
          image_url?: string | null;
          country_code?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      event_artists: {
        Row: Omit<EventArtist, 'artists'>;
        Insert: {
          id?: string;
          event_id: string;
          artist_id: string;
          role?: EventArtistRole;
          display_order?: number | null;
          is_headliner?: boolean;
          announcement_status?: EventArtistStatus;
          performance_date?: string | null;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          artist_id?: string;
          role?: EventArtistRole;
          display_order?: number | null;
          is_headliner?: boolean;
          announcement_status?: EventArtistStatus;
          performance_date?: string | null;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      event_stages: {
        Row: EventStage;
        Insert: {
          id?: string;
          event_id: string;
          performance_date?: string | null;
          stage_name: string;
          display_order?: number | null;
          is_hidden?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          performance_date?: string | null;
          stage_name?: string;
          display_order?: number | null;
          is_hidden?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      event_board_settings: {
        Row: EventBoardSetting;
        Insert: {
          id?: string;
          event_id: string;
          day_key: string;
          visible_start_time: string;
          visible_end_time: string;
          interval_minutes?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          day_key?: string;
          visible_start_time?: string;
          visible_end_time?: string;
          interval_minutes?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      schedule_slots: {
        Row: Omit<ScheduleSlot, 'artists'>;
        Insert: {
          id?: string;
          event_id: string;
          artist_id?: string | null;
          event_artist_id?: string | null;
          stage_name: string;
          slot_type?: ScheduleSlotType;
          title?: string | null;
          start_at: string;
          end_at: string;
          is_cancelled?: boolean;
          source?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          artist_id?: string | null;
          event_artist_id?: string | null;
          stage_name?: string;
          slot_type?: ScheduleSlotType;
          title?: string | null;
          start_at?: string;
          end_at?: string;
          is_cancelled?: boolean;
          source?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      ticket_links: {
        Row: TicketLink;
        Insert: {
          id?: string;
          event_id: string;
          provider_name: string;
          provider_code?: string | null;
          url: string;
          link_type?: TicketLinkType;
          sales_status?: TicketSalesStatus;
          opens_at?: string | null;
          ends_at?: string | null;
          price_note?: string | null;
          is_primary?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          provider_name?: string;
          provider_code?: string | null;
          url?: string;
          link_type?: TicketLinkType;
          sales_status?: TicketSalesStatus;
          opens_at?: string | null;
          ends_at?: string | null;
          price_note?: string | null;
          is_primary?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      reviews: {
        Row: Review;
        Insert: {
          id?: string;
          event_id: string;
          user_id: string;
          rating: number;
          content: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          user_id?: string;
          rating?: number;
          content?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      notifications: {
        Row: Omit<Notification, 'events'>;
        Insert: {
          id?: string;
          user_id: string;
          event_id: string;
          type: NotificationType;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          event_id?: string;
          type?: NotificationType;
          created_at?: string;
          updated_at?: string;
        };
      };
      followed_artists: {
        Row: FollowedArtistRecord;
        Insert: {
          id?: string;
          user_id: string;
          artist_id?: string | null;
          artist_slug: string;
          artist_name: string;
          last_event_id?: string | null;
          last_event_title?: string | null;
          last_seen_date?: string | null;
          last_seen_stage?: string | null;
          followed_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          artist_id?: string | null;
          artist_slug?: string;
          artist_name?: string;
          last_event_id?: string | null;
          last_event_title?: string | null;
          last_seen_date?: string | null;
          last_seen_stage?: string | null;
          followed_at?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      planner_items: {
        Row: PlannerItemRecord;
        Insert: {
          id?: string;
          user_id: string;
          client_item_id: string;
          event_id: string;
          event_title: string;
          event_venue: string;
          event_image_url?: string | null;
          planner_date: string;
          day_label: string;
          item_type: 'performance' | 'meal' | 'rest' | 'move' | 'custom';
          title: string;
          stage?: string | null;
          artist?: string | null;
          default_start?: string | null;
          default_end?: string | null;
          planned_start: string;
          planned_end: string;
          order_index?: number | null;
          note?: string | null;
          source: 'festival-slot' | 'manual';
          linked_slot_id?: string | null;
          is_active?: boolean;
          migrated_from_local?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          client_item_id?: string;
          event_id?: string;
          event_title?: string;
          event_venue?: string;
          event_image_url?: string | null;
          planner_date?: string;
          day_label?: string;
          item_type?: 'performance' | 'meal' | 'rest' | 'move' | 'custom';
          title?: string;
          stage?: string | null;
          artist?: string | null;
          default_start?: string | null;
          default_end?: string | null;
          planned_start?: string;
          planned_end?: string;
          order_index?: number | null;
          note?: string | null;
          source?: 'festival-slot' | 'manual';
          linked_slot_id?: string | null;
          is_active?: boolean;
          migrated_from_local?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      notification_history: {
        Row: Omit<NotificationHistory, 'notifications'>;
        Insert: {
          id?: string;
          notification_id: string;
          user_id: string;
          sent_at: string;
          status: NotificationDeliveryStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          notification_id?: string;
          user_id?: string;
          sent_at?: string;
          status?: NotificationDeliveryStatus;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
