function toTime(input) {
  if (!input) return 0;
  const s = String(input).trim();
  if (/^\d{4}$/.test(s)) return Date.parse(`${s}-01-01T00:00:00Z`);
  if (/^\d{4}-\d{2}$/.test(s)) return Date.parse(`${s}-01T00:00:00Z`);
  const t = Date.parse(s);
  return Number.isNaN(t) ? 0 : t;
}

export function getCollectionUpdatedAt(item) {
  return String(item?.updated_at || item?.comment_updated_at || item?.created_at || "");
}

export function mergeCollectionData(cached, fresh) {
  const map = new Map();
  for (const item of cached || []) {
    if (!item) continue;
    map.set(item.subject_id, item);
  }
  for (const item of fresh || []) {
    if (!item) continue;
    const prev = map.get(item.subject_id);
    const prevTime = toTime(getCollectionUpdatedAt(prev));
    const currTime = toTime(getCollectionUpdatedAt(item));
    if (!prev || currTime >= prevTime) {
      map.set(item.subject_id, item);
    }
  }
  return Array.from(map.values());
}
