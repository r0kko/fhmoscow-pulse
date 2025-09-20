import { buildMedicalExamEmail } from './helpers/medicalExamEmail.js';

export function renderMedicalExamRegistrationApprovedEmail(exam) {
  const subject = 'Заявка на медицинский осмотр подтверждена';
  const previewText = 'Заявка на медицинский осмотр подтверждена.';
  const intro =
    'Ваша заявка на медицинский осмотр подтверждена. Ждём вас в указанное время.';

  return buildMedicalExamEmail({
    subject,
    previewText,
    intro,
    exam,
  });
}

export default { renderMedicalExamRegistrationApprovedEmail };
