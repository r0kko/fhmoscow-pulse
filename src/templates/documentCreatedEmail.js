export function renderDocumentCreatedEmail(document) {
  const subject = 'Документ создан';
  const text = `Документ "${document.name}" создан.`;
  const html = `
    <div style="font-family: Arial, sans-serif; color: #333;">
      <p style="font-size:16px;margin:0 0 16px;">Здравствуйте!</p>
      <p style="font-size:16px;margin:0;">
        Документ <strong>${document.name}</strong> создан и доступен в системе.
      </p>
    </div>`;
  return { subject, text, html };
}

export default { renderDocumentCreatedEmail };
