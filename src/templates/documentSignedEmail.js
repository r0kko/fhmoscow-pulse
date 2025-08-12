export function renderDocumentSignedEmail(document) {
  const subject = `Документ №${document.number} подписан`;
  const text = `Документ "${document.name}" (№${document.number}) подписан.`;
  const html = `
    <div style="font-family: Arial, sans-serif; color: #333;">
      <p style="font-size:16px;margin:0 0 16px;">Здравствуйте!</p>
      <p style="font-size:16px;margin:0;">
        Документ <strong>${document.name}</strong> (№${document.number}) подписан.
      </p>
    </div>`;
  return { subject, text, html };
}

export default { renderDocumentSignedEmail };
