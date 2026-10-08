import { parse } from 'csv-parse/sync';

// Reads product CSV (conventions in docs/DATA_FORMAT.md) into plain records that
// still need ProductInput validation:
//   lists:  "a | b | c"
//   maps:   "key: value | key: value"  (comma-separated values become lists in `attributes`)

const LIST_FIELDS = ['features', 'seed_keywords'];
const MAP_FIELDS = ['specifications', 'attributes'];

const splitList = (text) => text.split('|').map((item) => item.trim()).filter(Boolean);

function splitMap(text, { listValues }) {
  const entries = splitList(text)
    .map((pair) => pair.split(/:(.*)/s).map((part) => part?.trim()))
    .filter(([key, value]) => key && value)
    .map(([key, value]) => [key, listValues ? attributeValue(value) : value]);
  return Object.fromEntries(entries);
}

function attributeValue(value) {
  if (value === 'true' || value === 'false') return value === 'true';
  return value.includes(',') ? value.split(',').map((item) => item.trim()).filter(Boolean) : value;
}

export function parseProductsCsv(text) {
  const rows = parse(text, { columns: true, skip_empty_lines: true, trim: true, bom: true });

  return rows.map((row) => {
    const record = {};
    for (const [column, value] of Object.entries(row)) {
      if (value === '') continue;
      if (LIST_FIELDS.includes(column)) record[column] = splitList(value);
      else if (MAP_FIELDS.includes(column)) record[column] = splitMap(value, { listValues: column === 'attributes' });
      else record[column] = value;
    }
    return record;
  });
}
