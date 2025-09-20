import {
  buildEmail,
  paragraph,
  code as codeBlock,
  button,
} from './email/index.js';

export function renderDocumentSignCodeEmail(document, code) {
  const name = document?.name || 'Документ';
  const number = document?.number ? `№${document.number}` : '';
  const subject = `Подтвердите подписание ${number || 'документа'}`;
  const previewText = `Код для подписи ${number || name}: ${code}`;
  const baseUrl = process.env.BASE_URL || 'https://lk.fhmoscow.com';
  const docUrl = document?.id
    ? `${baseUrl}/documents/${document.id}`
    : `${baseUrl}/documents`;

  const blocks = [
    paragraph('Здравствуйте!'),
    paragraph(
      `Вы запросили подписание документа <strong>${name}</strong> ${number}.`,
      { html: true }
    ),
    paragraph('Для подтверждения подписи введите код ниже.'),
    codeBlock(String(code || '').trim(), { label: 'Код подтверждения' }),
    paragraph(
      'Код действует 15 минут. Если вы не инициировали подписание, отмените запрос и сообщите администратору.'
    ),
    button('Открыть документ', docUrl),
  ];

  return buildEmail({ subject, previewText, blocks });
}

export default { renderDocumentSignCodeEmail };
