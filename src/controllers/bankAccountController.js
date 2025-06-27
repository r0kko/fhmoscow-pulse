import bankAccountService from '../services/bankAccountService.js';
import bankAccountMapper from '../mappers/bankAccountMapper.js';

export default {
  async me(req, res) {
    const acc = await bankAccountService.getByUser(req.user.id);
    if (acc) {
      return res.json({ account: bankAccountMapper.toPublic(acc) });
    }
    const legacy = await bankAccountService.fetchFromLegacy(req.user.id);
    if (legacy) {
      return res.json({
        account: { number: legacy.number, bic: legacy.bic },
      });
    }
    return res.status(404).json({ error: 'bank_account_not_found' });
  },
};
