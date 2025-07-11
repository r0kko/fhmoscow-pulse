import { validationResult } from 'express-validator';

import ticketService from '../services/ticketService.js';
import ticketMapper from '../mappers/ticketMapper.js';
import { sendError } from '../utils/api.js';

export default {
  async list(req, res) {
    const tickets = await ticketService.listByUser(req.user.id);
    return res.json({ tickets: tickets.map(ticketMapper.toPublic) });
  },

  async create(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const ticket = await ticketService.createForUser(
        req.user.id,
        req.body,
        req.user.id
      );
      return res.status(201).json({ ticket: ticketMapper.toPublic(ticket) });
    } catch (err) {
      return sendError(res, err);
    }
  },
};
