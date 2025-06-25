import bankAccountService from '../services/bankAccountService.js';
import bankAccountMapper from '../mappers/bankAccountMapper.js';
import legacyService from '../services/legacyUserService.js';
import { UserExternalId } from '../models/index.js';

export default {
  async me(req, res) {
    const acc = await bankAccountService.getByUser(req.user.id);
    if (acc) {
      return res.json({ account: bankAccountMapper.toPublic(acc) });
    }
    const ext = await UserExternalId.findOne({ where: { user_id: req.user.id } });
    if (!ext) {
      return res.status(404).json({ error: 'bank_account_not_found' });
    }
    const legacy = await legacyService.findById(ext.external_id);
    if (legacy?.bank_rs && legacy?.bik_bank) {
      return res.json({
        account: {
          number: String(legacy.bank_rs),
          bic: String(legacy.bik_bank).padStart(9, '0'),
        },
      });
    }
    return res.status(404).json({ error: 'bank_account_not_found' });
  },
};
