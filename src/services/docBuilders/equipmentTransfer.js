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

export default async function buildEquipmentTransferPdf(
  user,
  equipment = {},
  meta = {}
) {
  const chunks = [];
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 30, bottom: 80, left: 30, right: 30 },
    bufferPages: true,
    info: { Title: 'Акт передачи экипировки во временное пользование' },
  });
  doc.on('data', (d) => chunks.push(d));
  const done = new Promise((resolve) => doc.on('end', () => resolve()));

  const fonts = applyFonts(doc);
  const fullName = fio(user);

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
  doc.fontSize(14).text('Акт передачи экипировки во временное пользование', {
    align: 'center',
  });
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
  // Location/date line (city left, date right)
  const docDate = meta.documentDate ? new Date(meta.documentDate) : new Date();
  const formatDate = (d) => {
    try {
      const day = String(d.getDate()).padStart(2, '0');
      const months = [
        'января',
        'февраля',
        'марта',
        'апреля',
        'мая',
        'июня',
        'июля',
        'августа',
        'сентября',
        'октября',
        'ноября',
        'декабря',
      ];
      const month = months[d.getMonth()];
      const year = d.getFullYear();
      return `«${day}» ${month} ${year} г.`;
    } catch {
      return '«__» __________ ____ г.';
    }
  };
  doc.moveDown(0.8);
  doc.fontSize(11);
  {
    const y = doc.y;
    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    doc.text('г. Москва', left, y, { lineBreak: false });
    const dateText = formatDate(docDate);
    const dateWidth = doc.widthOfString(dateText);
    const xDate = right - dateWidth;
    doc.text(dateText, xDate, y, { lineBreak: true });
  }
  doc.moveDown(0.6);

  // Resolve agreement and sign info
  const [eia, userSimpleSign] = await Promise.all([
    Models.Document.findOne({
      where: { recipient_id: user.id },
      include: [
        {
          model: Models.DocumentType,
          attributes: ['alias', 'name'],
          where: { alias: 'ELECTRONIC_INTERACTION_AGREEMENT' },
        },
        { model: Models.DocumentStatus, attributes: ['alias', 'name'] },
      ],
      order: [['created_at', 'DESC']],
    }),
    Models.UserSignType.findOne({
      where: { user_id: user.id },
      include: [{ model: Models.SignType, attributes: ['alias', 'name'] }],
    }),
  ]);

  // Draw bordered information table similar to agreement
  const contentX = doc.page.margins.left;
  const contentWidth =
    doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const headerH = 18;
  const rowH = 16;
  const padX = 10;
  const padY = 6;
  const labelWidth = Math.floor(contentWidth * 0.36);

  const drawRow = (y, label, value, isHeader = false) => {
    const labelText = String(label ?? '');
    const valueText = String(value ?? '');
    const contentStart = contentX + labelWidth + padX;
    const maxValueWidth = contentX + contentWidth - padX - contentStart;
    const savedX = doc.x;
    const savedY = doc.y;

    // measure wrapped value height
    let innerH = 0;
    try {
      doc.font(isHeader ? fonts.bold : fonts.regular);
    } catch {
      /* noop */
    }
    doc.x = contentStart;
    doc.y = y + padY;
    doc.text(valueText || ' ', { width: maxValueWidth });
    innerH = doc.y - (y + padY);
    // restore cursor
    doc.x = savedX;
    doc.y = savedY;

    const baseH = isHeader ? headerH : rowH;
    const rowHeight = Math.max(baseH, Math.ceil(innerH + padY * 2));
    const yb = y + rowHeight;

    if (isHeader) {
      doc
        .save()
        .rect(contentX, y, contentWidth, rowHeight)
        .fill('#F8FAFC')
        .restore();
    }
    // outer border
    doc
      .save()
      .lineWidth(0.5)
      .strokeColor('#E5E7EB')
      .rect(contentX, y, contentWidth, rowHeight)
      .stroke()
      .restore();
    // vertical separator
    doc
      .save()
      .strokeColor('#E5E7EB')
      .lineWidth(0.5)
      .moveTo(contentX + labelWidth, y)
      .lineTo(contentX + labelWidth, yb)
      .stroke()
      .restore();
    // label
    try {
      doc.font(isHeader ? fonts.bold : fonts.bold);
    } catch {
      /* noop */
    }
    doc.text(labelText, contentX + padX, y + padY, {
      width: labelWidth - padX * 2,
      ellipsis: true,
    });
    // value
    try {
      doc.font(isHeader ? fonts.bold : fonts.regular);
    } catch {
      /* noop */
    }
    doc.text(valueText || ' ', contentStart, y + padY, {
      width: maxValueWidth,
    });
    return yb;
  };

  const fmtDateShort = (d) =>
    d ? new Date(d).toLocaleDateString('ru-RU') : '—';
  const eiaText = eia
    ? `№ ${eia.number || '—'} от ${fmtDateShort(eia.document_date)}`
    : '—';
  const signText = userSimpleSign?.SignType?.name
    ? `${userSimpleSign.SignType.name}${
        userSimpleSign.sign_created_date
          ? `, от ${fmtDateShort(userSimpleSign.sign_created_date)}`
          : ''
      }`
    : '—';

  let y = doc.y;
  y = drawRow(y, 'Сведения о судье', ' ', true);
  y = drawRow(y, 'ФИО', fullName || '—');
  y = drawRow(y, 'Дата рождения', fmtDateShort(user?.birth_date));
  y = drawRow(y, 'Сведения об основании', ' ', true);
  y = drawRow(y, 'Договор', eiaText);
  y = drawRow(y, 'Вид подписи', signText);
  y = drawRow(y, 'Сведения об экипировке', ' ', true);
  y = drawRow(y, 'Тип', equipment?.type?.name || '—');
  y = drawRow(y, 'Производитель', equipment?.manufacturer?.name || '—');
  y = drawRow(y, 'Размер', equipment?.size?.name || '—');
  y = drawRow(
    y,
    'Номер',
    equipment?.number != null ? String(equipment.number) : '—'
  );
  doc.y = y + 10;

  // Terms
  doc.fontSize(11);
  try {
    doc.font(fonts.regular);
  } catch {
    /* noop */
  }

  // Terms (brief)
  const terms = [
    '1. Экипировка передаётся во временное пользование исключительно для исполнения обязанностей спортивного судьи в рамках заключенного Договора возмездного оказания услуг по судейству хоккейных матчей официальных детско-юношеских соревнований, любительских и иных спортивных соревнований, проводимых под эгидой Федерации хоккея Москвы.',
    '2. Получатель обязуется бережно относиться к экипировке и вернуть её по первому требованию в надлежащем состоянии с учётом нормального износа.',
    '3. В случае утраты или порчи по вине Получателя он обязуется возместить причинённый ущерб в соответствии с действующим законодательством и внутренними регламентами ФХМ.',
  ];
  terms.forEach((t) => {
    doc.text(t, contentX, doc.y, { width: contentWidth, align: 'justify' });
    doc.moveDown(0.2);
  });
  doc.moveDown(0.6);

  // Footer and optional e-sign stamp
  const range = doc.bufferedPageRange();
  const barcodeText = meta.docId || null;
  const numberText = meta.number || null;
  const esign = meta?.esign || null;
  for (let i = 0; i < range.count; i += 1) {
    doc.switchToPage(range.start + i);
    if (esign) {
      await applyESignStamp(doc, {
        fio: fullName,
        signedAt: esign.signedAt,
        userId: user?.id,
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
