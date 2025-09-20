import { buildTrainingEmail } from './helpers/trainingEmail.js';

function resolveTypePrep(training) {
  return training?.TrainingType?.for_camp ? 'тренировке' : 'мероприятии';
}

export function renderTrainingRoleChangedEmail(training, role, byAdmin = true) {
  const typePrep = resolveTypePrep(training);
  const roleName = role?.name || role?.alias;
  const subject = `Изменена роль на ${typePrep}`;
  const previewText = `${byAdmin ? 'Администратор' : 'Вы'} изменили роль на ${typePrep}.`;
  const intro = `${byAdmin ? 'Администратор изменил вашу роль' : 'Вы изменили свою роль'} на <strong>${typePrep}</strong>.`;

  return buildTrainingEmail({
    subject,
    previewText,
    intro,
    training,
    extraInfoRows: roleName ? [{ label: 'Новая роль', value: roleName }] : [],
  });
}

export default { renderTrainingRoleChangedEmail };
