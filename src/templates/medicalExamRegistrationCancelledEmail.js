import { buildMedicalExamEmail } from './helpers/medicalExamEmail.js';

export function renderMedicalExamRegistrationCancelledEmail(exam) {
  const subject = 'Заявка на медицинский осмотр отменена';
  const previewText = 'Заявка на медицинский осмотр отменена администратором.';
  const intro = 'Администратор отменил вашу заявку на медицинский осмотр.';

  return buildMedicalExamEmail({
    subject,
    previewText,
    intro,
    exam,
  });
}

export default { renderMedicalExamRegistrationCancelledEmail };
