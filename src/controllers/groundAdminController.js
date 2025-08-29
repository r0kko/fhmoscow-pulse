import groundService from '../services/groundService.js';
import mapper from '../mappers/groundMapper.js';
import { sendError } from '../utils/api.js';

export default {
  async list(req, res) {
    const {
      page = '1',
      limit = '20',
      search = '',
      without_address = 'false',
      has_address = 'false',
      with_yandex = 'false',
      imported = 'false',
      with_clubs = 'false',
      with_teams = 'false',
      order_by = 'name',
      order = 'ASC',
    } = req.query;
    const { rows, count } = await groundService.listAll({
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      search: String(search || ''),
      withoutAddress: String(without_address).toLowerCase() === 'true',
      hasAddress: String(has_address).toLowerCase() === 'true',
      withYandex: String(with_yandex).toLowerCase() === 'true',
      imported: String(imported).toLowerCase() === 'true',
      withClubs: String(with_clubs).toLowerCase() === 'true',
      withTeams: String(with_teams).toLowerCase() === 'true',
      orderBy: order_by,
      order,
    });
    return res.json({ grounds: rows.map(mapper.toPublic), total: count });
  },

  async get(req, res) {
    try {
      const ground = await groundService.getById(req.params.id);
      return res.json({ ground: mapper.toPublic(ground) });
    } catch (err) {
      return sendError(res, err, 404);
    }
  },

  async create(req, res) {
    try {
      const ground = await groundService.create(req.body, req.user.id);
      return res.status(201).json({ ground: mapper.toPublic(ground) });
    } catch (err) {
      return sendError(res, err);
    }
  },

  async update(req, res) {
    try {
      const ground = await groundService.update(
        req.params.id,
        req.body,
        req.user.id
      );
      return res.json({ ground: mapper.toPublic(ground) });
    } catch (err) {
      return sendError(res, err, 404);
    }
  },

  async remove(req, res) {
    try {
      await groundService.remove(req.params.id, req.user.id);
      return res.status(204).end();
    } catch (err) {
      return sendError(res, err, 404);
    }
  },
};
