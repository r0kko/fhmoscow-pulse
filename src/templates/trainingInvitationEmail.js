import { buildTrainingEmail } from './helpers/trainingEmail.js';
import { paragraph } from './email/index.js';

export function renderTrainingInvitationEmail(training) {
  const typeName = training?.TrainingType?.name || 'мероприятие';
  const subject = `Приглашение на ${typeName.toLowerCase()}`;
  const previewText = `Вы приглашены на ${typeName.toLowerCase()}. Подтвердите участие.`;
  const intro = `Вы приглашены на <strong>${typeName.toLowerCase()}</strong>. Пожалуйста, подтвердите своё присутствие.`;

  const isOnline = Boolean(training?.TrainingType?.online);
  const extraInfoRows = [];
  if (isOnline && training?.url) {
    extraInfoRows.push({
      label: 'Формат',
      value: `<a href="${training.url}" target="_blank">Онлайн-ссылка</a>`,
      allowHtml: true,
    });
  }

  const onlineBlock =
    isOnline && training?.url
      ? paragraph(
          `Онлайн по ссылке: <a href="${training.url}" target="_blank">${training.url}</a>.`,
          { html: true }
        )
      : null;

  const reminderBlock = paragraph(
    'Подтвердите участие в разделе «Повышение квалификации», нажав кнопку «Записаться». Количество мест ограничено.'
  );

  return buildTrainingEmail({
    subject,
    previewText,
    intro,
    training,
    extraInfoRows,
    extraBlocks: [onlineBlock, reminderBlock].filter(Boolean),
    buttonLabel: 'Подтвердить участие',
  });
}

export default { renderTrainingInvitationEmail };
