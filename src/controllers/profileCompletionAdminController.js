import profileService from '../services/profileCompletionService.js';
import mapper from '../mappers/profileCompletionMapper.js';
import { sendError } from '../utils/api.js';
import { REFEREE_ROLES } from '../utils/roles.js';

export default {
  async list(req, res) {
    try {
      const users = await profileService.listByRole(REFEREE_ROLES);
      return res.json({ profiles: mapper.toPublicArray(users) });
    } catch (err) {
      return sendError(res, err);
    }
  },
};
