import { buildEmail, paragraph, infoGrid, button } from './email/index.js';

function resolveAction(signTypeAlias) {
  switch (signTypeAlias) {
    case 'HANDWRITTEN':
      return 'Пожалуйста, подъезжайте в офис в будние дни с 10:00 до 17:00 для подписания документа.';
    case 'KONTUR_SIGN':
      return 'Перейдите в систему СКБ Контур, чтобы подписать документ.';
    case 'SIMPLE_ELECTRONIC':
    default:
      return 'Войдите в систему и подпишите документ с помощью кода подтверждения.';
  }
}

export function renderDocumentAwaitingSignatureEmail(document) {
  const name = document?.name || 'Документ';
  const number = document?.number ? `№${document.number}` : '';
  const subject = `${name} ${number} ожидает подписи`;
  const previewText = `${name} ${number} ожидает вашей подписи.`;
  const actionMessage = resolveAction(document?.SignType?.alias);
  const baseUrl = process.env.BASE_URL || 'https://lk.fhmoscow.com';
  const docUrl = document?.id
    ? `${baseUrl}/documents/${document.id}`
    : `${baseUrl}/documents`;

  const blocks = [
    paragraph('Здравствуйте!'),
    paragraph(
      `Документ <strong>${name}</strong> ${number} ожидает вашей подписи.`,
      { html: true }
    ),
    paragraph(actionMessage),
    document?.SignType?.name
      ? infoGrid([{ label: 'Тип подписи', value: document.SignType.name }])
      : null,
    button('Открыть документ', docUrl),
  ].filter(Boolean);

  return buildEmail({ subject, previewText, blocks });
}

export default { renderDocumentAwaitingSignatureEmail };
