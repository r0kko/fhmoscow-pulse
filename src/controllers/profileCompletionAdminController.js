import profileService from '../services/profileCompletionService.js';
import mapper from '../mappers/profileCompletionMapper.js';
import { sendError } from '../utils/api.js';

export default {
  async list(req, res) {
    try {
      const users = await profileService.listByRole('REFEREE');
      return res.json({ profiles: mapper.toPublicArray(users) });
    } catch (err) {
      return sendError(res, err);
    }
  },
};
