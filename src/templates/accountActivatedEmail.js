export function renderAccountActivatedEmail() {
  const subject = 'Учетная запись активирована';
  const text =
    'Здравствуйте!\n\n' +
    'Администратор подтвердил вашу учетную запись в системе FH Moscow Pulse. ' +
    'Теперь вы можете войти в личный кабинет и использовать все функции сервиса.\n\n' +
    'Если вы не подавали запрос на активацию или у вас возникли вопросы, пожалуйста, свяжитесь со службой поддержки.\n\n' +
    'С уважением,\nкоманда FH Moscow Pulse.';
  const html = `
    <div style="font-family: Arial, sans-serif; color: #333;">
      <p style="font-size:16px;margin:0 0 16px;">Здравствуйте!</p>
      <p style="font-size:16px;margin:0 0 16px;">
        Администратор подтвердил вашу учетную запись в системе <strong>FH Moscow Pulse</strong>.
      </p>
      <p style="font-size:16px;margin:0 0 16px;">Теперь вы можете войти в личный кабинет и использовать все функции сервиса.</p>
      <p style="font-size:14px;margin:0 0 16px;">Если вы не подавали запрос на активацию или у вас возникли вопросы, пожалуйста, свяжитесь со службой поддержки.</p>
      <p style="font-size:16px;margin:0;">С уважением,<br/>команда FH Moscow Pulse</p>
    </div>`;
  return { subject, text, html };
}

export default { renderAccountActivatedEmail };
