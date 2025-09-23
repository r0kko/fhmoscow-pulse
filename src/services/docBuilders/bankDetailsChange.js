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
  doc.moveDown(0.6);
  doc.fontSize(11);

  // Structured tables with bordered rows for judge info and bank details
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

  const contentX = doc.page.margins.left;
  const contentWidth =
    doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const labelWidth = Math.min(220, Math.round(contentWidth * 0.45));
  const valueWidth = contentWidth - labelWidth;

  const drawKeyValueRow = (cursorY, { label, value, header = false }) => {
    const padX = header ? 10 : 8;
    const padY = header ? 6 : 5;
    const baseHeight = header ? 20 : 18;
    const labelText = String(label ?? '');
    const valueText = header ? String(value ?? '') : String(value ?? '—');

    try {
      doc
        .font(header ? fonts.bold : fonts.regular)
        .fontSize(header ? 10.5 : 10);
    } catch {
      doc.fontSize(header ? 10.5 : 10);
    }

    const labelBoxWidth = header
      ? contentWidth - padX * 2
      : Math.max(32, labelWidth - padX * 2);
    const valueBoxWidth = Math.max(32, valueWidth - padX * 2);
    const labelHeight = doc.heightOfString(labelText || ' ', {
      width: labelBoxWidth,
      align: 'left',
    });
    const valueHeight = header
      ? 0
      : doc.heightOfString(valueText || '—', {
          width: valueBoxWidth,
          align: 'left',
        });
    const innerHeight = header
      ? labelHeight
      : Math.max(labelHeight, valueHeight);
    const rowHeight = Math.max(baseHeight, Math.ceil(innerHeight + padY * 2));
    const bottomY = cursorY + rowHeight;

    if (header) {
      try {
        doc
          .save()
          .fillColor('#F2F4F7')
          .rect(contentX, cursorY, contentWidth, rowHeight)
          .fill()
          .restore();
      } catch {
        /* noop */
      }
    }

    try {
      doc
        .save()
        .lineWidth(0.5)
        .strokeColor('#E5E7EB')
        .rect(contentX, cursorY, contentWidth, rowHeight)
        .stroke();
      if (!header) {
        doc
          .moveTo(contentX + labelWidth, cursorY)
          .lineTo(contentX + labelWidth, bottomY)
          .stroke();
      }
      doc.restore();
    } catch {
      /* noop */
    }

    const prevX = doc.x;
    const prevY = doc.y;
    try {
      doc
        .font(header ? fonts.bold : fonts.regular)
        .fontSize(header ? 10.5 : 9.8);
    } catch {
      doc.fontSize(header ? 10.5 : 9.8);
    }
    doc.fillColor('#111827');
    if (header) {
      doc.text(labelText, contentX + padX, cursorY + padY, {
        width: contentWidth - padX * 2,
        align: 'left',
      });
    } else {
      doc.text(labelText, contentX + padX, cursorY + padY, {
        width: Math.max(32, labelWidth - padX * 2),
        align: 'left',
      });
      try {
        doc.font(fonts.regular).fontSize(9.8);
      } catch {
        doc.fontSize(9.8);
      }
      doc.text(valueText || '—', contentX + labelWidth + padX, cursorY + padY, {
        width: valueBoxWidth,
        align: 'left',
      });
    }
    doc.fillColor('black');
    doc.x = prevX;
    doc.y = prevY;
    return bottomY;
  };

  const renderKeyValueSection = (rows, { spacingAfter = 12 } = {}) => {
    let cursorY = doc.y;
    rows.forEach((row) => {
      cursorY = drawKeyValueRow(cursorY, row);
    });
    doc.y = cursorY + Math.max(0, spacingAfter);
    doc.x = contentX;
  };

  try {
    doc.font(fonts.regular).fontSize(10);
  } catch {
    doc.fontSize(10);
  }

  renderKeyValueSection(
    [
      { header: true, label: 'Сведения о судье' },
      { label: 'ФИО', value: fullName },
      { label: 'Дата рождения', value: bdate },
      { label: 'ИНН', value: innRec?.number || '—' },
      { label: 'Налоговый статус', value: taxationName },
    ],
    { spacingAfter: 14 }
  );

  // Fetch previous bank account from DB to display old vs new
  const prev =
    (await (
      Models.BankAccount?.findOne?.bind(Models.BankAccount) ||
      (() => Promise.resolve(null))
    )({ where: { user_id: user.id } })) || null;

  renderKeyValueSection(
    [
      { header: true, label: 'Старые реквизиты' },
      { label: 'Расчётный счёт (р/с)', value: prev?.number || '—' },
      { label: 'БИК', value: prev?.bic || '—' },
      { label: 'Наименование банка', value: prev?.bank_name || '—' },
      {
        label: 'Корреспондентский счёт (к/с)',
        value: prev?.correspondent_account || '—',
      },
      { label: 'ИНН банка', value: prev?.inn || '—' },
      { label: 'КПП', value: prev?.kpp || '—' },
      { label: 'SWIFT', value: prev?.swift || '—' },
      { label: 'Адрес банка', value: prev?.address || '—' },
    ],
    { spacingAfter: 12 }
  );

  renderKeyValueSection(
    [
      { header: true, label: 'Новые реквизиты' },
      { label: 'Расчётный счёт (р/с)', value: changes?.number || '—' },
      { label: 'БИК', value: changes?.bic || '—' },
      { label: 'Наименование банка', value: changes?.bank_name || '—' },
      {
        label: 'Корреспондентский счёт (к/с)',
        value: changes?.correspondent_account || '—',
      },
      { label: 'ИНН банка', value: changes?.inn || '—' },
      { label: 'КПП', value: changes?.kpp || '—' },
      { label: 'SWIFT', value: changes?.swift || '—' },
      { label: 'Адрес банка', value: changes?.address || '—' },
    ],
    { spacingAfter: 12 }
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
