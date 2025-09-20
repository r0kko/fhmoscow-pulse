import { buildMedicalExamEmail } from './helpers/medicalExamEmail.js';

export function renderMedicalExamRegistrationSelfCancelledEmail(exam) {
  const subject = 'Заявка на медицинский осмотр отменена';
  const previewText =
    'Заявка на медицинский осмотр отменена по вашему запросу.';
  const intro = 'Вы отменили заявку на медицинский осмотр.';

  return buildMedicalExamEmail({
    subject,
    previewText,
    intro,
    exam,
  });
}

export default { renderMedicalExamRegistrationSelfCancelledEmail };
