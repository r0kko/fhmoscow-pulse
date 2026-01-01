import {
  buildEmail,
  paragraph,
  heading,
  button,
  infoGrid,
  divider,
  spacer,
} from './email/index.js';

function buildRosterRows(item) {
  const rows = [{ label: 'Роль', value: item.role || '—' }];
  if (item.ground) {
    rows.push({ label: 'Площадка', value: item.ground });
  }
  if (item.address) {
    rows.push({ label: 'Адрес', value: item.address });
  }
  if (!item.ground && !item.address) {
    rows.push({ label: 'Площадка', value: '—' });
  }
  return rows;
}

function resolveTimeLabel(item) {
  if (item?.time) return item.time;
  const datetime = item?.datetime || '';
  const match = datetime.match(/(\d{2}:\d{2})/);
  if (match) return match[1];
  return datetime || '—';
}

function buildRosterBlocks(title, items = []) {
  if (!items.length) return [];
  const blocks = [heading(title, { level: 3 })];
  items.forEach((item, index) => {
    const matchLabel = item.match_label || '—';
    const timeLabel = resolveTimeLabel(item);
    const metaLabel = item.meta || '';
    const header =
      timeLabel && timeLabel !== '—'
        ? `${timeLabel} · ${matchLabel}`
        : matchLabel;
    blocks.push(heading(header, { level: 4 }));
    if (metaLabel) {
      blocks.push(paragraph(metaLabel));
    }
    blocks.push(infoGrid(buildRosterRows(item), { columnGap: 12 }));
    if (index < items.length - 1) {
      blocks.push(divider());
    }
  });
  return blocks;
}

function formatDateKey(dateKey) {
  if (!dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return '';
  const [yyyy, mm, dd] = dateKey.split('-');
  return `${dd}.${mm}.${yyyy}`;
}

function resolveSubject(dateLabel) {
  if (dateLabel) return `Назначения на ${dateLabel}`;
  return 'Назначения судьи';
}

function resolveIntro(dateLabel) {
  if (dateLabel) {
    return `Обновлены назначения на ${dateLabel}. Проверьте изменения ниже и откройте личный кабинет для актуального расписания.`;
  }
  return 'Обновлены назначения. Проверьте изменения ниже и откройте личный кабинет для актуального расписания.';
}

export function renderRefereeAssignmentsNotificationEmail(payload = {}) {
  const published = Array.isArray(payload.published) ? payload.published : [];
  const cancelled = Array.isArray(payload.cancelled) ? payload.cancelled : [];
  const dateLabel = formatDateKey(payload.date);
  const subject = resolveSubject(dateLabel);
  const previewText = resolveIntro(dateLabel);
  const appUrl = process.env.BASE_URL || 'https://lk.fhmoscow.com';
  const assignmentsUrl = `${appUrl}/referee-assignments`;

  const blocks = [paragraph('Здравствуйте!'), paragraph(previewText)];

  const sections = [
    { title: 'Новые назначения', items: published },
    { title: 'Отмененные назначения', items: cancelled },
  ];

  let hasSection = false;
  sections.forEach((section) => {
    const sectionBlocks = buildRosterBlocks(section.title, section.items);
    if (!sectionBlocks.length) return;
    if (hasSection) blocks.push(spacer(12));
    blocks.push(...sectionBlocks);
    hasSection = true;
  });

  blocks.push(
    paragraph(
      'Актуальное расписание доступно в личном кабинете. Проверьте его перед матчами.'
    )
  );

  blocks.push(
    button('Открыть мои назначения', assignmentsUrl, { fullWidth: true })
  );

  return buildEmail({ subject, previewText, blocks });
}

export default { renderRefereeAssignmentsNotificationEmail };
