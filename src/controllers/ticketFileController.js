import fileService from '../services/fileService.js';
import ticketService from '../services/ticketService.js';
import fileMapper from '../mappers/fileMapper.js';
import { sendError } from '../utils/api.js';

async function isAdmin(user) {
  const roles = await user.getRoles({ where: { alias: 'ADMIN' } });
  return roles && roles.length > 0;
}

export default {
  async list(req, res) {
    try {
      const ticket = await ticketService.getById(req.params.id);
      const admin = await isAdmin(req.user);
      if (ticket.user_id !== req.user.id && !admin) {
        return res.status(403).json({ error: 'Доступ запрещён' });
      }
      const files = await fileService.listForTicket(ticket.id);
      const result = [];
      for (const f of files) {
        const url = await fileService.getDownloadUrl(f.File);
        result.push(fileMapper.toPublic(f, url));
      }
      return res.json({ files: result });
    } catch (err) {
      return sendError(res, err, 404);
    }
  },

  async upload(req, res) {
    try {
      const ticket = await ticketService.getById(req.params.id);
      const admin = await isAdmin(req.user);
      if (ticket.user_id !== req.user.id && !admin) {
        return res.status(403).json({ error: 'Доступ запрещён' });
      }
      const attachment = await fileService.uploadForTicket(
        ticket.id,
        req.file,
        req.user.id
      );
      const url = await fileService.getDownloadUrl(attachment.File);
      return res
        .status(201)
        .json({ file: fileMapper.toPublic(attachment, url) });
    } catch (err) {
      return sendError(res, err, 400);
    }
  },

  async remove(req, res) {
    try {
      const ticket = await ticketService.getById(req.params.id);
      const admin = await isAdmin(req.user);
      if (ticket.user_id !== req.user.id && !admin) {
        return res.status(403).json({ error: 'Доступ запрещён' });
      }
      await fileService.removeTicketFile(req.params.fileId, req.user.id);
      return res.status(204).send();
    } catch (err) {
      return sendError(res, err, 400);
    }
  },
};
