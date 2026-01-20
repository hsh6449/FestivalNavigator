'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Event } from '@/types/database';
import EventInfoBox from '@/components/events/EventInfoBox';
import EventReviews from '@/components/events/EventReviews';
import { fetchEventById } from '@/lib/events';

export default function EventDetailPage() {
  const params = useParams();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEvent();
  }, [params.id]);

  const fetchEvent = async () => {
    try {
      const data = await fetchEventById(String(params.id));
      setEvent(data);
    } catch (error) {
      console.error('Error fetching event:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500 text-lg">공연 정보를 찾을 수 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {event.image_url && (
            <div className="relative h-96">
              <img
                src={event.image_url}
                alt={event.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}
          
          <div className="p-6">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">{event.title}</h1>
                <p className="text-xl text-gray-600">{event.artist}</p>
              </div>
              <div className="bg-indigo-50 text-indigo-700 px-4 py-2 rounded-md text-sm font-medium">
                공연 상세 정보를 확인하세요
              </div>
            </div>

            <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-8">
                <section>
                  <h2 className="text-2xl font-semibold text-gray-900 mb-4">공연 소개</h2>
                  <p className="text-gray-600 whitespace-pre-line">{event.description}</p>
                </section>

                {event.artist_profile && (
                  <section>
                    <h2 className="text-2xl font-semibold text-gray-900 mb-4">아티스트 소개</h2>
                    <p className="text-gray-600 whitespace-pre-line">{event.artist_profile}</p>
                  </section>
                )}

                {event.image_url && (
                  <section>
                    <h2 className="text-2xl font-semibold text-gray-900 mb-4">미디어</h2>
                    <div className="rounded-lg overflow-hidden border border-gray-200">
                      <img
                        src={event.image_url}
                        alt={`${event.title} 미디어`}
                        className="w-full h-auto object-cover"
                      />
                    </div>
                  </section>
                )}

                <section>
                  <EventReviews eventId={event.id} />
                </section>
              </div>

              <div className="lg:col-span-1">
                <EventInfoBox event={event} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 
