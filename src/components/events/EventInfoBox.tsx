'use client';

import { Event } from '@/types/database';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface EventInfoBoxProps {
  event: Event;
}

export default function EventInfoBox({ event }: EventInfoBoxProps) {
  return (
    <div className="space-y-6">
      <section className="bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">공연 일정</h3>
        <div className="space-y-2 text-gray-600">
          <div className="flex items-center">
            <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>
              {format(new Date(event.start_date), 'PPP', { locale: ko })} ~{' '}
              {format(new Date(event.end_date), 'PPP', { locale: ko })}
            </span>
          </div>
          <div className="flex items-center">
            <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>
              {format(new Date(event.start_date), 'HH:mm')} - {format(new Date(event.end_date), 'HH:mm')}
            </span>
          </div>
        </div>
      </section>

      <section className="bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">공연장 정보</h3>
        <div className="space-y-2 text-gray-600">
          <div className="flex items-center">
            <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>{event.venue}</span>
          </div>
          {event.venue_address && (
            <div className="flex items-center">
              <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18M4 6h16M4 18h16" />
              </svg>
              <span>{event.venue_address}</span>
            </div>
          )}
          <div className="flex items-center">
            <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
            <span>{event.genre}</span>
          </div>
        </div>
      </section>

      <section className="bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">티켓 정보</h3>
        <div className="space-y-2 text-gray-600">
          <p>가격: {event.price_range || '추후 안내'}</p>
          <p>
            티켓 오픈:{' '}
            {event.ticket_open_time
              ? format(new Date(event.ticket_open_time), 'PPP p', { locale: ko })
              : '추후 안내'}
          </p>
          <p>관람 등급: {event.age_limit || '추후 안내'}</p>
          {event.ticket_url ? (
            <a
              href={event.ticket_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center text-indigo-600 hover:text-indigo-700"
            >
              티켓 예매 페이지
            </a>
          ) : (
            <span className="text-sm text-gray-400">티켓 링크가 아직 없습니다.</span>
          )}
        </div>
      </section>
    </div>
  );
}
