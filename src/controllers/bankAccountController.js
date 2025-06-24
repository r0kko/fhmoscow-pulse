import bankAccountService from '../services/bankAccountService.js';
import bankAccountMapper from '../mappers/bankAccountMapper.js';

export default {
  async me(req, res) {
    const acc = await bankAccountService.getByUser(req.user.id);
    if (!acc) {
      return res.status(404).json({ error: 'bank_account_not_found' });
    }
    return res.json({ account: bankAccountMapper.toPublic(acc) });
  },
};
