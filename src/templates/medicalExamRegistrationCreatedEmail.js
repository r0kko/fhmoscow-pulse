export function renderMedicalExamRegistrationCreatedEmail(
  exam,
  byAdmin = false
) {
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
  const center = exam.MedicalCenter || exam.center || {};
  const address = center.Address?.result || center.address?.result;
  const subject = 'Заявка на медицинский осмотр создана';

  let text = byAdmin
    ? `Администратор записал вас на медицинский осмотр ${date}.`
    : `Вы записались на медицинский осмотр ${date}.`;
  if (address) text += `\nМесто проведения: ${address}.`;
  text +=
    '\n\nЕсли вы не подавали эту заявку, обратитесь к сотруднику отдела организации судейства.';

  const htmlAddress = address
    ? `<p style="font-size:16px;margin:0 0 16px;">Место проведения: ${address}.</p>`
    : '';

  const html = `
    <div style="font-family: Arial, sans-serif; color: #333;">
      <p style="font-size:16px;margin:0 0 16px;">Здравствуйте!</p>
      <p style="font-size:16px;margin:0 0 16px;">
        ${byAdmin ? 'Администратор записал вас' : 'Вы записались'} на медицинский осмотр ${date} (МСК).
      </p>
      ${htmlAddress}
      <p style="font-size:12px;color:#777;margin:0;">
        Если вы не подавали эту заявку, обратитесь к сотруднику отдела организации судейства.
      </p>
    </div>`;
  return { subject, text, html };
}

export default { renderMedicalExamRegistrationCreatedEmail };
