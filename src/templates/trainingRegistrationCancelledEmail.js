import { buildTrainingEmail } from './helpers/trainingEmail.js';

function resolveTypeAcc(training) {
  return training?.TrainingType?.for_camp ? 'тренировку' : 'мероприятие';
}

export function renderTrainingRegistrationCancelledEmail(training) {
  const typeAcc = resolveTypeAcc(training);
  const subject = `Запись на ${typeAcc} отменена`;
  const previewText = `Администратор отменил вашу запись на ${typeAcc}.`;
  const intro = `Администратор отменил вашу запись на <strong>${typeAcc}</strong>.`;

  return buildTrainingEmail({
    subject,
    previewText,
    intro,
    training,
  });
}

export default { renderTrainingRegistrationCancelledEmail };
