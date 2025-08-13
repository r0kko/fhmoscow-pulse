export function renderAccountActivatedEmail() {
  const subject = 'Учетная запись активирована';
  const text =
    'Здравствуйте!\n\n' +
    'Администратор подтвердил вашу учетную запись в системе АСОУ ПД Пульс. ' +
    'Теперь вы можете войти в личный кабинет и использовать все функции сервиса.';
  const html = `
    <div style="font-family: Arial, sans-serif; color: #333;">
      <p style="font-size:16px;margin:0 0 16px;">Здравствуйте!</p>
      <p style="font-size:16px;margin:0 0 16px;">
        Администратор подтвердил вашу учетную запись в системе <strong>АСОУ ПД Пульс</strong>.
      </p>
      <p style="font-size:16px;margin:0 0 16px;">Теперь вы можете войти в личный кабинет и использовать все функции сервиса.</p>
    </div>`;
  return { subject, text, html };
}

export default { renderAccountActivatedEmail };
