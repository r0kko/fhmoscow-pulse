import { buildEmail, paragraph, button } from './email/index.js';

export function renderAccountActivatedEmail() {
  const subject = 'Учетная запись активирована';
  const previewText = 'Ваш доступ в личный кабинет АСОУ ПД Пульс включен.';
  const baseUrl = process.env.BASE_URL || 'https://lk.fhmoscow.com';

  const blocks = [
    paragraph('Здравствуйте!'),
    paragraph(
      'Администратор подтвердил вашу учетную запись в системе <strong>АСОУ ПД Пульс</strong>. Теперь вы можете войти в личный кабинет и использовать все функции сервиса.',
      { html: true }
    ),
    button('Перейти в личный кабинет', `${baseUrl}`, { fullWidth: false }),
  ];

  return buildEmail({ subject, previewText, blocks });
}

export default { renderAccountActivatedEmail };
