export function renderDocumentSignCodeEmail(document, code) {
  const subject = `Подтвердите подписание документа №${document.number}`;
  const baseText =
    'Здравствуйте!\n' +
    `Вы запросили подписание документа "${document.name}" (№${document.number}).\n` +
    `Для подтверждения подписи используйте код: ${code}\n` +
    'Код действует 15 минут.';
  const html = `
    <div style='font-family: Arial, sans-serif; color: #333;'>
      <p style='font-size:16px;margin:0 0 16px;'>Здравствуйте!</p>
      <p style='font-size:16px;margin:0 0 8px;'>
        Вы запросили подписание документа <strong>${document.name}</strong> (№${document.number}).
      </p>
      <p style='font-size:16px;margin:0 0 8px;'>Для подтверждения подписи используйте код:</p>
      <p style='font-size:24px;font-weight:bold;letter-spacing:4px;margin:0 0 8px;'>${code}</p>
      <p style='font-size:14px;margin:0'>Код действует 15&nbsp;минут.</p>
    </div>`;
  return { subject, text: baseText, html };
}

export default { renderDocumentSignCodeEmail };
