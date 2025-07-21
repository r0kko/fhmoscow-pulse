import normativeGroupService from '../services/normativeGroupService.js';
import normativeTypeService from '../services/normativeTypeService.js';
import normativeResultService from '../services/normativeResultService.js';
import normativeValueTypeService from '../services/normativeValueTypeService.js';
import measurementUnitService from '../services/measurementUnitService.js';
import normativeZoneService from '../services/normativeZoneService.js';
import groupMapper from '../mappers/normativeGroupMapper.js';
import typeMapper from '../mappers/normativeTypeMapper.js';
import resultMapper from '../mappers/normativeResultMapper.js';
import normativeZoneMapper from '../mappers/normativeZoneMapper.js';
import seasonService from '../services/seasonService.js';
import seasonMapper from '../mappers/seasonMapper.js';
import { sendError } from '../utils/api.js';

export default {
  async list(req, res) {
    const { season_id } = req.query;
    try {
      const [groupData, typeData, valueTypes, units, zones, resultData] =
        await Promise.all([
          normativeGroupService.listAll({ page: 1, limit: 1000, season_id }),
          normativeTypeService.listAll({ page: 1, limit: 1000, season_id }),
          normativeValueTypeService.list(),
          measurementUnitService.list(),
          normativeZoneService.list(),
          normativeResultService.listAll({
            page: 1,
            limit: 1000,
            season_id,
            user_id: req.user.id,
          }),
        ]);
      const groups = groupData.rows.map(groupMapper.toPublic);
      const types = typeData.rows.map(typeMapper.toPublic);
      const valueTypeMap = Object.fromEntries(
        valueTypes.map((v) => [v.id, v.alias])
      );
      const unitMap = Object.fromEntries(units.map((u) => [u.id, u]));
      const zoneMap = Object.fromEntries(
        zones.map((z) => [z.id, normativeZoneMapper.toPublic(z)])
      );
      const results = resultData.rows.map(resultMapper.toPublic);
      for (const r of results) {
        r.unit = unitMap[r.unit_id];
      }
      const bestResult = {};
      const historyByType = {};
      for (const r of results) {
        const alias = valueTypeMap[r.value_type_id];
        const current = bestResult[r.type_id];
        if (!current) {
          bestResult[r.type_id] = r;
          historyByType[r.type_id] = [];
        } else {
          const better =
            alias === 'LESS_BETTER'
              ? r.value < current.value
              : r.value > current.value;
          if (better) {
            historyByType[r.type_id].push(current);
            bestResult[r.type_id] = r;
          } else {
            historyByType[r.type_id].push(r);
          }
        }
      }
      const groupMap = Object.fromEntries(
        groups.map((g) => [g.id, { ...g, types: [] }])
      );
      for (const t of types) {
        const res = bestResult[t.id] || null;
        const history = historyByType[t.id] || [];
        t.unit = unitMap[t.unit_id];
        t.value_type_alias = valueTypeMap[t.value_type_id];
        const thresholds = {};
        for (const z of t.zones || []) {
          if (z.sex_id !== req.user.sex_id) continue;
          const zone = zoneMap[z.zone_id];
          if (!zone) continue;
          if (zone.alias === 'GREEN' || zone.alias === 'YELLOW') {
            thresholds[zone.alias] =
              t.value_type_alias === 'MORE_BETTER' ? z.min_value : z.max_value;
          }
        }
        t.thresholds = thresholds;
        (t.groups || []).forEach((g) => {
          const grp = groupMap[g.group_id];
          if (grp) {
            grp.types.push({ ...t, result: res, history });
          }
        });
      }
      const list = Object.values(groupMap).filter((g) => g.types.length > 0);
      return res.json({ groups: list });
    } catch (err) {
      return sendError(res, err);
    }
  },

  async listSeasons(req, res) {
    try {
      const [seasons, active] = await Promise.all([
        normativeResultService.listSeasonsForUser(req.user.id),
        seasonService.getActive(),
      ]);
      const seasonList = seasons.map((s) => ({
        ...seasonMapper.toPublic(s),
        has_results: true,
      }));
      if (active && !seasonList.some((s) => s.id === active.id)) {
        seasonList.push({
          ...seasonMapper.toPublic(active),
          has_results: false,
        });
      }
      seasonList.sort((a, b) => a.name.localeCompare(b.name));
      return res.json({ seasons: seasonList });
    } catch (err) {
      return sendError(res, err);
    }
  },
};
