import { buildEmail, paragraph, code as codeBlock } from './email/index.js';

export function renderVerificationEmail(code) {
  const cleanCode = String(code || '').trim();
  const subject = 'Подтверждение электронной почты';
  const previewText = `Код подтверждения: ${cleanCode}`;

  const blocks = [
    paragraph('Здравствуйте!'),
    paragraph(
      'Для подтверждения адреса электронной почты используйте код ниже.'
    ),
    codeBlock(cleanCode, { label: 'Код подтверждения' }),
    paragraph(
      'Код действует 15 минут. Если вы не запрашивали подтверждение, пожалуйста, проигнорируйте это письмо.'
    ),
  ];

  return buildEmail({ subject, previewText, blocks });
}

export default { renderVerificationEmail };
