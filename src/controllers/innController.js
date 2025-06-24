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
};
