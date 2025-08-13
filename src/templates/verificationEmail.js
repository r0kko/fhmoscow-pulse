export function renderVerificationEmail(code) {
  const subject = 'Подтверждение электронной почты';
  const text =
    'Здравствуйте!\n' +
    'Для подтверждения адреса электронной почты используйте код: ' +
    code +
    '\nКод действует 15 минут.';
  const html = `
    <div style="font-family: Arial, sans-serif; color: #333;">
      <p style="font-size:16px;margin:0 0 16px;">Здравствуйте!</p>
      <p style="font-size:16px;margin:0 0 16px;">Для подтверждения адреса электронной почты используйте код:</p>
      <p style="font-size:24px;font-weight:bold;letter-spacing:4px;margin:0 0 16px;">${code}</p>
      <p style="font-size:14px;margin:0 0 16px;">Код действует 15&nbsp;минут.</p>
    </div>`;
  return { subject, text, html };
}

export default { renderVerificationEmail };
