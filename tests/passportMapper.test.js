import { describe, expect, test } from '@jest/globals';
import mapper from '../src/mappers/passportMapper.js';

describe('passportMapper', () => {
  test('toPublic unwraps passport model and includes associations', () => {
    const passport = {
      get: () => ({
        id: 'p1',
        series: '11',
        number: '22',
        issue_date: '2020-01-01',
        valid_until: '2030-01-01',
        issuing_authority: 'OVD',
        issuing_authority_code: '770-000',
        place_of_birth: 'Moscow',
        createdAt: 't',
        DocumentType: { alias: 'CIVIL', name: 'Civil' },
        Country: { alias: 'RU', name: 'Russia' },
      }),
    };
    expect(mapper.toPublic(passport)).toEqual({
      id: 'p1',
      series: '11',
      number: '22',
      issue_date: '2020-01-01',
      valid_until: '2030-01-01',
      issuing_authority: 'OVD',
      issuing_authority_code: '770-000',
      place_of_birth: 'Moscow',
      document_type: 'CIVIL',
      document_type_name: 'Civil',
      country: 'RU',
      country_name: 'Russia',
    });
  });

  test('toPublic returns null when input is null', () => {
    expect(mapper.toPublic(null)).toBeNull();
  });
});
