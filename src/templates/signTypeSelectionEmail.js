import { buildEmail, paragraph, code as codeBlock } from './email/index.js';

export function renderSignTypeSelectionEmail(code) {
  const cleanCode = String(code || '').trim();
  const subject = 'Подтвердите выбор электронной подписи';
  const previewText = `Код для подтверждения подписи: ${cleanCode}`;

  const blocks = [
    paragraph('Здравствуйте!'),
    paragraph(
      'Для подтверждения выбранного типа электронной подписи укажите код ниже.'
    ),
    codeBlock(cleanCode, { label: 'Код подтверждения' }),
    paragraph(
      'Код действует 15 минут. Если вы не выбирали тип подписи, проигнорируйте это письмо.'
    ),
  ];

  return buildEmail({ subject, previewText, blocks });
}

export default { renderSignTypeSelectionEmail };
