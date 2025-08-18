import userAvailabilityService from '../services/userAvailabilityService.js';

function formatDate(d) {
  return d.toISOString().slice(0, 10);
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
      days.push({
        date: key,
        status: rec?.AvailabilityType?.alias ?? 'FREE',
        from_time: rec?.from_time ?? null,
        to_time: rec?.to_time ?? null,
      });
    }
    res.json({ days });
  },

  async set(req, res) {
    await userAvailabilityService.setForUser(
      req.user.id,
      req.body.days || [],
      req.user.id
    );
    res.status(204).end();
  },
};
