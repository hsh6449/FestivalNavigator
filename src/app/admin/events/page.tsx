'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type EventFormState = {
  title: string;
  artist: string;
  description: string;
  start_date: string;
  end_date: string;
  venue: string;
  venue_address: string;
  venue_lat: string;
  venue_lng: string;
  genre: string;
  image_url: string;
  price_range: string;
  ticket_url: string;
  ticket_open_time: string;
  age_limit: string;
  artist_profile: string;
};

const initialState: EventFormState = {
  title: '',
  artist: '',
  description: '',
  start_date: '',
  end_date: '',
  venue: '',
  venue_address: '',
  venue_lat: '',
  venue_lng: '',
  genre: '',
  image_url: '',
  price_range: '',
  ticket_url: '',
  ticket_open_time: '',
  age_limit: '',
  artist_profile: '',
};

export default function AdminEventsPage() {
  const [formData, setFormData] = useState<EventFormState>(initialState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const handleChange = (field: keyof EventFormState) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setSuccessMessage('');

    try {
      const supabase = createClient();
      const payload = {
        title: formData.title,
        artist: formData.artist,
        description: formData.description,
        start_date: formData.start_date,
        end_date: formData.end_date,
        venue: formData.venue,
        venue_address: formData.venue_address || null,
        venue_lat: formData.venue_lat ? Number(formData.venue_lat) : null,
        venue_lng: formData.venue_lng ? Number(formData.venue_lng) : null,
        genre: formData.genre,
        image_url: formData.image_url || null,
        price_range: formData.price_range || null,
        ticket_url: formData.ticket_url || null,
        ticket_open_time: formData.ticket_open_time || null,
        age_limit: formData.age_limit || null,
        artist_profile: formData.artist_profile || null,
      };

      const { error } = await supabase.from('events').insert(payload);
      if (error) throw error;

      setFormData(initialState);
      setSuccessMessage('공연 정보가 저장되었습니다.');
    } catch (submitError) {
      console.error('Error creating event:', submitError);
      alert('공연 정보를 저장하는 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-lg p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">공연 정보 등록 (관리자)</h1>
          <p className="text-sm text-gray-500 mb-8">
            외부 API가 준비되지 않은 경우, 아래 폼을 통해 공연 정보를 직접 등록할 수 있습니다.
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">공연명</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={handleChange('title')}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">아티스트</label>
                <input
                  type="text"
                  value={formData.artist}
                  onChange={handleChange('artist')}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">공연 시작</label>
                <input
                  type="datetime-local"
                  value={formData.start_date}
                  onChange={handleChange('start_date')}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">공연 종료</label>
                <input
                  type="datetime-local"
                  value={formData.end_date}
                  onChange={handleChange('end_date')}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">공연장</label>
                <input
                  type="text"
                  value={formData.venue}
                  onChange={handleChange('venue')}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">공연장 주소</label>
                <input
                  type="text"
                  value={formData.venue_address}
                  onChange={handleChange('venue_address')}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">위도</label>
                <input
                  type="number"
                  step="any"
                  value={formData.venue_lat}
                  onChange={handleChange('venue_lat')}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">경도</label>
                <input
                  type="number"
                  step="any"
                  value={formData.venue_lng}
                  onChange={handleChange('venue_lng')}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">장르</label>
                <input
                  type="text"
                  value={formData.genre}
                  onChange={handleChange('genre')}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">가격 정보</label>
                <input
                  type="text"
                  value={formData.price_range}
                  onChange={handleChange('price_range')}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="예: 88,000원 ~ 132,000원"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">티켓 URL</label>
                <input
                  type="url"
                  value={formData.ticket_url}
                  onChange={handleChange('ticket_url')}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="https://..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">티켓 오픈 시간</label>
                <input
                  type="datetime-local"
                  value={formData.ticket_open_time}
                  onChange={handleChange('ticket_open_time')}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">관람 등급</label>
                <input
                  type="text"
                  value={formData.age_limit}
                  onChange={handleChange('age_limit')}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="예: 만 12세 이상"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">공연 이미지 URL</label>
                <input
                  type="url"
                  value={formData.image_url}
                  onChange={handleChange('image_url')}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="https://..."
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">공연 소개</label>
              <textarea
                value={formData.description}
                onChange={handleChange('description')}
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                rows={4}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">아티스트 소개</label>
              <textarea
                value={formData.artist_profile}
                onChange={handleChange('artist_profile')}
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                rows={3}
              />
            </div>

            <div className="flex items-center justify-between">
              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50"
              >
                {isSubmitting ? '저장 중...' : '공연 등록'}
              </button>
              {successMessage && <span className="text-sm text-green-600">{successMessage}</span>}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
