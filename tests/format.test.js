import { formatFio } from '../src/utils/format.js';

describe('formatFio', () => {
  test('returns full name when mode is full', () => {
    expect(formatFio('Иванов Иван Петрович', 'full')).toBe(
      'Иванов Иван Петрович'
    );
  });

  test('converts to surname + initials', () => {
    expect(formatFio('Иванов Иван Петрович', 'initials')).toBe('Иванов И.П.');
    expect(formatFio('Пупкин Вася', 'initials')).toBe('Пупкин В.');
    expect(formatFio('   Сидоров  Петр    ', 'initials')).toBe('Сидоров П.');
  });

  test('handles empty/invalid input gracefully', () => {
    expect(formatFio('', 'initials')).toBe('');
    expect(formatFio(null, 'initials')).toBe('');
    expect(formatFio(undefined, 'initials')).toBe('');
  });
});
