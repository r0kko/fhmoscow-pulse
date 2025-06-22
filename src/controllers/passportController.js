import passportService from '../services/passportService.js';
import passportMapper from '../mappers/passportMapper.js';

export default {
  async me(req, res) {
    const passport = await passportService.getByUser(req.user.id);
    if (!passport) {
      return res.status(404).json({ error: 'passport_not_found' });
    }
    return res.json({ passport: passportMapper.toPublic(passport) });
  },
};
