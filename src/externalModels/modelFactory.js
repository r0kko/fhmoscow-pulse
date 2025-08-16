import { DataTypes, Model } from 'sequelize';

import externalSequelize from '../config/externalMariaDb.js';

/**
 * Define a Sequelize model for a table in the external MariaDB.
 * `shape` maps column names to primitive type tokens
 * (e.g. 'int', 'string', 'text', 'date', 'boolean', 'number').
 */
export function createModel({ table, primaryKey = 'id', shape = {} }) {
  const attributes = {};
  for (const [column, typeToken] of Object.entries(shape)) {
    attributes[column] = { type: mapType(typeToken) };
  }

  if (primaryKey) {
    const pks = Array.isArray(primaryKey) ? primaryKey : [primaryKey];
    for (const pk of pks) {
      if (!attributes[pk]) attributes[pk] = { type: DataTypes.INTEGER };
      attributes[pk].primaryKey = true;
    }
  } else {
    Object.keys(attributes).forEach((col) => {
      attributes[col].primaryKey = true;
    });
  }

  class DynamicModel extends Model {}
  DynamicModel.init(attributes, {
    sequelize: externalSequelize,
    modelName: toModelName(table),
    tableName: table,
    timestamps: false,
    underscored: false,
  });
  return DynamicModel;
}

function mapType(t) {
  switch (t) {
    case 'int':
      return DataTypes.INTEGER;
    case 'boolean':
      return DataTypes.BOOLEAN;
    case 'date':
      return DataTypes.DATE;
    case 'text':
      return DataTypes.TEXT;
    case 'number':
      return DataTypes.FLOAT;
    case 'string':
    default:
      return DataTypes.STRING;
  }
}

function toModelName(table) {
  return table
    .split('_')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join('');
}

export default { createModel };
