import { buildEmail, paragraph, code as codeBlock } from './email/index.js';

export function renderPasswordResetEmail(code) {
  const cleanCode = String(code || '').trim();
  const subject = 'Сброс пароля';
  const previewText = `Код для сброса пароля: ${cleanCode}`;

  const blocks = [
    paragraph('Здравствуйте!'),
    paragraph('Для сброса пароля введите код, указанный ниже.'),
    codeBlock(cleanCode, { label: 'Код для сброса' }),
    paragraph(
      'Код действует 15 минут. Если вы не запрашивали сброс пароля, просто проигнорируйте это письмо.'
    ),
  ];

  return buildEmail({ subject, previewText, blocks });
}

export default { renderPasswordResetEmail };
