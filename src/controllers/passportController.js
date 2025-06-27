import passportService from '../services/passportService.js';
import passportMapper from '../mappers/passportMapper.js';
import { calculateValidUntil } from '../utils/passportUtils.js';

export default {
  async me(req, res) {
    let passport = await passportService.getByUser(req.user.id);
    if (passport) {
      return res.json({ passport: passportMapper.toPublic(passport) });
    }

    const legacy = await passportService.fetchFromLegacy(req.user.id);
    if (legacy) {
      return res.json({
        passport: {
          ...legacy,
          valid_until: calculateValidUntil(
            req.user.birth_date,
            legacy.issue_date
          ),
        },
      });
    }
    return res.status(404).json({ error: 'passport_not_found' });
  },
};
