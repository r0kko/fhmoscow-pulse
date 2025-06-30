import addressService from '../services/addressService.js';
import addressMapper from '../mappers/addressMapper.js';
import { sendError } from '../utils/api.js';

export default {
  async me(req, res) {
    const alias = String(req.params.type || '').toUpperCase();
    try {
      const addr = await addressService.getForUser(req.user.id, alias);
      if (addr) {
        return res.json({ address: addressMapper.toPublic(addr) });
      }
      const legacy = await addressService.fetchFromLegacy(req.user.id);
      if (legacy) {
        return res.json({ address: { result: legacy.result } });
      }
      return res.status(404).json({ error: 'address_not_found' });
    } catch (err) {
      return sendError(res, err);
    }
  },
};
