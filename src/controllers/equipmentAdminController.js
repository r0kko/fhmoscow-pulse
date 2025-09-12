import equipmentService from '../services/equipmentService.js';
import mapper from '../mappers/equipmentMapper.js';
import { sendError } from '../utils/api.js';

export default {
  async list(req, res) {
    const {
      page = '1',
      limit = '20',
      type_id,
      manufacturer_id,
      size_id,
    } = req.query;
    const { rows, count } = await equipmentService.listAll({
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      type_id,
      manufacturer_id,
      size_id,
    });
    return res.json({ items: mapper.toPublicArray(rows), total: count });
  },

  async get(req, res) {
    try {
      const item = await equipmentService.getById(req.params.id);
      return res.json({ item: mapper.toPublic(item) });
    } catch (err) {
      return sendError(res, err, 404);
    }
  },

  async create(req, res) {
    try {
      const item = await equipmentService.create(req.body, req.user.id);
      return res.status(201).json({ item: mapper.toPublic(item) });
    } catch (err) {
      return sendError(res, err);
    }
  },

  async update(req, res) {
    try {
      const item = await equipmentService.update(
        req.params.id,
        req.body,
        req.user.id
      );
      return res.json({ item: mapper.toPublic(item) });
    } catch (err) {
      return sendError(res, err, 404);
    }
  },

  async remove(req, res) {
    try {
      await equipmentService.remove(req.params.id, req.user.id);
      return res.status(204).end();
    } catch (err) {
      return sendError(res, err, 404);
    }
  },

  async listTypes(_req, res) {
    try {
      const types = await equipmentService.listTypes();
      return res.json({
        types: types.map((t) => ({ id: t.id, name: t.name })),
      });
    } catch (err) {
      return sendError(res, err);
    }
  },

  async listManufacturers(_req, res) {
    try {
      const list = await equipmentService.listManufacturers();
      return res.json({
        manufacturers: list.map((m) => ({ id: m.id, name: m.name })),
      });
    } catch (err) {
      return sendError(res, err);
    }
  },

  async listSizes(_req, res) {
    try {
      const list = await equipmentService.listSizes();
      return res.json({ sizes: list.map((s) => ({ id: s.id, name: s.name })) });
    } catch (err) {
      return sendError(res, err);
    }
  },

  async assign(req, res) {
    try {
      const { user_id } = req.body || {};
      const result = await equipmentService.assign(
        req.params.id,
        user_id,
        req.user.id
      );
      return res.status(201).json({
        item: mapper.toPublic(result.item),
        document: { id: result.document.id, number: result.document.number },
      });
    } catch (err) {
      return sendError(res, err);
    }
  },
};
