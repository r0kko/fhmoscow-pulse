import { buildEmail, paragraph, infoGrid, button } from './email/index.js';

export function renderDocumentRejectedEmail(document) {
  const name = document?.name || 'Документ';
  const number = document?.number ? `№${document.number}` : '';
  const subject = `${name} ${number} отклонен`;
  const previewText = `${name} ${number} отклонен администратором.`;
  const baseUrl = process.env.BASE_URL || 'https://lk.fhmoscow.com';
  const docUrl = document?.id
    ? `${baseUrl}/documents/${document.id}`
    : `${baseUrl}/documents`;

  const blocks = [
    paragraph('Здравствуйте!'),
    paragraph(
      `Документ <strong>${name}</strong> ${number} отклонен. Посмотрите комментарий ниже и внесите необходимые исправления.`,
      { html: true }
    ),
    document?.rejection_reason
      ? infoGrid([
          {
            label: 'Комментарий',
            value: document.rejection_reason,
            allowHtml: true,
          },
        ])
      : null,
    button('Перейти к документу', docUrl),
  ].filter(Boolean);

  return buildEmail({ subject, previewText, blocks });
}

export default { renderDocumentRejectedEmail };
