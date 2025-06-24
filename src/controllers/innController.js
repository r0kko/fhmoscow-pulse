import innService from '../services/innService.js';
import innMapper from '../mappers/innMapper.js';

export default {
  async me(req, res) {
    const inn = await innService.getByUser(req.user.id);
    if (!inn) {
      return res.status(404).json({ error: 'inn_not_found' });
    }
    return res.json({ inn: innMapper.toPublic(inn) });
  },

  async create(req, res) {
    try {
      const inn = await innService.create(
        req.user.id,
        req.body.number,
        req.user.id
      );
      return res.status(201).json({ inn: innMapper.toPublic(inn) });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  },
};
