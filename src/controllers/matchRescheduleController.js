import { validationResult } from 'express-validator';

import { reschedulePostponedMatch } from '../services/matchRescheduleService.js';

export default {
  async reschedule(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const { date } = req.body || {};
      await reschedulePostponedMatch({
        matchId: req.params.id,
        date,
        actorId: req.user.id,
      });
      return res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  },
};
