export function renderDocumentAwaitingSignatureEmail(document) {
  const subject = `Документ №${document.number} ожидает подписи`;
  const baseText = `Документ "${document.name}" (№${document.number}) ожидает вашей подписи.`;

  let actionText;
  switch (document.SignType?.alias) {
    case 'HANDWRITTEN':
      actionText =
        'Мы ожидаем Вас в офисе в будние дни с 10:00 до 17:00 ежедневно.';
      break;
    case 'KONTUR_SIGN':
      actionText = 'Перейдите в систему СКБ Контур для подписания документа.';
      break;
    case 'SIMPLE_ELECTRONIC':
    default:
      actionText = 'Войдите в систему для подписания.';
      break;
  }

  const text = `${baseText} ${actionText}`;
  const html = `
    <div style="font-family: Arial, sans-serif; color: #333;">
      <p style="font-size:16px;margin:0 0 16px;">Здравствуйте!</p>
      <p style="font-size:16px;margin:0 0 16px;">
        Документ <strong>${document.name}</strong> (№${document.number}) ожидает вашей подписи.
      </p>
      <p style="font-size:16px;margin:0;">${actionText}</p>
    </div>`;
  return { subject, text, html };
}

export default { renderDocumentAwaitingSignatureEmail };
