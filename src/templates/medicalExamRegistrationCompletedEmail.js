import { buildMedicalExamEmail } from './helpers/medicalExamEmail.js';
import { paragraph } from './email/index.js';

export function renderMedicalExamRegistrationCompletedEmail(exam) {
  const subject = 'Медицинский осмотр завершён';
  const previewText = 'Ваш медицинский осмотр завершён.';
  const intro = 'Медицинский осмотр завершён и результат сохранён в системе.';

  const extraBlocks = [
    paragraph(
      'Спасибо, что прошли медицинский осмотр. Если требуется повторный визит, вы получите отдельное уведомление.'
    ),
  ];

  return buildMedicalExamEmail({
    subject,
    previewText,
    intro,
    exam,
    extraBlocks,
  });
}

export default { renderMedicalExamRegistrationCompletedEmail };
