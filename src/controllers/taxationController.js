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
};
