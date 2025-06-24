import taxationService from '../services/taxationService.js';
import taxationMapper from '../mappers/taxationMapper.js';

export default {
  async me(req, res) {
    const tax = await taxationService.getByUser(req.user.id);
    if (!tax) {
      return res.status(404).json({ error: 'taxation_not_found' });
    }
    return res.json({ taxation: taxationMapper.toPublic(tax) });
  },

  async check(req, res) {
    try {
      const source = req.query.source;
      const opts = {
        dadata: !source || source === 'dadata' || source === 'all',
        fns: !source || source === 'fns' || source === 'all',
      };
      const preview = await taxationService.previewForUser(req.user.id, opts);
      return res.json({ preview: taxationMapper.toPublic(preview) });
    } catch (err) {
      const status = err.message === 'inn_not_found' ? 404 : 400;
      return res.status(status).json({ error: err.message });
    }
  },

  async update(req, res) {
    try {
      const tax = await taxationService.updateForUser(
        req.user.id,
        req.user.id
      );
      return res.json({ taxation: taxationMapper.toPublic(tax) });
    } catch (err) {
      const status = err.message === 'inn_not_found' ? 404 : 400;
      return res.status(status).json({ error: err.message });
    }
  },
};
