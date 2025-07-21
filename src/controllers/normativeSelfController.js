import normativeGroupService from '../services/normativeGroupService.js';
import normativeTypeService from '../services/normativeTypeService.js';
import normativeResultService from '../services/normativeResultService.js';
import groupMapper from '../mappers/normativeGroupMapper.js';
import typeMapper from '../mappers/normativeTypeMapper.js';
import resultMapper from '../mappers/normativeResultMapper.js';
import { sendError } from '../utils/api.js';

export default {
  async list(req, res) {
    const { season_id } = req.query;
    try {
      const [groupData, typeData, resultData] = await Promise.all([
        normativeGroupService.listAll({ page: 1, limit: 1000, season_id }),
        normativeTypeService.listAll({ page: 1, limit: 1000, season_id }),
        normativeResultService.listAll({
          page: 1,
          limit: 1000,
          season_id,
          user_id: req.user.id,
        }),
      ]);
      const groups = groupData.rows.map(groupMapper.toPublic);
      const types = typeData.rows.map(typeMapper.toPublic);
      const results = resultData.rows.map(resultMapper.toPublic);
      const resultByType = {};
      for (const r of results) {
        if (!resultByType[r.type_id]) {
          resultByType[r.type_id] = r;
        }
      }
      const groupMap = Object.fromEntries(
        groups.map((g) => [g.id, { ...g, types: [] }])
      );
      for (const t of types) {
        const res = resultByType[t.id] || null;
        (t.groups || []).forEach((g) => {
          const grp = groupMap[g.group_id];
          if (grp) {
            grp.types.push({ ...t, result: res });
          }
        });
      }
      const list = Object.values(groupMap).filter((g) => g.types.length > 0);
      return res.json({ groups: list });
    } catch (err) {
      return sendError(res, err);
    }
  },
};
