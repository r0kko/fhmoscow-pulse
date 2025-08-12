export function renderDocumentRejectedEmail(document) {
  const subject = 'Документ отклонен';
  const text = `Документ "${document.name}" отклонен.`;
  const html = `
    <div style="font-family: Arial, sans-serif; color: #333;">
      <p style="font-size:16px;margin:0 0 16px;">Здравствуйте!</p>
      <p style="font-size:16px;margin:0;">
        Документ <strong>${document.name}</strong> отклонен.
      </p>
    </div>`;
  return { subject, text, html };
}

export default { renderDocumentRejectedEmail };
