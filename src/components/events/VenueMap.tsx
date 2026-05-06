'use client';

import { useState } from 'react';

type VenueMapProps = {
  title: string;
  venue: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
};

export default function VenueMap({
  title,
  venue,
  address,
  latitude,
  longitude,
}: VenueMapProps) {
  const [hasMapError, setHasMapError] = useState(false);

  if (latitude === null || longitude === null || hasMapError) {
    const searchQuery = encodeURIComponent(address || `${title} ${venue}`);
    const directionsUrl = `https://www.google.com/maps/search/?api=1&query=${searchQuery}`;

    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-white p-4 text-sm text-gray-600">
        <p className="font-medium text-gray-900">{venue}</p>
        {address ? (
          <p className="mt-2">{address}</p>
        ) : (
          <p className="mt-2">등록된 상세 위치 정보가 없습니다.</p>
        )}
        <a
          href={directionsUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex text-indigo-600 hover:text-indigo-700"
        >
          지도에서 열기
        </a>
      </div>
    );
  }

  const mapQuery = encodeURIComponent(`${latitude},${longitude}`);
  const mapTitle = encodeURIComponent(`${title} ${venue}`);
  const embedUrl = `https://maps.google.com/maps?q=${mapQuery}&z=15&output=embed`;
  const directionsUrl = `https://www.google.com/maps/search/?api=1&query=${mapQuery}%20(${mapTitle})`;
  const routeUrl = `https://www.google.com/maps/dir/?api=1&destination=${mapQuery}`;

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <iframe
        title={`${venue} 지도`}
        src={embedUrl}
        className="h-72 w-full border-0"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        onError={() => setHasMapError(true)}
      />
      <div className="border-t border-gray-200 px-4 py-3 text-sm text-gray-600">
        <p className="font-medium text-gray-900">{venue}</p>
        {address && <p className="mt-1">{address}</p>}
        <a
          href={directionsUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex text-indigo-600 hover:text-indigo-700"
        >
          Google Maps에서 열기
        </a>
        <a
          href={routeUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-2 ml-4 inline-flex text-slate-600 hover:text-slate-900"
        >
          현재 위치에서 길찾기
        </a>
      </div>
    </div>
  );
}
