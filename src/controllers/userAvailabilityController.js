import userAvailabilityService from '../services/userAvailabilityService.js';

function formatDate(d) {
  return d.toISOString().slice(0, 10);
}

function isWeekLocked(key) {
  const moscow = new Date(`${key}T00:00:00+03:00`);
  const dayNum = moscow.getUTCDay();
  const mondayMs = moscow.getTime() - ((dayNum + 6) % 7) * 24 * 60 * 60 * 1000;
  const tuesdayEndMs =
    mondayMs + 24 * 60 * 60 * 1000 + (23 * 60 * 60 + 59 * 60 + 59) * 1000;
  return Date.now() >= tuesdayEndMs;
}

export default {
  async list(req, res) {
    const today = new Date();
    const start = formatDate(today);
    const end = new Date(today);
    end.setDate(end.getDate() + (7 - end.getDay()) + 7);
    const endStr = formatDate(end);
    const records = await userAvailabilityService.listForUser(
      req.user.id,
      start,
      endStr
    );
    const map = new Map(records.map((r) => [r.date, r]));
    const days = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const key = formatDate(d);
      const rec = map.get(key);
      // Determine editability: lock edits within 72 hours to the day's start in Moscow time (+03:00)
      const moscowStart = new Date(`${key}T00:00:00+03:00`).getTime();
      let editable = Date.now() < moscowStart - 72 * 60 * 60 * 1000;
      if (isWeekLocked(key)) editable = false;
      days.push({
        date: key,
        status: rec?.AvailabilityType?.alias ?? 'FREE',
        from_time: rec?.from_time ?? null,
        to_time: rec?.to_time ?? null,
        preset: !!rec, // indicates whether value was explicitly set by user
        editable,
        week_locked: isWeekLocked(key),
      });
    }
    res.json({ days });
  },

  async set(req, res) {
    await userAvailabilityService.setForUser(
      req.user.id,
      req.body.days || [],
      req.user.id,
      { enforcePolicy: true }
    );
    res.status(204).end();
  },
};
