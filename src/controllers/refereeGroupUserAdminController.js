import { validationResult } from 'express-validator';

import refereeGroupService from '../services/refereeGroupService.js';
import userMapper from '../mappers/userMapper.js';
import groupMapper from '../mappers/refereeGroupMapper.js';
import { sendError } from '../utils/api.js';

export default {
  async list(req, res) {
    const judges = await refereeGroupService.listReferees();
    const data = judges.map((u) => ({
      user: userMapper.toPublic(u),
      group: u.RefereeGroupUser
        ? groupMapper.toPublic(u.RefereeGroupUser.RefereeGroup)
        : null,
    }));
    return res.json({ judges: data });
  },

  async setGroup(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      await refereeGroupService.setUserGroup(
        req.params.id,
        req.body.group_id,
        req.user.id
      );
      const user = await refereeGroupService.getReferee(req.params.id);
      return res.json({
        judge: {
          user: userMapper.toPublic(user),
          group: user.RefereeGroupUser
            ? groupMapper.toPublic(user.RefereeGroupUser.RefereeGroup)
            : null,
        },
      });
    } catch (err) {
      return sendError(res, err, 404);
    }
  },
};
