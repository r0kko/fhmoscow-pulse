export function renderMedicalCertificateAddedEmail() {
  const subject = 'Добавлено медицинское заключение';
  const text =
    'Здравствуйте!\n\n' +
    'Администратор добавил в ваш профиль новое медицинское заключение в системе АСОУ ПД Пульс. ' +
    'Вы можете ознакомиться с документом в личном кабинете.\n\n' +
    'Если вы считаете это добавление ошибочным или у вас есть вопросы, пожалуйста, обратитесь к сотруднику отдела организации судейства.';
  const html = `
    <div style="font-family: Arial, sans-serif; color: #333;">
      <p style="font-size:16px;margin:0 0 16px;">Здравствуйте!</p>
      <p style="font-size:16px;margin:0 0 16px;">
        Администратор добавил в ваш профиль новое медицинское заключение в системе <strong>АСОУ ПД Пульс</strong>.
      </p>
      <p style="font-size:16px;margin:0 0 16px;">Ознакомиться с документом можно в личном кабинете.</p>
      <p style="font-size:14px;margin:0 0 16px;">Если вы считаете это добавление ошибочным или у вас есть вопросы, пожалуйста, обратитесь к сотруднику отдела организации судейства.</p>
    </div>`;
  return { subject, text, html };
}

export default { renderMedicalCertificateAddedEmail };
