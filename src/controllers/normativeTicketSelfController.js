import { validationResult } from 'express-validator';

import normativeTicketService from '../services/normativeTicketService.js';
import { sendError } from '../utils/api.js';

export default {
  async create(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const first = errors.array()[0];
      return res.status(400).json({
        error: first.msg || 'validation_error',
        errors: errors.array(),
      });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'file_required' });
    }
    try {
      const ticket = await normativeTicketService.createForUser(
        req.user.id,
        req.body,
        req.file,
        req.user.id
      );
      return res.status(201).json({ ticket_id: ticket.ticket_id });
    } catch (err) {
      return sendError(res, err);
    }
  },
};
