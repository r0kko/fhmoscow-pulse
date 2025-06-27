export function renderPasswordResetEmail(code) {
  const subject = 'Сброс пароля';
  const text =
    `Ваш код для сброса пароля: ${code}\n\n` +
    'Если вы не запрашивали этот код, просто проигнорируйте письмо.';
  const html = `
    <div style="font-family: Arial, sans-serif; color: #333;">
      <p style="font-size:16px;margin:0 0 16px;">Здравствуйте!</p>
      <p style="font-size:16px;margin:0 0 16px;">Для сброса пароля используйте код:</p>
      <p style="font-size:24px;font-weight:bold;letter-spacing:4px;margin:0 0 16px;">${code}</p>
      <p style="font-size:14px;margin:0 0 16px;">Код действует 15&nbsp;минут.</p>
      <p style="font-size:12px;color:#777;margin:0;">Если вы не запрашивали этот код, просто проигнорируйте письмо.</p>
    </div>`;
  return { subject, text, html };
}

export default { renderPasswordResetEmail };
