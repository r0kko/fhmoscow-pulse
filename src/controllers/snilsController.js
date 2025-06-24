import snilsService from '../services/snilsService.js';
import snilsMapper from '../mappers/snilsMapper.js';

export default {
  async me(req, res) {
    const snils = await snilsService.getByUser(req.user.id);
    if (!snils) {
      return res.status(404).json({ error: 'snils_not_found' });
    }
    return res.json({ snils: snilsMapper.toPublic(snils) });
  },
};
