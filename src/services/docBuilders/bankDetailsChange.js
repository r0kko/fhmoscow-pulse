import PDFDocument from 'pdfkit';

import {
  applyFonts,
  applyFirstPageHeader,
  applyFooter,
  applyESignStamp,
} from '../../utils/pdf.js';
import * as Models from '../../models/index.js';

function fio(user) {
  if (!user) return '';
  return [user.last_name, user.first_name, user.patronymic]
    .filter(Boolean)
    .join(' ');
}

export default async function buildBankDetailsChangePdf(
  user,
  changes = {},
  meta = {}
) {
  const chunks = [];
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 30, bottom: 80, left: 30, right: 30 },
    bufferPages: true,
    info: { Title: 'Заявление об изменении банковских реквизитов' },
  });
  doc.on('data', (d) => chunks.push(d));
  const done = new Promise((resolve) => doc.on('end', () => resolve()));

  const fonts = applyFonts(doc);
  const fullName =
    `${user.last_name} ${user.first_name}${user.patronymic ? ` ${user.patronymic}` : ''}`.trim();

  applyFirstPageHeader(doc);
  try {
    const HEADER_TOP = 30;
    const HEADER_HEIGHT = 32;
    const HEADER_PADDING = 12;
    const minY = HEADER_TOP + HEADER_HEIGHT + HEADER_PADDING;
    if (doc.y < minY) doc.y = minY;
  } catch {
    /* noop */
  }

  try {
    doc.font(fonts.bold);
  } catch {
    /* noop */
  }
  doc
    .fontSize(14)
    .text('Заявление об изменении банковских реквизитов', { align: 'center' });
  try {
    doc.moveDown(0.2);
    doc.fillColor('#666');
    doc.fontSize(10).text('для спортивного судьи Федерации хоккея Москвы', {
      align: 'center',
    });
    doc.fillColor('black');
  } catch {
    /* noop */
  }
  try {
    doc.font(fonts.regular);
  } catch {
    /* noop */
  }
  doc.moveDown(1);
  doc.fontSize(11);

  // Intro
  const intro = `Я, ${fullName}, прошу изменить мои банковские реквизиты для начисления вознаграждений.`;
  doc.text(intro, { align: 'justify' }).moveDown(0.75);

  // Section: User info (compact, as in contract application)
  const bdate = user?.birth_date
    ? new Date(user.birth_date).toLocaleDateString('ru-RU')
    : '—';
  const [innRec, taxationRec] = await Promise.all([
    (Models.Inn?.findOne?.bind(Models.Inn) || (() => Promise.resolve(null)))({
      where: { user_id: user.id },
      attributes: ['number'],
    }),
    (
      Models.Taxation?.findOne?.bind(Models.Taxation) ||
      (() => Promise.resolve(null))
    )({
      where: { user_id: user.id },
      include: [{ model: Models.TaxationType, attributes: ['alias', 'name'] }],
    }),
  ]);
  const taxationName = taxationRec?.TaxationType?.name || '—';

  try {
    doc.font(fonts.bold);
  } catch {
    /* noop */
  }
  doc.text('Сведения о судье').moveDown(0.3);
  try {
    doc.font(fonts.regular);
  } catch {
    /* noop */
  }
  const labelWidth = 220;
  const startX = doc.page.margins.left;
  const rowSimple = (label, value) => {
    const y = doc.y;
    try {
      doc.font(fonts.bold);
    } catch {
      /* noop */
    }
    doc.text(label, startX, y, { width: labelWidth, lineBreak: false });
    const colX = startX + labelWidth + 8;
    try {
      doc.font(fonts.regular);
    } catch {
      /* noop */
    }
    doc.text((value ?? '—').toString(), colX, y, {
      width: doc.page.width - doc.page.margins.right - colX,
    });
  };
  rowSimple('ФИО', fullName);
  rowSimple('Дата рождения', bdate);
  rowSimple('ИНН', innRec?.number || '—');
  rowSimple('Налоговый статус', taxationName);
  doc.moveDown(0.75);

  // Fetch previous bank account from DB to display old vs new
  const prev =
    (await (
      Models.BankAccount?.findOne?.bind(Models.BankAccount) ||
      (() => Promise.resolve(null))
    )({ where: { user_id: user.id } })) || null;

  // Two stacked blocks: Старые реквизиты, затем Новые реквизиты
  const field = (label, value) => {
    const y = doc.y;
    try {
      doc.font(fonts.bold);
    } catch {
      /* noop */
    }
    doc.text(label, startX, y, { width: labelWidth, lineBreak: false });
    const colX = startX + labelWidth + 8;
    try {
      doc.font(fonts.regular);
    } catch {
      /* noop */
    }
    doc.text((value ?? '—').toString(), colX, y, {
      width: doc.page.width - doc.page.margins.right - colX,
    });
  };

  // Старые реквизиты
  try {
    doc.font(fonts.bold);
  } catch {
    /* noop */
  }
  doc.text('Старые реквизиты', { align: 'left' });
  try {
    doc.font(fonts.regular);
  } catch {
    /* noop */
  }
  doc.moveDown(0.3);
  field('Расчётный счёт (р/с)', prev?.number || '—');
  field('БИК', prev?.bic || '—');
  field('Наименование банка', prev?.bank_name || '—');
  field('Корреспондентский счёт (к/с)', prev?.correspondent_account || '—');
  field('ИНН банка', prev?.inn || '—');
  field('КПП', prev?.kpp || '—');
  field('SWIFT', prev?.swift || '—');
  field('Адрес банка', prev?.address || '—');
  doc.moveDown(0.6);

  // Новые реквизиты
  try {
    doc.font(fonts.bold);
  } catch {
    /* noop */
  }
  doc.text('Новые реквизиты', { align: 'left' });
  try {
    doc.font(fonts.regular);
  } catch {
    /* noop */
  }
  doc.moveDown(0.3);
  field('Расчётный счёт (р/с)', changes?.number || '—');
  field('БИК', changes?.bic || '—');
  field('Наименование банка', changes?.bank_name || '—');
  field('Корреспондентский счёт (к/с)', changes?.correspondent_account || '—');
  field('ИНН банка', changes?.inn || '—');
  field('КПП', changes?.kpp || '—');
  field('SWIFT', changes?.swift || '—');
  field('Адрес банка', changes?.address || '—');

  doc.moveDown(1);
  doc.text(
    'Подтверждаю корректность указанных реквизитов и согласен(на) на их использование для выплат.',
    { align: 'justify' }
  );

  // Footer and optional esign
  const range = doc.bufferedPageRange();
  const barcodeText = meta.docId || null;
  const numberText = meta.number || null;
  const esign = meta?.esign || null;
  for (let i = 0; i < range.count; i += 1) {
    doc.switchToPage(range.start + i);
    if (esign) {
      await applyESignStamp(doc, {
        fio: `${fio(user)}`,
        signedAt: esign.signedAt,
        userId: user.id,
        // Include identifiers to standardize QR payload across documents
        docId: meta.docId,
        signId: esign.signId,
        page: i + 1,
        total: range.count,
      });
    }
    await applyFooter(doc, {
      page: i + 1,
      total: range.count,
      barcodeText,
      numberText,
    });
  }

  doc.end();
  await done;
  return Buffer.concat(chunks);
}
