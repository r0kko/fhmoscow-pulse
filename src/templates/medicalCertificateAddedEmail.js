import { buildEmail, paragraph, button } from './email/index.js';

export function renderMedicalCertificateAddedEmail() {
  const subject = 'Добавлено медицинское заключение';
  const previewText =
    'Новое медицинское заключение доступно в личном кабинете.';
  const baseUrl = process.env.BASE_URL || 'https://lk.fhmoscow.com';

  const blocks = [
    paragraph('Здравствуйте!'),
    paragraph(
      'Администратор добавил в ваш профиль новое медицинское заключение в системе <strong>АСОУ ПД Пульс</strong>.',
      { html: true }
    ),
    paragraph('Ознакомиться с документом можно в личном кабинете.'),
    button('Открыть личный кабинет', `${baseUrl}/medical-certificates`, {
      fullWidth: false,
    }),
  ];

  return buildEmail({ subject, previewText, blocks });
}

export default { renderMedicalCertificateAddedEmail };
