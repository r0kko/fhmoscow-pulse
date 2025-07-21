import {
  User,
  Role,
  NormativeType,
  NormativeGroupType,
  NormativeGroup,
  NormativeResult,
  NormativeZone,
  NormativeValueType,
  MeasurementUnit,
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
  if (!season) return { judges: [], groups: [], total: 0 };

  const page = Math.max(1, parseInt(options.page || 1, 10));
  const limit = Math.max(1, parseInt(options.limit || 20, 10));
  const offset = (page - 1) * limit;

  const [{ rows: judges, count }, types] = await Promise.all([
    User.findAndCountAll({
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
      limit,
      offset,
    }),
    NormativeType.findAll({
      where: { season_id: season.id },
      include: [
        { model: NormativeGroupType, include: [NormativeGroup] },
        MeasurementUnit,
      ],
      order: [['name', 'ASC']],
    }),
  ]);

  const results = await NormativeResult.findAll({
    where: {
      season_id: season.id,
      user_id: judges.map((u) => u.id),
    },
    include: [NormativeZone, NormativeValueType],
  });

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
    groupMap[group.id].types.push({
      id: t.id,
      name: t.name,
      unit_alias: t.MeasurementUnit?.alias || null,
    });
  }
  const groups = Object.values(groupMap);

  const resultMap = {};
  for (const r of results) {
    if (!resultMap[r.user_id]) resultMap[r.user_id] = {};
    const existing = resultMap[r.user_id][r.type_id];
    const alias = r.NormativeValueType?.alias;
    const better =
      !existing ||
      (alias === 'LESS_BETTER'
        ? r.value < existing.value
        : r.value > existing.value);
    if (better) {
      resultMap[r.user_id][r.type_id] = {
        id: r.id,
        value: r.value,
        zone: normativeZoneMapper.toPublic(r.NormativeZone),
      };
    }
  }

  const data = judges.map((u) => ({
    user: userMapper.toPublic(u),
    results: resultMap[u.id] || {},
  }));

  return { judges: data, groups, total: count };
}

export default { list };
