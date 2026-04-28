import { createRequire } from 'node:module';
import { expect, test } from '@jest/globals';
import ExcelJS from 'exceljs';
import { DataTypes, Sequelize } from 'sequelize';
import { stringify, v4, validate, version } from 'uuid';

const require = createRequire(import.meta.url);

test('uuid package supports ESM and CommonJS consumers', () => {
  const esmId = v4();
  const cjsUuid = require('uuid');
  const cjsId = cjsUuid.v4();

  expect(validate(esmId)).toBe(true);
  expect(version(esmId)).toBe(4);
  expect(cjsUuid.validate(cjsId)).toBe(true);
  expect(cjsUuid.version(cjsId)).toBe(4);
});

test('uuid package validates buffer bounds', () => {
  expect(() => v4(undefined, new Uint8Array(15))).toThrow(RangeError);

  const target = new Uint8Array(17);
  expect(v4(undefined, target, 1)).toBe(target);
  expect(validate(stringify(target, 1))).toBe(true);
});

test('sequelize can generate default UUIDs through CommonJS dependency path', () => {
  const id = Sequelize.Utils.toDefaultValue(new DataTypes.UUIDV4());

  expect(validate(id)).toBe(true);
  expect(version(id)).toBe(4);
});

test('exceljs can create workbooks with the overridden UUID dependency', async () => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Audit');
  worksheet.addRow(['ok']);

  const buffer = await workbook.xlsx.writeBuffer();

  expect(Buffer.isBuffer(buffer)).toBe(true);
  expect(buffer.length).toBeGreaterThan(0);
});
