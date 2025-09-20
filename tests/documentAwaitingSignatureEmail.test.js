import { describe, test, expect } from '@jest/globals';
import { renderDocumentAwaitingSignatureEmail } from '../src/templates/documentAwaitingSignatureEmail.js';

describe('renderDocumentAwaitingSignatureEmail', () => {
  const baseDoc = { name: 'Док', number: '1' };
  const cases = [
    {
      alias: 'HANDWRITTEN',
      phrase: 'Пожалуйста, подъезжайте в офис в будние дни с 10:00 до 17:00',
    },
    { alias: 'KONTUR_SIGN', phrase: 'СКБ Контур' },
    { alias: 'SIMPLE_ELECTRONIC', phrase: 'Войдите в систему' },
  ];

  cases.forEach(({ alias, phrase }) => {
    test(`${alias} shows proper signing instructions`, () => {
      const { text, html } = renderDocumentAwaitingSignatureEmail({
        ...baseDoc,
        SignType: { alias },
      });
      expect(text).toContain(phrase);
      expect(html).toContain(phrase);
    });
  });
});
