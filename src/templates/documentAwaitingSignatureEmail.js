export function renderDocumentAwaitingSignatureEmail(document) {
  const subject = `Документ №${document.number} ожидает подписи`;
  const text = `Документ "${document.name}" (№${document.number}) ожидает вашей подписи.`;
  const html = `
    <div style="font-family: Arial, sans-serif; color: #333;">
      <p style="font-size:16px;margin:0 0 16px;">Здравствуйте!</p>
      <p style="font-size:16px;margin:0;">
        Документ <strong>${document.name}</strong> (№${document.number}) ожидает вашей подписи.
        Пожалуйста, войдите в систему для подписания.
      </p>
    </div>`;
  return { subject, text, html };
}

export default { renderDocumentAwaitingSignatureEmail };
