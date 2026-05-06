const detectDelimiter = (line: string) => {
  if (line.includes('\t')) return '\t';
  if (line.includes(',')) return ',';
  return '\t';
};

const splitRow = (line: string, delimiter: string) =>
  line.split(delimiter).map((cell) => cell.trim());

export const parseTableText = (input: string) => {
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return [];
  }

  const delimiter = detectDelimiter(lines[0]);
  const headers = splitRow(lines[0], delimiter);

  return lines.slice(1).map((line) => {
    const values = splitRow(line, delimiter);

    return headers.reduce<Record<string, string>>((record, header, index) => {
      record[header] = values[index] ?? '';
      return record;
    }, {});
  });
};

export const normalizeSlug = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9가-힣]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const toDateTimeLocalValue = (value: string | null | undefined) => {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 16);
  }

  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
};

export const combineDateAndTime = (date: string, time: string) => {
  if (!date || !time) return '';
  if (time.includes('T')) return time.slice(0, 16);
  return `${date}T${time}`;
};

export const parseBooleanCell = (value: string) =>
  ['true', '1', 'yes', 'y', 'o'].includes(value.trim().toLowerCase());
