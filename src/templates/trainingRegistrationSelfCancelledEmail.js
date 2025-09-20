import { buildTrainingEmail } from './helpers/trainingEmail.js';

function resolveTypeAcc(training) {
  return training?.TrainingType?.for_camp ? 'тренировку' : 'мероприятие';
}

export function renderTrainingRegistrationSelfCancelledEmail(training) {
  const typeAcc = resolveTypeAcc(training);
  const subject = `Запись на ${typeAcc} отменена`;
  const previewText = `Запись на ${typeAcc} отменена по вашему запросу.`;
  const intro = `Запись на <strong>${typeAcc}</strong> отменена по вашему запросу.`;

  return buildTrainingEmail({
    subject,
    previewText,
    intro,
    training,
  });
}

export default { renderTrainingRegistrationSelfCancelledEmail };
