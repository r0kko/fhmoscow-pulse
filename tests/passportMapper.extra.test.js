import { expect, test } from '@jest/globals';

const { default: mapper } = await import('../src/mappers/passportMapper.js');

test('toPublic maps without associations', () => {
  const input = {
    id: 'p2',
    series: '00',
    number: '123456',
    issue_date: '2019-05-01',
    valid_until: '2029-05-01',
    issuing_authority: 'UFMS',
    issuing_authority_code: '770-001',
    place_of_birth: 'Москва',
  };
  const out = mapper.toPublic(input);
  expect(out).toMatchObject({ id: 'p2', number: '123456' });
  expect(out.document_type).toBeUndefined();
  expect(out.country).toBeUndefined();
});
