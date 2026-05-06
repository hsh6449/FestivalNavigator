import { createLocalFirstCollectionStore } from '@/lib/user-state-storage';

export type FollowedArtist = {
  slug: string;
  artistName: string;
  followedAt: string;
  lastEventId: string | null;
  lastEventTitle: string | null;
  lastSeenDate: string | null;
  lastSeenStage: string | null;
};

type FollowedArtistInput = {
  artistName: string;
  eventId?: string | null;
  eventTitle?: string | null;
  date?: string | null;
  stage?: string | null;
};

const STORAGE_KEY = 'festival-navigator:followed-artists';

export const normalizeArtistName = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

const sortFollowedArtists = (artists: FollowedArtist[]) =>
  artists
    .slice()
    .sort((left, right) => left.artistName.localeCompare(right.artistName, 'ko'));

const isFollowedArtistRecord = (value: unknown): value is FollowedArtist => {
  if (typeof value !== 'object' || value === null) return false;

  const candidate = value as Partial<FollowedArtist>;
  return (
    typeof candidate.slug === 'string' &&
    typeof candidate.artistName === 'string' &&
    typeof candidate.followedAt === 'string'
  );
};

const followedArtistsStore = createLocalFirstCollectionStore<FollowedArtist>({
  storageKey: STORAGE_KEY,
  futureRemoteTable: 'followed_artists',
  isItem: isFollowedArtistRecord,
  sortItems: sortFollowedArtists,
  onReadError: (error) => {
    console.error('Failed to read followed artists:', error);
  },
  onWriteError: (error) => {
    console.error('Failed to write followed artists:', error);
  },
});

export const followedArtistsStorageInfo = followedArtistsStore.storageInfo;

export const getFollowedArtists = (): FollowedArtist[] => {
  return followedArtistsStore.getAll();
};

export const isArtistFollowed = (artistName: string) => {
  const slug = normalizeArtistName(artistName);
  return getFollowedArtists().some((artist) => artist.slug === slug);
};

export const toggleFollowedArtist = (input: FollowedArtistInput) => {
  const slug = normalizeArtistName(input.artistName);
  const current = getFollowedArtists();
  const existing = current.find((artist) => artist.slug === slug);

  if (existing) {
    const next = current.filter((artist) => artist.slug !== slug);
    const stored = followedArtistsStore.replaceAll(next);
    return {
      followed: false,
      artists: stored,
    };
  }

  const nextArtist: FollowedArtist = {
    slug,
    artistName: input.artistName.trim(),
    followedAt: new Date().toISOString(),
    lastEventId: input.eventId ?? null,
    lastEventTitle: input.eventTitle ?? null,
    lastSeenDate: input.date ?? null,
    lastSeenStage: input.stage ?? null,
  };

  const next = [...current, nextArtist];
  const stored = followedArtistsStore.replaceAll(next);

  return {
    followed: true,
    artists: stored,
  };
};

export const removeFollowedArtist = (artistName: string) => {
  const slug = normalizeArtistName(artistName);
  const next = getFollowedArtists().filter((artist) => artist.slug !== slug);
  return followedArtistsStore.replaceAll(next);
};
