import taxationService from '../services/taxationService.js';
import taxationMapper from '../mappers/taxationMapper.js';

export default {
  async get(req, res) {
    try {
      const tax = await taxationService.getByUser(req.params.id);
      if (!tax) return res.status(404).json({ error: 'taxation_not_found' });
      return res.json({ taxation: taxationMapper.toPublic(tax) });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  },

  async check(req, res) {
    try {
      const preview = await taxationService.previewForUser(req.params.id);
      return res.json({ preview: taxationMapper.toPublic(preview) });
    } catch (err) {
      const status = err.message === 'inn_not_found' ? 404 : 400;
      return res.status(status).json({ error: err.message });
    }
  },

  async update(req, res) {
    try {
      const tax = await taxationService.updateForUser(
        req.params.id,
        req.user.id
      );
      return res.json({ taxation: taxationMapper.toPublic(tax) });
    } catch (err) {
      const status = err.message === 'inn_not_found' ? 404 : 400;
      return res.status(status).json({ error: err.message });
    }
  },
};
