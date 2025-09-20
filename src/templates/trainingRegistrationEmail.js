import { buildTrainingEmail } from './helpers/trainingEmail.js';

function resolveTypeAcc(training) {
  return training?.TrainingType?.for_camp ? 'тренировку' : 'мероприятие';
}

export function renderTrainingRegistrationEmail(
  training,
  role,
  byAdmin = false
) {
  const typeAcc = resolveTypeAcc(training);
  const subject = `Запись на ${typeAcc} подтверждена`;
  const previewText = `${byAdmin ? 'Администратор записал вас' : 'Вы записались'} на ${typeAcc}.`;
  const roleName = role?.name || role?.alias;

  const intro = `${byAdmin ? 'Администратор записал вас' : 'Вы успешно записались'} на <strong>${typeAcc}</strong>.`;

  const extraInfoRows = roleName
    ? [{ label: 'Ваша роль', value: roleName }]
    : [];

  return buildTrainingEmail({
    subject,
    previewText,
    intro,
    training,
    extraInfoRows,
  });
}

export default { renderTrainingRegistrationEmail };
