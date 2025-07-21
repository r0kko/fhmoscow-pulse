import {
  User,
  Role,
  NormativeType,
  NormativeGroupType,
  NormativeGroup,
  NormativeResult,
  NormativeZone,
  Season,
} from '../models/index.js';
import userMapper from '../mappers/userMapper.js';
import normativeGroupMapper from '../mappers/normativeGroupMapper.js';
import normativeZoneMapper from '../mappers/normativeZoneMapper.js';

async function getSeason(id) {
  if (id) return Season.findByPk(id);
  return Season.findOne({ where: { active: true } });
}

async function list(options = {}) {
  const season = await getSeason(options.season_id);
  if (!season) return { judges: [], groups: [] };
  const [judges, types, results] = await Promise.all([
    User.findAll({
      include: [
        {
          model: Role,
          where: { alias: 'REFEREE' },
          through: { attributes: [] },
          required: true,
        },
      ],
      order: [
        ['last_name', 'ASC'],
        ['first_name', 'ASC'],
      ],
    }),
    NormativeType.findAll({
      where: { season_id: season.id },
      include: [{ model: NormativeGroupType, include: [NormativeGroup] }],
      order: [['name', 'ASC']],
    }),
    NormativeResult.findAll({
      where: {
        season_id: season.id,
      },
      include: [NormativeZone],
    }),
  ]);

  const groupMap = {};
  for (const t of types) {
    const group = t.NormativeGroupTypes?.[0]?.NormativeGroup;
    if (!group) continue;
    if (!groupMap[group.id]) {
      groupMap[group.id] = {
        ...normativeGroupMapper.toPublic(group),
        types: [],
      };
    }
    groupMap[group.id].types.push({ id: t.id, name: t.name });
  }
  const groups = Object.values(groupMap);

  const resultMap = {};
  for (const r of results) {
    if (!resultMap[r.user_id]) resultMap[r.user_id] = {};
    resultMap[r.user_id][r.type_id] = {
      id: r.id,
      value: r.value,
      zone: normativeZoneMapper.toPublic(r.NormativeZone),
    };
  }

  const data = judges.map((u) => ({
    user: userMapper.toPublic(u),
    results: resultMap[u.id] || {},
  }));

  return { judges: data, groups };
}

export default { list };
