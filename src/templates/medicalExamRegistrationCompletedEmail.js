export function renderMedicalExamRegistrationCompletedEmail(exam) {
  const date = new Date(exam.start_at)
    .toLocaleString('ru-RU', {
      timeZone: 'Europe/Moscow',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
    .replace(',', '');
  const subject = 'Медицинский осмотр завершен';
  const text =
    `Медицинский осмотр ${date} отмечен как завершенный.\n\n` +
    'Если вы не проходили осмотр, обратитесь к сотруднику отдела организации судейства.';
  const html = `
    <div style="font-family: Arial, sans-serif; color: #333;">
      <p style="font-size:16px;margin:0 0 16px;">Здравствуйте!</p>
      <p style="font-size:16px;margin:0 0 16px;">
        Медицинский осмотр ${date} (МСК) отмечен как завершенный.
      </p>
      <p style="font-size:12px;color:#777;margin:0;">
        Если вы не проходили осмотр, обратитесь к сотруднику отдела организации судейства.
      </p>
    </div>`;
  return { subject, text, html };
}

export default { renderMedicalExamRegistrationCompletedEmail };
