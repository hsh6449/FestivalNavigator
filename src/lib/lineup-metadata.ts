export type LineupNoteMetadata = {
  stageName?: string | null;
  stagePosition?: number | null;
};

const LINEUP_METADATA_PREFIX = '<!--FNMETA:';
const LINEUP_METADATA_SUFFIX = '-->';

const METADATA_PATTERN = /<!--FNMETA:([\s\S]*?)-->$/;

const normalizeMetadata = (metadata: LineupNoteMetadata): LineupNoteMetadata => {
  const stageName = metadata.stageName?.trim() || null;
  const stagePosition =
    typeof metadata.stagePosition === 'number' && Number.isFinite(metadata.stagePosition) && metadata.stagePosition > 0
      ? metadata.stagePosition
      : null;

  return {
    stageName,
    stagePosition,
  };
};

export const decodeLineupNote = (rawNote: string | null | undefined) => {
  const note = rawNote ?? '';
  const matched = note.match(METADATA_PATTERN);

  if (!matched) {
    return {
      visibleNote: note.trim(),
      metadata: {} as LineupNoteMetadata,
    };
  }

  const visibleNote = note.replace(METADATA_PATTERN, '').trim();

  try {
    const parsed = JSON.parse(matched[1]) as LineupNoteMetadata;
    return {
      visibleNote,
      metadata: normalizeMetadata(parsed ?? {}),
    };
  } catch {
    return {
      visibleNote: note.trim(),
      metadata: {} as LineupNoteMetadata,
    };
  }
};

export const encodeLineupNote = (visibleNote: string | null | undefined, metadata: LineupNoteMetadata) => {
  const normalizedVisibleNote = (visibleNote ?? '').replace(METADATA_PATTERN, '').trim();
  const normalizedMetadata = normalizeMetadata(metadata);
  const hasMetadata = Boolean(normalizedMetadata.stageName) || Boolean(normalizedMetadata.stagePosition);

  if (!hasMetadata) {
    return normalizedVisibleNote || null;
  }

  const metadataComment = `${LINEUP_METADATA_PREFIX}${JSON.stringify(normalizedMetadata)}${LINEUP_METADATA_SUFFIX}`;

  if (!normalizedVisibleNote) {
    return metadataComment;
  }

  return `${normalizedVisibleNote}\n\n${metadataComment}`;
};
