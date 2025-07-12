import { validationResult } from 'express-validator';

import ticketService from '../services/ticketService.js';
import ticketMapper from '../mappers/ticketMapper.js';
import fileService from '../services/fileService.js';
import fileMapper from '../mappers/fileMapper.js';
import { sendError } from '../utils/api.js';

export default {
  async list(req, res) {
    const tickets = await ticketService.listByUser(req.user.id);
    const result = [];
    for (const t of tickets) {
      const ticket = ticketMapper.toPublic(t);
      const files = await fileService.listForTicket(t.id);
      ticket.files = [];
      for (const f of files) {
        const url = await fileService.getDownloadUrl(f.File);
        ticket.files.push(fileMapper.toPublic(f, url));
      }
      result.push(ticket);
    }
    return res.json({ tickets: result });
  },

  async create(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const requiresFile = req.body.type_alias === 'MED_CERT_UPLOAD';
    if (requiresFile && !req.file) {
      return res.status(400).json({ error: 'file_required' });
    }
    try {
      const ticket = await ticketService.createForUser(
        req.user.id,
        req.body,
        req.user.id
      );
      if (req.file) {
        try {
          await fileService.uploadForTicket(ticket.id, req.file, req.user.id);
        } catch (err) {
          await ticketService.removeForUser(req.user.id, ticket.id, req.user.id);
          throw err;
        }
      }
      return res.status(201).json({ ticket: ticketMapper.toPublic(ticket) });
    } catch (err) {
      return sendError(res, err);
    }
  },

  async remove(req, res) {
    try {
      await ticketService.removeForUser(
        req.user.id,
        req.params.id,
        req.user.id
      );
      return res.status(204).end();
    } catch (err) {
      return sendError(res, err, 404);
    }
  },
};
