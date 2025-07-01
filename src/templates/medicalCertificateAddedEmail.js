export function renderMedicalCertificateAddedEmail() {
  const subject = 'Добавлено медицинское заключение';
  const text =
    'Здравствуйте!\n\n' +
    'Администратор добавил в ваш профиль новое медицинское заключение в системе АСОУ ПД "Поток". ' +
    'Вы можете ознакомиться с документом в личном кабинете.\n\n' +
    'Если вы считаете это добавление ошибочным или у вас есть вопросы, пожалуйста, обратитесь в службу поддержки.\n\n' +
    'С уважением,\nкоманда АСОУ ПД "Поток".';
  const html = `
    <div style="font-family: Arial, sans-serif; color: #333;">
      <p style="font-size:16px;margin:0 0 16px;">Здравствуйте!</p>
      <p style="font-size:16px;margin:0 0 16px;">
        Администратор добавил в ваш профиль новое медицинское заключение в системе <strong>АСОУ ПД "Поток"</strong>.
      </p>
      <p style="font-size:16px;margin:0 0 16px;">Ознакомиться с документом можно в личном кабинете.</p>
      <p style="font-size:14px;margin:0 0 16px;">Если вы считаете это добавление ошибочным или у вас есть вопросы, пожалуйста, обратитесь в службу поддержки.</p>
      <p style="font-size:16px;margin:0;">С уважением,<br/>команда АСОУ ПД "Поток"</p>
    </div>`;
  return { subject, text, html };
}

export default { renderMedicalCertificateAddedEmail };
