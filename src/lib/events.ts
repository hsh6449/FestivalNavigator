import { createClient } from '@/lib/supabase/client';
import { Event } from '@/types/database';

const apiUrl = process.env.NEXT_PUBLIC_EVENTS_API_URL;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const toEvent = (data: unknown): Event | null => {
  if (!isRecord(data)) return null;

  return {
    id: String(data.id ?? ''),
    title: String(data.title ?? ''),
    artist: String(data.artist ?? ''),
    description: String(data.description ?? ''),
    start_date: String(data.start_date ?? ''),
    end_date: String(data.end_date ?? ''),
    venue: String(data.venue ?? ''),
    venue_address: data.venue_address ? String(data.venue_address) : undefined,
    venue_lat: typeof data.venue_lat === 'number' ? data.venue_lat : undefined,
    venue_lng: typeof data.venue_lng === 'number' ? data.venue_lng : undefined,
    genre: String(data.genre ?? ''),
    image_url: data.image_url ? String(data.image_url) : undefined,
    price_range: data.price_range ? String(data.price_range) : undefined,
    ticket_url: data.ticket_url ? String(data.ticket_url) : undefined,
    ticket_open_time: data.ticket_open_time ? String(data.ticket_open_time) : undefined,
    age_limit: data.age_limit ? String(data.age_limit) : undefined,
    artist_profile: data.artist_profile ? String(data.artist_profile) : undefined,
    created_at: String(data.created_at ?? ''),
    updated_at: String(data.updated_at ?? ''),
  };
};

const coerceEvents = (payload: unknown): Event[] => {
  if (!Array.isArray(payload)) return [];
  return payload.map(toEvent).filter((event): event is Event => Boolean(event));
};

export const fetchEvents = async (): Promise<Event[]> => {
  if (apiUrl) {
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error('Failed to fetch events from API');
    }
    const payload = await response.json();
    return coerceEvents(payload);
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .order('start_date', { ascending: true });

  if (error) throw error;
  return data || [];
};

export const fetchEventById = async (id: string): Promise<Event | null> => {
  if (apiUrl) {
    const response = await fetch(`${apiUrl}/${id}`);
    if (!response.ok) {
      throw new Error('Failed to fetch event from API');
    }
    const payload = await response.json();
    return toEvent(payload);
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
};
