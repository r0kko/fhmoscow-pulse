import { buildMedicalExamEmail } from './helpers/medicalExamEmail.js';

export function renderMedicalExamRegistrationCreatedEmail(
  exam,
  byAdmin = false
) {
  const subject = 'Заявка на медицинский осмотр создана';
  const previewText = `${byAdmin ? 'Администратор' : 'Вы'} создали заявку на медосмотр.`;
  const intro = `${byAdmin ? 'Администратор записал вас' : 'Вы записались'} на медицинский осмотр.`;

  return buildMedicalExamEmail({
    subject,
    previewText,
    intro,
    exam,
  });
}

export default { renderMedicalExamRegistrationCreatedEmail };
