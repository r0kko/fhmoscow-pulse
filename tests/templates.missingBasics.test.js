import { expect, test, describe } from '@jest/globals';

import { renderDocumentRejectedEmail } from '../src/templates/documentRejectedEmail.js';
import { renderDocumentSignedEmail } from '../src/templates/documentSignedEmail.js';
import { renderMedicalCertificateAddedEmail } from '../src/templates/medicalCertificateAddedEmail.js';
import { renderMedicalExamRegistrationCancelledEmail } from '../src/templates/medicalExamRegistrationCancelledEmail.js';
import { renderMedicalExamRegistrationCompletedEmail } from '../src/templates/medicalExamRegistrationCompletedEmail.js';
import { renderMedicalExamRegistrationSelfCancelledEmail } from '../src/templates/medicalExamRegistrationSelfCancelledEmail.js';
import { renderPasswordResetEmail } from '../src/templates/passwordResetEmail.js';
import { renderSignTypeSelectionEmail } from '../src/templates/signTypeSelectionEmail.js';
import { renderTicketCreatedEmail } from '../src/templates/ticketCreatedEmail.js';
import { renderTicketStatusChangedEmail } from '../src/templates/ticketStatusChangedEmail.js';

describe('basic email templates', () => {
  const doc = { number: '42', name: 'Положение' };
  const exam = { start_at: '2025-01-02T15:30:00Z' };
  const ticket = {
    number: 'T-1',
    TicketStatus: { name: 'Новый' },
    TicketType: { name: 'Вопрос' },
  };

  test('documentRejected', () => {
    const { subject, text, html } = renderDocumentRejectedEmail(doc);
    expect(subject).toContain('отклонен');
    expect(text).toContain(doc.name);
    expect(text).toContain(doc.number);
    expect(html).toContain(`<strong>${doc.name}</strong>`);
  });

  test('documentSigned', () => {
    const { subject, text, html } = renderDocumentSignedEmail(doc);
    expect(subject).toContain('подписан');
    expect(text).toContain(doc.name);
    expect(text).toContain(doc.number);
    expect(html).toContain(`<strong>${doc.name}</strong>`);
  });

  test('medicalCertificateAdded', () => {
    const { subject, text, html } = renderMedicalCertificateAddedEmail();
    expect(subject).toContain('медицинское заключение');
    expect(text).toContain('АСОУ ПД Пульс');
    expect(html).toContain('АСОУ ПД Пульс');
  });

  test('examCancelled', () => {
    const { subject, text, html } =
      renderMedicalExamRegistrationCancelledEmail(exam);
    expect(subject).toContain('отменена');
    expect(text).toContain('заявку на медицинский осмотр');
    expect(html).toContain('заявку на медицинский осмотр');
  });

  test('examCompleted', () => {
    const { subject, text, html } =
      renderMedicalExamRegistrationCompletedEmail(exam);
    expect(subject).toContain('осмотр заверш');
    expect(text).toContain('Медицинский осмотр');
    expect(html).toContain('Медицинский осмотр');
  });

  test('examSelfCancelled', () => {
    const { subject, text, html } =
      renderMedicalExamRegistrationSelfCancelledEmail(exam);
    expect(subject).toContain('отменена');
    expect(text).toContain('Вы отменили');
    expect(html).toContain('Вы отменили');
  });

  test('passwordReset', () => {
    const { subject, text, html } = renderPasswordResetEmail('123456');
    expect(subject).toContain('Сброс пароля');
    expect(text).toContain('123456');
    expect(html).toContain('123456');
  });

  test('signTypeSelection', () => {
    const { subject, text, html } = renderSignTypeSelectionEmail('654321');
    expect(subject).toContain('электронной подписи');
    expect(text).toContain('654321');
    expect(html).toContain('654321');
  });

  test('ticketCreated', () => {
    const { subject, text, html } = renderTicketCreatedEmail(ticket);
    expect(subject).toContain('Обращение');
    expect(text).toContain(ticket.number);
    expect(text).toContain(ticket.TicketType.name);
    expect(html).toContain(`<strong>${ticket.number}</strong>`);
  });

  test('ticketStatusChanged', () => {
    const { subject, text, html } = renderTicketStatusChangedEmail(ticket);
    expect(subject).toContain('Статус');
    expect(text).toContain(ticket.number);
    expect(text).toContain(ticket.TicketStatus.name);
    expect(html).toContain(`<strong>${ticket.number}</strong>`);
  });
});
