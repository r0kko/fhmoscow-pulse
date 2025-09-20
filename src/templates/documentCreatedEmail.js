import { buildEmail, paragraph, infoGrid, button } from './email/index.js';

export function renderDocumentCreatedEmail(document) {
  const name = document?.name || 'Документ';
  const number = document?.number ? `№${document.number}` : '';
  const subject = `${name} ${number} создан`;
  const previewText = `${name} ${number} оформлен и доступен в системе.`;
  const baseUrl = process.env.BASE_URL || 'https://lk.fhmoscow.com';
  const docUrl = document?.id
    ? `${baseUrl}/documents/${document.id}`
    : `${baseUrl}/documents`;

  const blocks = [
    paragraph('Здравствуйте!'),
    paragraph(
      `Документ <strong>${name}</strong> ${number} создан и доступен в системе.`,
      { html: true }
    ),
    infoGrid(
      [
        { label: 'Название', value: name },
        number ? { label: 'Номер', value: number.replace('№', '') } : null,
        document?.status ? { label: 'Статус', value: document.status } : null,
      ].filter(Boolean)
    ),
    button('Открыть документ', docUrl),
  ];

  return buildEmail({ subject, previewText, blocks });
}

export default { renderDocumentCreatedEmail };
