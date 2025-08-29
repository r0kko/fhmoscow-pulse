import ticketService from '../services/ticketService.js';
import ticketMapper from '../mappers/ticketMapper.js';
import fileService from '../services/fileService.js';
import fileMapper from '../mappers/fileMapper.js';
import { sendError } from '../utils/api.js';

export default {
  async listAll(req, res) {
    const {
      page = '1',
      limit = '20',
      user = '',
      type = '',
      status = '',
    } = req.query;
    try {
      const { rows, count } = await ticketService.listAll({
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        user: user.trim(),
        type: type.trim(),
        status: status.trim(),
      });
      const result = [];
      for (const t of rows) {
        const ticket = ticketMapper.toPublic(t);
        ticket.user = {
          id: t.User.id,
          first_name: t.User.first_name,
          last_name: t.User.last_name,
        };
        ticket.files = [];
        for (const f of t.TicketFiles) {
          const url = await fileService.getDownloadUrl(f.File);
          ticket.files.push(fileMapper.toPublic(f, url));
        }
        result.push(ticket);
      }
      return res.json({ tickets: result, total: count });
    } catch (err) {
      return sendError(res, err);
    }
  },
  async list(req, res) {
    try {
      const tickets = await ticketService.listByUser(req.params.id);
      return res.json({ tickets: tickets.map(ticketMapper.toPublic) });
    } catch (err) {
      return sendError(res, err);
    }
  },

  async create(req, res) {
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

  async updateById(req, res) {
    try {
      const ticket = await ticketService.update(
        req.params.id,
        req.body,
        req.user.id
      );
      const user = await ticket.getUser();
      const files = await fileService.listForTicket(ticket.id);
      const result = ticketMapper.toPublic(ticket);
      result.user = {
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
      };
      result.files = [];
      for (const f of files) {
        const url = await fileService.getDownloadUrl(f.File);
        result.files.push(fileMapper.toPublic(f, url));
      }
      return res.json({ ticket: result });
    } catch (err) {
      return sendError(res, err, 404);
    }
  },

  async progressStatus(req, res) {
    try {
      const ticket = await ticketService.progressStatus(
        req.params.id,
        req.user.id
      );
      const user = await ticket.getUser();
      const files = await fileService.listForTicket(ticket.id);
      const result = ticketMapper.toPublic(ticket);
      result.user = {
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
      };
      result.files = [];
      for (const f of files) {
        const url = await fileService.getDownloadUrl(f.File);
        result.files.push(fileMapper.toPublic(f, url));
      }
      return res.json({ ticket: result });
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
