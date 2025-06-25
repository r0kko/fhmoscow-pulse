import passportService from '../services/passportService.js';
import passportMapper from '../mappers/passportMapper.js';
import legacyService from '../services/legacyUserService.js';
import { UserExternalId } from '../models/index.js';

export default {
  async me(req, res) {
    const passport = await passportService.getByUser(req.user.id);
    if (passport) {
      return res.json({ passport: passportMapper.toPublic(passport) });
    }
    const ext = await UserExternalId.findOne({ where: { user_id: req.user.id } });
    if (!ext) {
      return res.status(404).json({ error: 'passport_not_found' });
    }
    const legacy = await legacyService.findById(ext.external_id);
    if (legacy?.ps_ser && legacy?.ps_num) {
      return res.json({
        passport: {
          series: String(legacy.ps_ser),
          number: String(legacy.ps_num).padStart(6, '0'),
          issue_date: legacy.ps_date,
          issuing_authority: legacy.ps_org,
          issuing_authority_code: legacy.ps_pdrz,
          document_type: 'CIVIL',
          country: 'RU',
        },
      });
    }
    return res.status(404).json({ error: 'passport_not_found' });
  },
};
