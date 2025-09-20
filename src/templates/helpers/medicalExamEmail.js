import { buildEmail, paragraph, infoGrid, button } from '../email/index.js';

function formatExamDate(value) {
  if (!value) return null;
  try {
    const formatted = new Date(value)
      .toLocaleString('ru-RU', {
        timeZone: 'Europe/Moscow',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
      .replace(',', '');
    return `${formatted} (МСК)`;
  } catch {
    return null;
  }
}

function buildLocationRow(exam) {
  const center = exam?.MedicalCenter || exam?.center || {};
  const address = center.Address?.result || center.address?.result;
  if (!address) return null;
  return { label: 'Место проведения', value: address };
}

function examUrl(exam) {
  const baseUrl = process.env.BASE_URL || 'https://lk.fhmoscow.com';
  return exam?.id
    ? `${baseUrl}/medical-exams/${exam.id}`
    : `${baseUrl}/medical-exams`;
}

export function buildMedicalExamEmail({
  subject,
  previewText,
  intro,
  exam,
  extraInfoRows = [],
  extraBlocks = [],
}) {
  const dateRow = formatExamDate(exam?.start_at)
    ? { label: 'Дата и время', value: formatExamDate(exam?.start_at) }
    : null;
  const doctorRow = exam?.doctor_name
    ? { label: 'Врач', value: exam.doctor_name }
    : null;
  const rows = [
    dateRow,
    buildLocationRow(exam),
    doctorRow,
    ...extraInfoRows,
  ].filter(Boolean);

  const blocks = [
    paragraph('Здравствуйте!'),
    paragraph(intro, { html: true }),
    rows.length ? infoGrid(rows) : null,
    ...extraBlocks,
    button('Открыть заявку', examUrl(exam)),
  ].filter(Boolean);

  return buildEmail({ subject, previewText, blocks });
}

export default buildMedicalExamEmail;
