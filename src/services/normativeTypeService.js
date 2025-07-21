import {
  NormativeType,
  NormativeTypeZone,
  NormativeGroupType,
  MeasurementUnit,
  NormativeValueType,
  NormativeZone,
  NormativeGroup,
  Season,
} from '../models/index.js';
import ServiceError from '../errors/ServiceError.js';
import generateAlias from '../utils/alias.js';

function parseValue(val, unit) {
  if (val == null || val === '') return null;
  if (unit.alias === 'MIN_SEC') {
    const str = String(val);
    let minutes;
    let seconds;
    const match = /^(\d{1,2}):(\d{1,2})$/.exec(str);
    if (match) {
      minutes = parseInt(match[1], 10);
      seconds = parseInt(match[2], 10);
    } else if (/^\d{3,4}$/.test(str)) {
      minutes = parseInt(str.slice(0, str.length - 2), 10);
      seconds = parseInt(str.slice(-2), 10);
    } else {
      return null;
    }
    if (
      Number.isNaN(minutes) ||
      Number.isNaN(seconds) ||
      seconds < 0 ||
      seconds > 59
    ) {
      return null;
    }
    return minutes * 60 + seconds;
  }
  const num = parseFloat(String(val).replace(',', '.'));
  if (Number.isNaN(num)) return null;
  return unit.fractional ? num : Math.round(num);
}

function parseResultValue(val, unit) {
  const parsed = parseValue(val, unit);
  if (parsed == null) return null;
  if (unit.alias === 'SECONDS' && unit.fractional) {
    return Math.round(parsed * 100) / 100;
  }
  return parsed;
}

function stepForUnit(unit) {
  if (unit.alias === 'SECONDS' && unit.fractional) return 0.01;
  return 1;
}

function determineZone(type, value, sexId = null) {
  if (!type || !Array.isArray(type.NormativeTypeZones)) return null;
  let zones = type.NormativeTypeZones;
  if (sexId) zones = zones.filter((z) => z.sex_id === sexId);
  return zones.find(
    (z) =>
      (z.min_value == null || value >= z.min_value) &&
      (z.max_value == null || value <= z.max_value)
  );
}

async function buildZones({
  zones,
  unit,
  valueType,
  seasonId,
  typeId,
  actorId,
}) {
  if (!Array.isArray(zones) || !zones.length) return [];
  const dict = await NormativeZone.findAll();
  const zoneById = Object.fromEntries(dict.map((z) => [z.id, z]));
  const greenZone = dict.find((z) => z.alias === 'GREEN');
  const yellowZone = dict.find((z) => z.alias === 'YELLOW');
  const redZone = dict.find((z) => z.alias === 'RED');
  if (!greenZone || !yellowZone || !redZone) return [];
  const step = stepForUnit(unit);
  const bySex = {};
  for (const z of zones) {
    const zn = zoneById[z.zone_id];
    if (!zn || (zn.alias !== 'GREEN' && zn.alias !== 'YELLOW')) continue;
    if (!bySex[z.sex_id]) bySex[z.sex_id] = {};
    bySex[z.sex_id][zn.alias] = z;
  }
  const result = [];
  for (const [sexId, data] of Object.entries(bySex)) {
    if (valueType.alias === 'MORE_BETTER') {
      const g = data.GREEN;
      const y = data.YELLOW;
      if (!g || !y) continue;
      const gMin = parseValue(g.min_value, unit);
      const yMin = parseValue(y.min_value, unit);
      if (gMin == null || yMin == null) continue;
      result.push({
        season_id: seasonId,
        normative_type_id: typeId,
        zone_id: greenZone.id,
        sex_id: sexId,
        min_value: gMin,
        created_by: actorId,
        updated_by: actorId,
        created_at: new Date(),
        updated_at: new Date(),
      });
      result.push({
        season_id: seasonId,
        normative_type_id: typeId,
        zone_id: yellowZone.id,
        sex_id: sexId,
        min_value: yMin,
        max_value: gMin - step,
        created_by: actorId,
        updated_by: actorId,
        created_at: new Date(),
        updated_at: new Date(),
      });
      result.push({
        season_id: seasonId,
        normative_type_id: typeId,
        zone_id: redZone.id,
        sex_id: sexId,
        max_value: yMin - step,
        created_by: actorId,
        updated_by: actorId,
        created_at: new Date(),
        updated_at: new Date(),
      });
    } else {
      const g = data.GREEN;
      const y = data.YELLOW;
      if (!g || !y) continue;
      const gMax = parseValue(g.max_value, unit);
      const yMax = parseValue(y.max_value, unit);
      if (gMax == null || yMax == null) continue;
      result.push({
        season_id: seasonId,
        normative_type_id: typeId,
        zone_id: greenZone.id,
        sex_id: sexId,
        max_value: gMax,
        created_by: actorId,
        updated_by: actorId,
        created_at: new Date(),
        updated_at: new Date(),
      });
      result.push({
        season_id: seasonId,
        normative_type_id: typeId,
        zone_id: yellowZone.id,
        sex_id: sexId,
        min_value: gMax + step,
        max_value: yMax,
        created_by: actorId,
        updated_by: actorId,
        created_at: new Date(),
        updated_at: new Date(),
      });
      result.push({
        season_id: seasonId,
        normative_type_id: typeId,
        zone_id: redZone.id,
        sex_id: sexId,
        min_value: yMax + step,
        created_by: actorId,
        updated_by: actorId,
        created_at: new Date(),
        updated_at: new Date(),
      });
    }
  }
  return result;
}

async function listAll(options = {}) {
  const page = Math.max(1, parseInt(options.page || 1, 10));
  const limit = Math.max(1, parseInt(options.limit || 20, 10));
  const offset = (page - 1) * limit;
  const where = {};
  if (options.season_id) where.season_id = options.season_id;
  return NormativeType.findAndCountAll({
    include: [NormativeTypeZone, NormativeGroupType],
    order: [['name', 'ASC']],
    distinct: true,
    limit,
    offset,
    where,
  });
}

async function getById(id) {
  const type = await NormativeType.findByPk(id, {
    include: [NormativeTypeZone, NormativeGroupType],
  });
  if (!type) throw new ServiceError('normative_type_not_found', 404);
  return type;
}

async function create(data, actorId) {
  const season = await Season.findByPk(data.season_id);
  if (!season) throw new ServiceError('season_not_found', 404);
  const [unit, valueType] = await Promise.all([
    MeasurementUnit.findByPk(data.unit_id),
    NormativeValueType.findByPk(data.value_type_id),
  ]);
  if (!unit) throw new ServiceError('measurement_unit_not_found', 404);
  if (!valueType) throw new ServiceError('normative_value_type_not_found', 404);
  if (!Array.isArray(data.groups) || data.groups.length !== 1) {
    throw new ServiceError('normative_group_required');
  }
  const group = await NormativeGroup.findByPk(data.groups[0].group_id);
  if (!group) throw new ServiceError('normative_group_not_found', 404);

  const type = await NormativeType.create({
    season_id: data.season_id,
    name: data.name,
    alias: generateAlias(data.name),
    required: Boolean(data.required),
    value_type_id: data.value_type_id,
    unit_id: data.unit_id,
    created_by: actorId,
    updated_by: actorId,
  });

  if (!Array.isArray(data.zones)) {
    throw new ServiceError('invalid_zones');
  }
  const zones = await buildZones({
    zones: data.zones,
    unit,
    valueType,
    seasonId: data.season_id,
    typeId: type.id,
    actorId,
  });
  if (!zones.length) throw new ServiceError('invalid_zones');
  await NormativeTypeZone.bulkCreate(zones);

  await NormativeGroupType.create({
    group_id: group.id,
    type_id: type.id,
    required: Boolean(data.groups[0].required),
    created_by: actorId,
    updated_by: actorId,
    created_at: new Date(),
    updated_at: new Date(),
  });
  return getById(type.id);
}

async function update(id, data, actorId) {
  const type = await NormativeType.findByPk(id);
  if (!type) throw new ServiceError('normative_type_not_found', 404);
  const [unit, valueType] = await Promise.all([
    MeasurementUnit.findByPk(data.unit_id ?? type.unit_id),
    NormativeValueType.findByPk(data.value_type_id ?? type.value_type_id),
  ]);
  if (!unit) throw new ServiceError('measurement_unit_not_found', 404);
  if (!valueType) throw new ServiceError('normative_value_type_not_found', 404);
  await type.update(
    {
      name: data.name ?? type.name,
      alias: data.name ? generateAlias(data.name) : type.alias,
      required: data.required ?? type.required,
      value_type_id: data.value_type_id ?? type.value_type_id,
      unit_id: data.unit_id ?? type.unit_id,
      updated_by: actorId,
    },
    { returning: false }
  );
  if (data.zones) {
    await NormativeTypeZone.destroy({ where: { normative_type_id: id } });
    if (!Array.isArray(data.zones)) {
      throw new ServiceError('invalid_zones');
    }
    const zones = await buildZones({
      zones: data.zones,
      unit,
      valueType,
      seasonId: type.season_id,
      typeId: id,
      actorId,
    });
    if (!zones.length) throw new ServiceError('invalid_zones');
    await NormativeTypeZone.bulkCreate(zones);
  }
  if (data.groups) {
    await NormativeGroupType.destroy({ where: { type_id: id } });
    if (!Array.isArray(data.groups) || data.groups.length !== 1) {
      throw new ServiceError('normative_group_required');
    }
    const group = await NormativeGroup.findByPk(data.groups[0].group_id);
    if (!group) throw new ServiceError('normative_group_not_found', 404);
    await NormativeGroupType.create({
      group_id: group.id,
      type_id: id,
      required: Boolean(data.groups[0].required),
      created_by: actorId,
      updated_by: actorId,
      created_at: new Date(),
      updated_at: new Date(),
    });
  }
  return getById(id);
}

async function remove(id, actorId = null) {
  const type = await NormativeType.findByPk(id);
  if (!type) throw new ServiceError('normative_type_not_found', 404);
  const count = await NormativeGroupType.count({ where: { type_id: id } });
  if (count > 0) throw new ServiceError('normative_type_in_use');
  await type.update({ updated_by: actorId });
  await type.destroy();
}

export { parseValue, parseResultValue, stepForUnit, determineZone };
export default { listAll, getById, create, update, remove };
