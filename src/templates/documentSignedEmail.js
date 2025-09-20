import { buildEmail, paragraph, button } from './email/index.js';

export function renderDocumentSignedEmail(document) {
  const name = document?.name || 'Документ';
  const number = document?.number ? `№${document.number}` : '';
  const subject = `${name} ${number} подписан`;
  const previewText = `${name} ${number} успешно подписан.`;
  const baseUrl = process.env.BASE_URL || 'https://lk.fhmoscow.com';
  const docUrl = document?.id
    ? `${baseUrl}/documents/${document.id}`
    : `${baseUrl}/documents`;

  const blocks = [
    paragraph('Здравствуйте!'),
    paragraph(
      `Документ <strong>${name}</strong> ${number} подписан и доступен для просмотра в системе.`,
      { html: true }
    ),
    button('Посмотреть документ', docUrl),
  ];

  return buildEmail({ subject, previewText, blocks });
}

export default { renderDocumentSignedEmail };
