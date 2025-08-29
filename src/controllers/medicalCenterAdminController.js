import medicalCenterService from '../services/medicalCenterService.js';
import mapper from '../mappers/medicalCenterMapper.js';
import { sendError } from '../utils/api.js';

export default {
  async list(req, res) {
    const { page = '1', limit = '20' } = req.query;
    const { rows, count } = await medicalCenterService.listAll({
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    });
    return res.json({ centers: rows.map(mapper.toPublic), total: count });
  },

  async get(req, res) {
    try {
      const center = await medicalCenterService.getById(req.params.id);
      return res.json({ center: mapper.toPublic(center) });
    } catch (err) {
      return sendError(res, err, 404);
    }
  },

  async create(req, res) {
    try {
      const center = await medicalCenterService.create(req.body, req.user.id);
      return res.status(201).json({ center: mapper.toPublic(center) });
    } catch (err) {
      return sendError(res, err);
    }
  },

  async update(req, res) {
    try {
      const center = await medicalCenterService.update(
        req.params.id,
        req.body,
        req.user.id
      );
      return res.json({ center: mapper.toPublic(center) });
    } catch (err) {
      return sendError(res, err, 404);
    }
  },

  async remove(req, res) {
    try {
      await medicalCenterService.remove(req.params.id, req.user.id);
      return res.status(204).end();
    } catch (err) {
      return sendError(res, err, 404);
    }
  },
};
