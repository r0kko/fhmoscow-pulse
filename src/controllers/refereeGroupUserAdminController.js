import { validationResult } from 'express-validator';

import refereeGroupService from '../services/refereeGroupService.js';
import userMapper from '../mappers/userMapper.js';
import groupMapper from '../mappers/refereeGroupMapper.js';
import { sendError } from '../utils/api.js';

export default {
  async list(req, res) {
    const { search, group_id, season_id, role } = req.query;
    const judges = await refereeGroupService.listReferees({
      search,
      group_id,
      season_id,
      role,
    });
    const data = await Promise.all(
      judges.map(async (u) => {
        const group = u.RefereeGroupUser
          ? groupMapper.toPublic(u.RefereeGroupUser.RefereeGroup)
          : null;
        let stats = { visited: 0, total: 0 };
        if (group) {
          const seasonId = season_id || group.season_id;
          stats = await refereeGroupService.getTrainingStats(
            u.id,
            group.id,
            seasonId
          );
        }
        return {
          user: userMapper.toPublic(u),
          group,
          training_stats: stats,
        };
      })
    );
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

  async clearGroup(req, res) {
    try {
      await refereeGroupService.removeUser(req.params.id, req.user.id);
      const user = await refereeGroupService.getReferee(req.params.id);
      return res.json({
        judge: {
          user: userMapper.toPublic(user),
          group: null,
        },
      });
    } catch (err) {
      return sendError(res, err, 404);
    }
  },
};
