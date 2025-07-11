import { validationResult } from 'express-validator';

import ticketService from '../services/ticketService.js';
import ticketMapper from '../mappers/ticketMapper.js';
import { sendError } from '../utils/api.js';

export default {
  async list(req, res) {
    try {
      const tickets = await ticketService.listByUser(req.params.id);
      return res.json({ tickets: tickets.map(ticketMapper.toPublic) });
    } catch (err) {
      return sendError(res, err);
    }
  },

  async create(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const ticket = await ticketService.createForUser(
        req.params.id,
        req.body,
        req.user.id
      );
      return res.status(201).json({ ticket: ticketMapper.toPublic(ticket) });
    } catch (err) {
      return sendError(res, err, err.status === 404 ? 404 : undefined);
    }
  },

  async update(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const ticket = await ticketService.updateForUser(
        req.params.id,
        req.params.ticketId,
        req.body,
        req.user.id
      );
      return res.json({ ticket: ticketMapper.toPublic(ticket) });
    } catch (err) {
      return sendError(res, err, 404);
    }
  },

  async remove(req, res) {
    try {
      await ticketService.removeForUser(
        req.params.id,
        req.params.ticketId,
        req.user.id
      );
      return res.status(204).end();
    } catch (err) {
      return sendError(res, err, 404);
    }
  },
};
