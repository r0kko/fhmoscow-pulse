import { buildEmail, paragraph, infoGrid, button } from './email/index.js';

function normalizePhone(phone) {
  if (!phone) return '';
  const trimmed = String(phone).trim();
  if (!trimmed) return '';
  return trimmed.startsWith('+') ? trimmed : `+${trimmed}`;
}

export function renderUserCreatedByAdminEmail(user, tempPassword) {
  const subject = 'Доступ к аккаунту АСОУ ПД Пульс';
  const baseUrl = process.env.BASE_URL || 'https://lk.fhmoscow.com';
  const fullName = [user?.first_name, user?.patronymic]
    .filter(Boolean)
    .join(' ');
  const greeting = fullName ? `Здравствуйте, ${fullName}!` : 'Здравствуйте!';
  const phoneDisplay = normalizePhone(user?.phone);

  const previewText =
    'Учетная запись создана. Используйте временный пароль для первого входа.';

  const blocks = [
    paragraph(greeting),
    paragraph(
      'Для вас создана учётная запись в системе <strong>АСОУ ПД Пульс</strong> (новая система управления соревнованиями ФХМ). Ниже — данные для первого входа.',
      { html: true }
    ),
    infoGrid([
      { label: 'Логин (телефон)', value: phoneDisplay },
      { label: 'Временный пароль', value: tempPassword },
    ]),
    button('Перейти в личный кабинет', baseUrl),
    paragraph(
      'Проверьте, пожалуйста, что разделы в личном кабинете соответствуют вашей роли и задачам. При возникновении вопросов обращайтесь к Дроботу Алексею (<a href="tel:+79262442222">+7 (926) 244-22-22</a>, WhatsApp/Telegram).',
      { html: true }
    ),
  ];

  return buildEmail({ subject, previewText, blocks });
}

export default { renderUserCreatedByAdminEmail };
