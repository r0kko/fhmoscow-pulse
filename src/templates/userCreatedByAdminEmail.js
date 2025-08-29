import { escapeHtml } from '../utils/html.js';

export function renderUserCreatedByAdminEmail(user, tempPassword) {
  const subject = 'Доступ к аккаунту АСОУ ПД Пульс';
  const fullName = [user.first_name, user.patronymic].filter(Boolean).join(' ');
  const greet = fullName
    ? `Здравствуйте, ${escapeHtml(fullName)}!`
    : 'Здравствуйте!';
  const appUrl = process.env.BASE_URL || 'https://lk.fhmoscow.com';
  const phoneDisplay = user?.phone
    ? user.phone.startsWith('+')
      ? user.phone
      : `+${user.phone}`
    : '';

  const text =
    `${greet}\n\n` +
    'Для вас создана учётная запись в системе АСОУ ПД Пульс ' +
    '(новая система управления проведением соревнований ФХМ). ' +
    'Ниже — данные для первого входа.\n\n' +
    `Логин (телефон): ${phoneDisplay}\n` +
    `Временный пароль: ${tempPassword}\n\n` +
    `Войти: ${appUrl}\n\n` +
    'Просим Вас проверить корректность отображения и наполнения разделов, исходя из Вашей роли и задач. ' +
    'При возникновении проблем просим обращаться к Дроботу Алексею (+7 (926) 244-22-22, WhatsApp/Telegram).';

  const html = `
    <div style="font-family: Arial, sans-serif; color: #333;">
      <p style="font-size:16px;margin:0 0 16px;">${greet}</p>
      <p style="font-size:16px;margin:0 0 16px;">Для вас создана учётная запись в системе <strong>АСОУ ПД Пульс</strong> <span style="color:#6b7280;">(новая система управления проведением соревнований ФХМ)</span>. Ниже — данные для первого входа.</p>
      <p style="font-size:16px;margin:0 0 8px;">Логин (телефон): <span style="font-family:ui-monospace,Menlo,monospace;background:#f3f4f6;padding:4px 6px;border-radius:6px;white-space:nowrap;">${escapeHtml(
        phoneDisplay
      )}</span></p>
      <p style="font-size:16px;margin:0 0 16px;">Временный пароль: <span style="font-family:ui-monospace,Menlo,monospace;background:#f3f4f6;padding:4px 6px;border-radius:6px;white-space:nowrap;">${escapeHtml(
        tempPassword
      )}</span></p>
      <p style="font-size:16px;margin:0 0 16px;">
        <a href="${appUrl}" target="_blank" style="display:inline-block;background:#0F62FE;color:#fff;text-decoration:none;padding:10px 14px;border-radius:8px;font-weight:600;">Перейти в личный кабинет</a>
      </p>
      <p style="font-size:16px;margin:0 0 16px;">Просим Вас проверить корректность отображения и наполнения разделов, исходя из Вашей роли и задач. При возникновении проблем просим обращаться к Дроботу Алексею (<a href="tel:+79262442222" style="color:inherit;text-decoration:none;">+7 (926) 244-22-22</a>, WhatsApp/Telegram).</p>
    </div>`;

  return { subject, text, html };
}

export default { renderUserCreatedByAdminEmail };
