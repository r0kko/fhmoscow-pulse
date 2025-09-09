import profileService from '../services/profileCompletionService.js';
import mapper from '../mappers/profileCompletionMapper.js';
import { sendError } from '../utils/api.js';
import { REFEREE_ROLES } from '../utils/roles.js';
import { hasAnySnils } from '../services/snilsService.js';

export default {
  async list(req, res) {
    try {
      const users = await profileService.listByRole(REFEREE_ROLES);
      const profiles = mapper.toPublicArray(users);
      // Ensure SNILS presence flag is consistent with contract precheck logic
      const presence = await Promise.all(
        profiles.map((p) => hasAnySnils(p.id))
      );
      profiles.forEach((p, i) => {
        p.snils = presence[i];
      });
      return res.json({ profiles });
    } catch (err) {
      return sendError(res, err);
    }
  },
};
