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
};
