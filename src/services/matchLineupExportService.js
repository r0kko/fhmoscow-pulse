import PDFDocument from 'pdfkit-table';

import { applyFonts, applyFirstPageHeader, applyFooter } from '../utils/pdf.js';
import { PDF_STYLE } from '../config/pdf.js';
import {
  Match,
  Team,
  Tournament,
  TournamentType,
  Stage,
  TournamentGroup,
  Tour,
} from '../models/index.js';

import lineupService from './matchLineupService.js';

function cleanJoin(arr, sep = ' · ') {
  return arr.filter((x) => x && String(x).trim().length).join(sep);
}

function ruDateStr(iso) {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Europe/Moscow',
    }).format(d);
  } catch {
    return '';
  }
}

async function getMatchMeta(matchId) {
  const m = await Match.findByPk(matchId, {
    attributes: ['id', 'date_start', 'team1_id', 'team2_id', 'tournament_id'],
    include: [
      { model: Team, as: 'HomeTeam', attributes: ['name'] },
      { model: Team, as: 'AwayTeam', attributes: ['name'] },
      {
        model: Tournament,
        attributes: ['name', 'full_name', 'type_id'],
        include: [{ model: TournamentType, attributes: ['double_protocol'] }],
      },
      { model: Stage, attributes: ['name'] },
      { model: TournamentGroup, attributes: ['name'] },
      { model: Tour, attributes: ['name'] },
    ],
  });
  if (!m) throw Object.assign(new Error('match_not_found'), { code: 404 });
  return {
    date: ruDateStr(m.date_start),
    competition: cleanJoin(
      [m.Tournament?.full_name || m.Tournament?.name].filter(Boolean)
    ),
    tournament: m.Tournament?.full_name || m.Tournament?.name || null,
    stage: m.Stage?.name || null,
    group: m.TournamentGroup?.name || null,
    tour: m.Tour?.name || null,
    homeName: m.HomeTeam?.name || 'Команда 1',
    awayName: m.AwayTeam?.name || 'Команда 2',
    double: !!m.Tournament?.TournamentType?.double_protocol,
  };
}

// Helpers for uniform tables with vertical borders and centered columns where needed
function truncateToFit(doc, text, width, { font, size }) {
  const txt = String(text ?? '');
  doc.font(font).fontSize(size);
  if (doc.widthOfString(txt) <= width - 2) return txt;
  let t = txt;
  while (t.length > 1 && doc.widthOfString(`${t}…`) > width - 2)
    t = t.slice(0, -1);
  return `${t}…`;
}

function drawTable(doc, { x, y, columns, rows }, options = {}) {
  const opts = {
    headerHeight: 18,
    rowHeight: 16,
    zebra: true,
    borderColor: '#D0D5DD',
    headerBg: '#F6F8FA',
    text: { font: 'Helvetica', size: 9, color: '#000000' },
    headerText: { font: 'Helvetica-Bold', size: 9, color: '#000000' },
    vPadding: 3,
    hPadding: 4,
    ...options,
  };
  const colXs = [];
  let accX = x;
  for (const col of columns) {
    colXs.push(accX);
    accX += col.width;
  }
  const tableWidth = columns.reduce((s, c) => s + c.width, 0);
  const startY = y;
  const headerY = startY;
  const rowStartY = headerY + opts.headerHeight;
  const totalHeight = opts.headerHeight + rows.length * opts.rowHeight;
  const endY = startY + totalHeight;

  // Header background
  doc.save();
  doc
    .fillColor(opts.headerBg)
    .rect(x, headerY, tableWidth, opts.headerHeight)
    .fill();
  doc.restore();

  // Outer border
  doc.save();
  doc.lineWidth(0.8).strokeColor(opts.borderColor);
  doc.rect(x, startY, tableWidth, totalHeight).stroke();
  doc.restore();

  // Vertical dividers
  doc.save();
  doc.lineWidth(0.5).strokeColor(opts.borderColor);
  for (let i = 1; i < columns.length; i += 1) {
    const vx = x + columns.slice(0, i).reduce((s, c) => s + c.width, 0);
    doc.moveTo(vx, startY).lineTo(vx, endY).stroke();
  }
  doc.restore();

  // Horizontal lines (row boundaries)
  doc.save();
  doc.lineWidth(0.5).strokeColor(opts.borderColor);
  for (let r = 0; r <= rows.length; r += 1) {
    const hy = rowStartY + r * opts.rowHeight;
    doc
      .moveTo(x, hy)
      .lineTo(x + tableWidth, hy)
      .stroke();
  }
  doc.restore();

  // Zebra stripes
  if (opts.zebra) {
    doc.save();
    doc.fillColor('#FCFCFD');
    for (let r = 0; r < rows.length; r += 2) {
      const zy = rowStartY + r * opts.rowHeight;
      doc.rect(x, zy, tableWidth, opts.rowHeight).fill();
    }
    doc.restore();
  }

  // Header text
  doc.save();
  doc
    .fillColor(opts.headerText.color)
    .font(opts.headerText.font)
    .fontSize(opts.headerText.size);
  for (let i = 0; i < columns.length; i += 1) {
    const col = columns[i];
    const cx = colXs[i] + opts.hPadding;
    const cw = col.width - opts.hPadding * 2;
    doc.text(
      col.label || '',
      cx,
      headerY + (opts.headerHeight - opts.headerText.size - 2) / 2,
      {
        width: cw,
        align: col.headerAlign || col.align || 'left',
        ellipsis: true,
      }
    );
  }
  doc.restore();

  // Rows
  doc.save();
  doc.fillColor(opts.text.color).font(opts.text.font).fontSize(opts.text.size);
  for (let r = 0; r < rows.length; r += 1) {
    const row = rows[r] || {};
    for (let i = 0; i < columns.length; i += 1) {
      const col = columns[i];
      const cw = col.width - opts.hPadding * 2;
      const cx = colXs[i] + opts.hPadding;
      const cy =
        rowStartY +
        r * opts.rowHeight +
        (opts.rowHeight - opts.text.size - 2) / 2;
      const raw = row[col.key] ?? '';
      const t = truncateToFit(doc, raw, cw, {
        font: opts.text.font,
        size: opts.text.size,
      });
      doc.text(t, cx, cy, {
        width: cw,
        align: col.align || 'left',
        ellipsis: true,
      });
    }
  }
  doc.restore();

  return endY;
}

async function exportPlayersPdf(matchId, teamId, actorId) {
  // Authorization and data retrieval are delegated to lineupService
  const data = await lineupService.list(matchId, actorId);
  if (teamId !== data.team1_id && teamId !== data.team2_id) {
    const err = new Error('team_not_in_match');
    err.code = 400;
    throw err;
  }
  const meta = await getMatchMeta(matchId);
  const isHome = teamId === data.team1_id;
  const pool = isHome ? data.home.players : data.away.players;
  const selected = pool.filter((p) => p.selected);
  const hasCaptain = selected.some((p) => p.is_captain);
  if (!hasCaptain) {
    const err = new Error('captain_required');
    err.code = 400;
    throw err;
  }
  // Enforce limits: for single protocol only — max 2 goalkeepers and max 20 field players
  const isGKByName = (p) =>
    (p.match_role?.name || p.role?.name || '').toLowerCase() === 'вратарь';
  const gkCount = selected.filter((p) =>
    typeof p.is_gk === 'boolean' ? p.is_gk : isGKByName(p)
  ).length;
  const fieldCount = selected.length - gkCount;
  if (!meta.double) {
    if (gkCount > 2) {
      const err = new Error('too_many_goalkeepers');
      err.code = 400;
      throw err;
    }
    if (fieldCount > 20) {
      const err = new Error('too_many_field_players');
      err.code = 400;
      throw err;
    }
  }
  // Enforce lower bounds before rendering: at least 1 GK, 5 field players and head coach selected
  const { default: matchStaffService } = await import('./matchStaffService.js');
  const staffDataEarly = await matchStaffService.list(matchId, actorId);
  const staffPoolEarly =
    (isHome ? staffDataEarly.home.staff : staffDataEarly.away.staff) || [];
  const selectedStaffEarly = staffPoolEarly.filter((s) => s.selected);
  if (!meta.double) {
    if (gkCount < 1) {
      const err = new Error('too_few_goalkeepers');
      err.code = 400;
      throw err;
    }
    if (fieldCount < 5) {
      const err = new Error('too_few_field_players');
      err.code = 400;
      throw err;
    }
  }
  // Require explicit match numbers for all selected players (no fallback to club numbers)
  const missingNumbers = selected.filter((p) => p.match_number == null).length;
  if (missingNumbers > 0) {
    const err = new Error('match_number_required');
    err.code = 400;
    throw err;
  }
  const hasHeadCoachEarly = selectedStaffEarly.some(
    (s) => (s.match_role?.name || '').toLowerCase() === 'главный тренер'
  );
  if (!hasHeadCoachEarly) {
    const err = new Error('head_coach_required');
    err.code = 400;
    throw err;
  }
  // Enforce unique match numbers on export (single protocol)
  {
    const seen = new Set();
    for (const p of selected) {
      const n = p.match_number;
      if (n == null) continue; // handled above
      const key = String(n);
      if (seen.has(key)) {
        const err = new Error('duplicate_match_numbers');
        err.code = 400;
        throw err;
      }
      seen.add(key);
    }
  }
  // Sort: GK first, then by number ASC
  const isGK = (p) =>
    (p.match_role?.name || p.role?.name || '').toLowerCase() === 'вратарь';
  const numVal = (p) => {
    const v = p.match_number ?? p.number;
    return Number.isFinite(v) ? v : 999;
  };
  selected.sort((a, b) => {
    if (isGK(a) && !isGK(b)) return -1;
    if (!isGK(a) && isGK(b)) return 1;
    return numVal(a) - numVal(b);
  });
  // Branch rendering depending on protocol type
  if (!meta.double) {
    const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });
    const { regular, bold } = applyFonts(doc);
    applyFirstPageHeader(doc);

    // Start content with a consistent offset from header
    const headerBottom = 30 /* margin */ + 32 /* logo height */ + 16; // match utils/pdf.js
    doc.y = Math.max(doc.y, headerBottom);

    // Title
    doc
      .font(bold)
      .fontSize(16)
      .text('Заявочный лист на матч', { align: 'center' });
    doc.moveDown(0.4);

    // Meta block with brand style (background + border)
    const left = doc.page.margins.left;
    const right = doc.page.margins.right;
    const boxX = left;
    const boxW = doc.page.width - left - right;
    const {
      padX,
      padY,
      borderWidth,
      borderColor,
      radius,
      background,
      primaryColor,
      primarySize,
      secondarySize,
    } = PDF_STYLE.infoBox;
    // Slightly increase horizontal inset inside the box
    const insetX = padX + 2;
    const textX = boxX + insetX;
    const innerW = boxW - insetX * 2;
    // Ultra-compact gaps
    const lineGap = 2;
    const boxStartY = doc.y;
    // Prepare lines without textual prefixes; we will render icons instead
    const teamLine = isHome
      ? data.team1_name || meta.homeName
      : data.team2_name || meta.awayName;
    const compLine = meta.tournament || meta.competition || '';
    // match and date values are handwritten below (no text here)
    const iconSize = 10;
    const iconGap = 6;
    const textAvailW = innerW - iconSize - iconGap;
    // Measure heights: team + competition (text), then lines for match/date
    // Measure with regular font for consistent spacing (no bold)
    doc.font(regular).fontSize(primarySize);
    const hTeam = doc.heightOfString(teamLine, { width: textAvailW });
    const hComp = doc.heightOfString(compLine, { width: textAvailW });
    // Handwriting lines: compact yet comfortable (single line)
    const lineH = Math.max(20, secondarySize + 8);
    // Slightly larger top/bottom padding for better breathing room
    const padTop = Math.max(padY, 6);
    const padBottom = 6;
    const boxH = padTop + hTeam + 2 + hComp + lineGap + lineH + padBottom;
    // Draw background + border
    doc.save();
    doc.lineWidth(borderWidth).strokeColor(borderColor).fillColor(background);
    doc.roundedRect(boxX, boxStartY, boxW, boxH, radius).fillAndStroke();
    doc.restore();
    // Render with small inline icons
    let textY = boxStartY + padTop;
    const drawIcon = (kind, ix, iy, sz) => {
      const g = '#98A2B3';
      doc.save().lineWidth(1).strokeColor(g);
      if (kind === 'team') {
        doc.circle(ix + sz * 0.4, iy + sz * 0.6, sz * 0.25).stroke();
        doc.circle(ix + sz * 0.75, iy + sz * 0.45, sz * 0.2).stroke();
      } else if (kind === 'trophy') {
        doc.rect(ix + sz * 0.1, iy, sz * 0.8, sz * 0.25).stroke();
        doc
          .moveTo(ix + sz * 0.15, iy + sz * 0.25)
          .lineTo(ix + sz * 0.5, iy + sz * 0.7)
          .lineTo(ix + sz * 0.85, iy + sz * 0.25)
          .stroke();
        doc.rect(ix + sz * 0.35, iy + sz * 0.75, sz * 0.3, sz * 0.2).stroke();
      } else if (kind === 'match') {
        doc.circle(ix + sz * 0.25, iy + sz * 0.5, sz * 0.18).stroke();
        doc.circle(ix + sz * 0.75, iy + sz * 0.5, sz * 0.18).stroke();
        doc
          .moveTo(ix + sz * 0.35, iy + sz * 0.5)
          .lineTo(ix + sz * 0.65, iy + sz * 0.5)
          .stroke();
      } else if (kind === 'calendar') {
        doc.rect(ix, iy + sz * 0.1, sz, sz * 0.8).stroke();
        doc
          .moveTo(ix, iy + sz * 0.25)
          .lineTo(ix + sz, iy + sz * 0.25)
          .stroke();
        doc.rect(ix + sz * 0.2, iy + sz * 0.45, sz * 0.2, sz * 0.2).stroke();
        doc.rect(ix + sz * 0.6, iy + sz * 0.45, sz * 0.2, sz * 0.2).stroke();
      }
      doc.restore();
    };
    const renderLine = (icon, content, fontFam, size, color) => {
      drawIcon(icon, textX, textY + 1, iconSize);
      doc.font(fontFam).fontSize(size).fillColor(color);
      doc.text(content, textX + iconSize + iconGap, textY, {
        width: innerW - iconSize - iconGap,
      });
      textY = doc.y + lineGap;
    };
    renderLine('team', teamLine, regular, primarySize, primaryColor);
    renderLine('trophy', compLine, regular, primarySize, primaryColor);
    // One compact labeled handwriting line: "Матч и дата: ________"
    const drawLabeledLine = (icon, label) => {
      drawIcon(icon, textX, textY + 1, iconSize);
      const tx = textX + iconSize + iconGap;
      const tw = innerW - iconSize - iconGap;
      // Compute baseline for handwriting row
      const ly = textY + Math.floor(lineH / 2);
      // Regular label (no bold), same style as the other primary lines
      doc.font(regular).fontSize(primarySize).fillColor(primaryColor);
      const lw = Math.min(doc.widthOfString(label), Math.max(60, tw * 0.4));
      // Place label so its baseline aligns to handwriting line (slightly raised)
      const baselineAdjust = 1;
      const labelY = ly - primarySize + baselineAdjust;
      doc.text(label, tx, labelY, { width: lw, lineBreak: false });
      const gap = 8;
      const lineStart = tx + lw + gap;
      const lineEnd = tx + tw;
      const lineY = ly + 1; // slightly lower handwriting line
      doc
        .save()
        .lineWidth(1)
        .strokeColor('#D0D5DD')
        .moveTo(lineStart, lineY)
        .lineTo(lineEnd, lineY)
        .stroke()
        .restore();
      textY += lineH;
    };
    drawLabeledLine('calendar', 'Матч и дата');
    // Move cursor below box and caption
    doc.y = boxStartY + boxH;
    doc.fillColor('#000000');
    doc.moveDown(0.6);
    // Section heading: players
    doc
      .font(bold)
      .fontSize(12)
      .fillColor('#000000')
      .text('Игроки', left, doc.y);
    doc.moveDown(0.4);

    // Prepare rows (single-line values)
    let rows = selected.map((p) => ({
      n: (p.match_number ?? '').toString(),
      fio: p.full_name || '',
      role: p.match_role?.name || p.role?.name || '',
      dob: p.date_of_birth
        ? new Date(p.date_of_birth).toLocaleDateString('ru-RU')
        : '',
    }));
    // Pad up to 22 rows
    if (rows.length < 22) {
      rows = rows.concat(
        Array.from({ length: 22 - rows.length }, () => ({
          n: '',
          fio: '',
          role: '',
          dob: '',
        }))
      );
    }

    // Columns width must equal info box width
    const wN = 40;
    const wRole = 120;
    const wDob = 100;
    const wFio = Math.max(120, boxW - (wN + wRole + wDob));
    const playerCols = [
      {
        key: 'n',
        label: '№',
        width: wN,
        align: 'center',
        headerAlign: 'center',
      },
      {
        key: 'fio',
        label: 'ФИО',
        width: wFio,
        align: 'left',
        headerAlign: 'center',
      },
      {
        key: 'role',
        label: 'Амплуа',
        width: wRole,
        align: 'center',
        headerAlign: 'center',
      },
      {
        key: 'dob',
        label: 'Дата рождения',
        width: wDob,
        align: 'center',
        headerAlign: 'center',
      },
    ];
    const tableY = doc.y;
    const endPlayersY = drawTable(
      doc,
      { x: left, y: tableY, columns: playerCols, rows },
      {
        text: { font: regular, size: 9, color: '#000000' },
        headerText: { font: bold, size: 9, color: '#000000' },
        zebra: false,
      }
    );
    // Overlay captain/assistant markers inside FIO cell, right-aligned
    try {
      doc.save();
      const headerHeight = 18;
      const rowHeight = 16;
      const hPadding = 4;
      const textSize = 9;
      // compute column x positions
      const colXs = [];
      let acc = left;
      for (const c of playerCols) {
        colXs.push(acc);
        acc += c.width;
      }
      const fioIdx = 1; // second column
      const cellLeft = colXs[fioIdx];
      const cellRight = cellLeft + playerCols[fioIdx].width;
      // markers per row (Cyrillic letters): 'К' for captain, 'А' for assistant
      const markers = rows.map((_, i) => {
        if (i >= selected.length) return '';
        const p = selected[i];
        if (p?.is_captain) return 'К';
        if (p?.assistant_order != null) return 'А';
        return '';
      });
      for (let r = 0; r < rows.length; r += 1) {
        const mk = markers[r];
        if (!mk) continue;
        const cy =
          tableY +
          headerHeight +
          r * rowHeight +
          (rowHeight - textSize - 2) / 2;
        doc.font(regular).fontSize(textSize).fillColor('#000000');
        const mw = doc.widthOfString(mk);
        const mx = Math.max(cellLeft + hPadding, cellRight - hPadding - mw);
        doc.text(mk, mx, cy, { lineBreak: false });
      }
      doc.restore();
    } catch {
      // ignore overlay errors
    }
    doc.y = endPlayersY;

    // Officials table directly under the players table
    doc.moveDown(0.6);
    doc
      .font(bold)
      .fontSize(12)
      .fillColor('#000000')
      .text('Официальные представители', left, doc.y);
    doc.moveDown(0.4);
    // We already loaded staff above for validation; use same lists here for consistency
    const staffPool = staffPoolEarly;
    const chosen = selectedStaffEarly;
    // Enforce max 8 officials when selected
    if (chosen.length > 8) {
      const err = new Error('too_many_officials');
      err.code = 400;
      throw err;
    }
    const repList = chosen.length ? chosen : staffPool;
    let repRows = repList.map((r) => ({
      fio: r.full_name,
      dob: r.date_of_birth
        ? new Date(r.date_of_birth).toLocaleDateString('ru-RU')
        : '',
      role: r.match_role?.name || r.role?.name || '',
    }));
    // Representatives table rows: default 6 rows, if more than 6 then up to 8 rows
    {
      const targetRows = repRows.length > 6 ? 8 : 6;
      if (repRows.length < targetRows) {
        repRows = repRows.concat(
          Array.from({ length: targetRows - repRows.length }, () => ({
            fio: '',
            dob: '',
            role: '',
          }))
        );
      } else if (repRows.length > targetRows) {
        repRows = repRows.slice(0, targetRows);
      }
    }
    const repRole = 120;
    const repDob = 100;
    const repFio = Math.max(160, boxW - (repRole + repDob));
    const repCols = [
      {
        key: 'fio',
        label: 'ФИО',
        width: repFio,
        align: 'left',
        headerAlign: 'center',
      },
      {
        key: 'role',
        label: 'Должность',
        width: repRole,
        align: 'center',
        headerAlign: 'center',
      },
      {
        key: 'dob',
        label: 'Дата рождения',
        width: repDob,
        align: 'center',
        headerAlign: 'center',
      },
    ];
    const endRepsY = drawTable(
      doc,
      { x: left, y: doc.y, columns: repCols, rows: repRows },
      {
        text: { font: regular, size: 9, color: '#000000' },
        headerText: { font: bold, size: 9, color: '#000000' },
        zebra: false,
      }
    );
    doc.y = endRepsY;

    // Signature line: "Подпись ____   Дата ____   Фамилия И.О." (ФИО показываем только если главный тренер заявлен)
    const headCoachShort = (() => {
      const selectedOnly = (staffPool || []).filter((s) => s.selected);
      const coach = selectedOnly.find(
        (s) => (s.match_role?.name || '').toLowerCase() === 'главный тренер'
      );
      if (!coach) return '';
      const parts = String(coach.full_name || '')
        .trim()
        .split(/\s+/);
      if (!parts.length) return '';
      const sur = parts[0] || '';
      const ini = parts
        .slice(1)
        .map((p) => (p ? `${p[0].toUpperCase()}.` : ''))
        .join(' ');
      return `${sur} ${ini}`.trim();
    })();
    doc.moveDown(0.9);
    const rowY = doc.y;
    const labelColor = '#666666';
    const lineColor = '#D0D5DD';
    const fs = 10;
    const micro = 8;
    const lineY = rowY + fs + 3;
    // Подпись — линия без метки сверху
    const sigLineX1 = left;
    const sigLineW = Math.min(160, Math.max(100, boxW * 0.28));
    doc
      .save()
      .lineWidth(1)
      .strokeColor(lineColor)
      .moveTo(sigLineX1, lineY)
      .lineTo(sigLineX1 + sigLineW, lineY)
      .stroke()
      .restore();
    // Микро‑подпись под линией (центрируем)
    try {
      doc.font('SB-Italic');
    } catch {
      doc.font(regular);
    }
    const sigCap = 'подпись';
    const sigCapW = doc.widthOfString(sigCap);
    const sigCapX = sigLineX1 + Math.max(0, (sigLineW - sigCapW) / 2);
    doc
      .fontSize(micro)
      .fillColor(labelColor)
      .text(sigCap, sigCapX, lineY + 2, { lineBreak: false });
    // Дата — линия справа от подписи
    const dateLineX1 = sigLineX1 + sigLineW + 24;
    const dateLineW = 90;
    doc
      .save()
      .lineWidth(1)
      .strokeColor(lineColor)
      .moveTo(dateLineX1, lineY)
      .lineTo(dateLineX1 + dateLineW, lineY)
      .stroke()
      .restore();
    // Микро‑подпись под линией даты (центрируем)
    try {
      doc.font('SB-Italic');
    } catch {
      doc.font(regular);
    }
    const dateCap = 'дата';
    const dateCapW = doc.widthOfString(dateCap);
    const dateCapX = dateLineX1 + Math.max(0, (dateLineW - dateCapW) / 2);
    doc
      .fontSize(micro)
      .fillColor(labelColor)
      .text(dateCap, dateCapX, lineY + 2, { lineBreak: false });
    // ФИО главного тренера — по центру отведённой области справа или линия для ручного ввода
    const nameX = dateLineX1 + dateLineW + 24;
    const nameW = Math.max(140, left + boxW - nameX);
    if (headCoachShort) {
      doc
        .font(regular)
        .fontSize(fs)
        .fillColor('#000000')
        .text(headCoachShort, nameX, rowY, {
          width: nameW,
          align: 'center',
          lineBreak: false,
        });
    } else {
      const ny = lineY;
      doc
        .save()
        .lineWidth(1)
        .strokeColor(lineColor)
        .moveTo(nameX, ny)
        .lineTo(nameX + nameW, ny)
        .stroke()
        .restore();
      try {
        doc.font('SB-Italic');
      } catch {
        doc.font(regular);
      }
      const coachCap = 'ФИО главного тренера';
      const coachCapW = doc.widthOfString(coachCap);
      const coachCapX = nameX + Math.max(0, (nameW - coachCapW) / 2);
      doc
        .fontSize(micro)
        .fillColor(labelColor)
        .text(coachCap, coachCapX, ny + 2, { lineBreak: false });
    }

    // Footer across pages
    const range = doc.bufferedPageRange();
    const total = range.count || 1;
    for (let i = range.start; i < range.start + total; i += 1) {
      doc.switchToPage(i);
      // barcodeText is the match UUID
      await applyFooter(doc, {
        page: i - range.start + 1,
        total,
        barcodeText: String(matchId),
        numberText: null,
      });
    }

    return new Promise((resolve, reject) => {
      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      doc.end();
    });
  } else {
    // Double protocol branch: render two pages (squads 1 and 2)
    const selectedAll = selected;
    // Validate squads assignment and per-squad bounds (GK:1–2, Field:12–13)
    if (
      selectedAll.some(
        (p) =>
          p.squad_no == null &&
          !(
            p.squad_both &&
            ((p.match_role?.name || p.role?.name || '').toLowerCase() ===
              'вратарь' ||
              p.is_gk === true)
          )
      )
    ) {
      const err = new Error('squad_number_required');
      err.code = 400;
      throw err;
    }
    const isGkName = (p) =>
      (p.match_role?.name || p.role?.name || '').toLowerCase() === 'вратарь';
    const includeInRoster = (p, rosterNo) => {
      if (
        p.squad_both &&
        (typeof p.is_gk === 'boolean' ? p.is_gk : isGkName(p))
      )
        return true;
      return p.squad_no === rosterNo;
    };
    const s1 = selectedAll.filter((p) => includeInRoster(p, 1));
    const s2 = selectedAll.filter((p) => includeInRoster(p, 2));
    const countGk = (arr) =>
      arr.filter((p) => (typeof p.is_gk === 'boolean' ? p.is_gk : isGkName(p)))
        .length;
    const c1gk = countGk(s1);
    const c2gk = countGk(s2);
    const c1field = s1.length - c1gk;
    const c2field = s2.length - c2gk;
    if (c1gk < 1 || c1gk > 2 || c2gk < 1 || c2gk > 2) {
      const err = new Error('too_few_or_many_goalkeepers');
      err.code = 400;
      throw err;
    }
    if (c1field < 12 || c1field > 13 || c2field < 12 || c2field > 13) {
      const err = new Error('invalid_field_players_for_double');
      err.code = 400;
      throw err;
    }
    if (!s1.some((p) => p.is_captain) || !s2.some((p) => p.is_captain)) {
      const err = new Error('captain_required');
      err.code = 400;
      throw err;
    }
    if (
      s1.some((p) => p.match_number == null) ||
      s2.some((p) => p.match_number == null)
    ) {
      const err = new Error('match_number_required');
      err.code = 400;
      throw err;
    }
    // Head coach: require exactly one overall (team), regardless of roster
    {
      const { default: matchStaffService } = await import(
        './matchStaffService.js'
      );
      const staffData = await matchStaffService.list(matchId, actorId);
      const staffPool =
        (isHome ? staffData.home.staff : staffData.away.staff) || [];
      const chosen = staffPool.filter((s) => s.selected);
      const isHead = (s) =>
        (s.match_role?.name || '').toLowerCase() === 'главный тренер';
      const isCoach = (s) =>
        (s.match_role?.name || s.role?.name || '')
          .toLowerCase()
          .includes('тренер');
      const coachesTotal = chosen.filter(isCoach).length;
      if (coachesTotal < 2) {
        const err = new Error('too_few_coaches');
        err.code = 400;
        throw err;
      }
      const total = chosen.filter(isHead).length;
      if (total === 0) {
        const err = new Error('head_coach_required');
        err.code = 400;
        throw err;
      }
      if (total > 1) {
        const err = new Error('too_many_head_coaches');
        err.code = 400;
        throw err;
      }
    }
    // Unique match numbers across the whole match (both squads combined)
    {
      const seen = new Set();
      for (const p of selectedAll) {
        const n = p.match_number;
        if (n == null) continue;
        const key = String(n);
        if (seen.has(key)) {
          const err = new Error('duplicate_match_numbers');
          err.code = 400;
          throw err;
        }
        seen.add(key);
      }
    }

    // Render two pages reusing the same layout
    const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });
    const renderOne = (players, rosterNo) => {
      // sort GK first then by number
      const isGK = (p) =>
        (p.match_role?.name || p.role?.name || '').toLowerCase() === 'вратарь';
      const numVal = (p) => {
        const v = p.match_number ?? p.number;
        return Number.isFinite(v) ? v : 999;
      };
      players.sort((a, b) => {
        if (isGK(a) && !isGK(b)) return -1;
        if (!isGK(a) && isGK(b)) return 1;
        return numVal(a) - numVal(b);
      });
      const { regular, bold } = applyFonts(doc);
      applyFirstPageHeader(doc);
      const headerBottom = 30 + 32 + 16;
      doc.y = Math.max(doc.y, headerBottom);
      const title = `Заявочный лист на матч — Состав №${rosterNo}`;
      doc.font(bold).fontSize(16).text(title, { align: 'center' });
      doc.moveDown(0.4);

      // Reuse the same content block as single variant by inlining variables
      const left = doc.page.margins.left;
      const right = doc.page.margins.right;
      const boxX = left;
      const boxW = doc.page.width - left - right;
      const {
        padX,
        padY,
        borderWidth,
        borderColor,
        radius,
        background,
        primaryColor,
        primarySize,
        secondarySize,
      } = PDF_STYLE.infoBox;
      const insetX = padX + 2;
      const textX = boxX + insetX;
      const innerW = boxW - insetX * 2;
      const lineGap = 2;
      const boxStartY = doc.y;
      const teamLine = isHome
        ? data.team1_name || meta.homeName
        : data.team2_name || meta.awayName;
      const compLine = meta.tournament || meta.competition || '';
      const iconSize = 10;
      const iconGap = 6;
      const textAvailW = innerW - iconSize - iconGap;
      doc.font(regular).fontSize(primarySize);
      const hTeam = doc.heightOfString(teamLine, { width: textAvailW });
      const hComp = doc.heightOfString(compLine, { width: textAvailW });
      const lineH = Math.max(20, secondarySize + 8);
      const padTop = Math.max(padY, 6);
      const padBottom = 6;
      const boxH = padTop + hTeam + 2 + hComp + lineGap + lineH + padBottom;
      doc.save();
      doc.lineWidth(borderWidth).strokeColor(borderColor).fillColor(background);
      doc.roundedRect(boxX, boxStartY, boxW, boxH, radius).fillAndStroke();
      doc.restore();
      let textY = boxStartY + padTop;
      const drawIcon = (kind, ix, iy, sz) => {
        const g = '#98A2B3';
        doc.save().lineWidth(1).strokeColor(g);
        if (kind === 'team') {
          doc.circle(ix + sz * 0.4, iy + sz * 0.6, sz * 0.25).stroke();
          doc.circle(ix + sz * 0.75, iy + sz * 0.45, sz * 0.2).stroke();
        } else if (kind === 'trophy') {
          doc.rect(ix + sz * 0.1, iy, sz * 0.8, sz * 0.25).stroke();
          doc
            .moveTo(ix + sz * 0.15, iy + sz * 0.25)
            .lineTo(ix + sz * 0.5, iy + sz * 0.7)
            .lineTo(ix + sz * 0.85, iy + sz * 0.25)
            .stroke();
          doc.rect(ix + sz * 0.35, iy + sz * 0.75, sz * 0.3, sz * 0.2).stroke();
        } else if (kind === 'match') {
          doc.circle(ix + sz * 0.25, iy + sz * 0.5, sz * 0.18).stroke();
          doc.circle(ix + sz * 0.75, iy + sz * 0.5, sz * 0.18).stroke();
          doc
            .moveTo(ix + sz * 0.35, iy + sz * 0.5)
            .lineTo(ix + sz * 0.65, iy + sz * 0.5)
            .stroke();
        } else if (kind === 'calendar') {
          doc.rect(ix, iy + sz * 0.1, sz, sz * 0.8).stroke();
          doc
            .moveTo(ix, iy + sz * 0.25)
            .lineTo(ix + sz, iy + sz * 0.25)
            .stroke();
          doc.rect(ix + sz * 0.2, iy + sz * 0.45, sz * 0.2, sz * 0.2).stroke();
          doc.rect(ix + sz * 0.6, iy + sz * 0.45, sz * 0.2, sz * 0.2).stroke();
        }
        doc.restore();
      };
      const renderLine = (icon, content, fontFam, size, color) => {
        drawIcon(icon, textX, textY + 1, iconSize);
        doc.font(fontFam).fontSize(size).fillColor(color);
        doc.text(content, textX + iconSize + iconGap, textY, {
          width: innerW - iconSize - iconGap,
        });
        textY = doc.y + lineGap;
      };
      renderLine('team', teamLine, regular, primarySize, primaryColor);
      renderLine('trophy', compLine, regular, primarySize, primaryColor);
      const drawLabeledLine = (icon, label) => {
        drawIcon(icon, textX, textY + 1, iconSize);
        const tx = textX + iconSize + iconGap;
        const tw = innerW - iconSize - iconGap;
        const ly = textY + Math.floor(lineH / 2);
        doc.font(regular).fontSize(primarySize).fillColor(primaryColor);
        const lw = Math.min(doc.widthOfString(label), Math.max(60, tw * 0.4));
        const labelY = ly - primarySize + 1;
        doc.text(label, tx, labelY, { width: lw, lineBreak: false });
        const gap = 8;
        const lineStart = tx + lw + gap;
        const lineEnd = tx + tw;
        doc
          .save()
          .lineWidth(1)
          .strokeColor('#D0D5DD')
          .moveTo(lineStart, ly + 1)
          .lineTo(lineEnd, ly + 1)
          .stroke()
          .restore();
        textY += lineH;
      };
      drawLabeledLine('calendar', 'Матч и дата');
      doc.y = boxStartY + boxH;
      doc.fillColor('#000000');
      doc.moveDown(0.6);
      // Section heading: players
      doc
        .font(bold)
        .fontSize(12)
        .fillColor('#000000')
        .text('Игроки', left, doc.y);
      doc.moveDown(0.4);
      // Players table — layout exactly like single protocol + extra blank column "Цвет звена"
      const wN = 40;
      const wRole = 120;
      const wDob = 100;
      const wLine = 60; // Цвет (handwritten), компактнее
      const wFio = Math.max(120, boxW - (wN + wRole + wDob + wLine));
      const columns = [
        {
          key: 'n',
          label: '№',
          width: wN,
          align: 'center',
          headerAlign: 'center',
        },
        {
          key: 'fio',
          label: 'ФИО',
          width: wFio,
          align: 'left',
          headerAlign: 'center',
        },
        {
          key: 'role',
          label: 'Амплуа',
          width: wRole,
          align: 'center',
          headerAlign: 'center',
        },
        {
          key: 'dob',
          label: 'Дата рождения',
          width: wDob,
          align: 'center',
          headerAlign: 'center',
        },
        {
          key: 'line',
          label: 'Цвет',
          width: wLine,
          align: 'center',
          headerAlign: 'center',
        },
      ];
      let rows = players.map((p) => ({
        n: (p.match_number ?? '').toString(),
        fio: p.full_name || '',
        role: p.match_role?.name || p.role?.name || '',
        dob: p.date_of_birth
          ? new Date(p.date_of_birth).toLocaleDateString('ru-RU')
          : '',
        line: '',
      }));
      // For double protocol — draw exactly 15 rows
      if (rows.length < 15) {
        rows = rows.concat(
          Array.from({ length: 15 - rows.length }, () => ({
            n: '',
            fio: '',
            role: '',
            dob: '',
            line: '',
          }))
        );
      } else if (rows.length > 15) {
        rows = rows.slice(0, 15);
      }
      const tableY = doc.y;
      const endPlayersY = drawTable(
        doc,
        { x: left, y: tableY, columns, rows },
        {
          text: { font: regular, size: 9, color: '#000000' },
          headerText: { font: bold, size: 9, color: '#000000' },
          zebra: false,
        }
      );
      // Overlay captain/assistant markers inside FIO cell, right-aligned (same as single)
      try {
        doc.save();
        const headerHeight = 18;
        const rowHeight = 16;
        const hPadding = 4;
        const textSize = 9;
        // compute column x positions
        const colXs = [];
        let acc = left;
        for (const c of columns) {
          colXs.push(acc);
          acc += c.width;
        }
        const fioIdx = 1; // second column
        const cellLeft = colXs[fioIdx];
        const cellRight = cellLeft + columns[fioIdx].width;
        const markers = rows.map((_, i) => {
          if (i >= players.length) return '';
          const p = players[i];
          if (p?.is_captain) return 'К';
          if (p?.assistant_order != null) return 'А';
          return '';
        });
        for (let r = 0; r < rows.length; r += 1) {
          const mk = markers[r];
          if (!mk) continue;
          const cy =
            tableY +
            headerHeight +
            r * rowHeight +
            (rowHeight - textSize - 2) / 2;
          doc.font(regular).fontSize(textSize).fillColor('#000000');
          const mw = doc.widthOfString(mk);
          const mx = Math.max(cellLeft + hPadding, cellRight - hPadding - mw);
          doc.text(mk, mx, cy, { lineBreak: false });
        }
        doc.restore();
      } catch {
        // ignore overlay errors
      }
      doc.y = endPlayersY;
      doc.y = endPlayersY;
      // Representatives table
      doc.moveDown(0.6);
      doc
        .font(bold)
        .fontSize(12)
        .fillColor('#000000')
        .text('Официальные представители', left, doc.y);
      doc.moveDown(0.4);
      const staffPool = staffPoolEarly;
      const chosen = selectedStaffEarly;
      if (chosen.length > 8) {
        const err = new Error('too_many_officials');
        err.code = 400;
        throw err;
      }
      // Representatives block: independent of squad — same list on both pages
      const repList = chosen.length ? chosen : staffPool;
      let repRows = repList.map((r) => ({
        fio: r.full_name,
        dob: r.date_of_birth
          ? new Date(r.date_of_birth).toLocaleDateString('ru-RU')
          : '',
        role: r.match_role?.name || r.role?.name || '',
      }));
      // Like single protocol: default 6 rows, if >6 then up to 8 rows
      {
        const targetRows = repRows.length > 6 ? 8 : 6;
        if (repRows.length < targetRows) {
          repRows = repRows.concat(
            Array.from({ length: targetRows - repRows.length }, () => ({
              fio: '',
              dob: '',
              role: '',
            }))
          );
        } else if (repRows.length > targetRows) {
          repRows = repRows.slice(0, targetRows);
        }
      }
      const repRole = 120;
      const repDob = 100;
      const repFio = Math.max(160, boxW - (repRole + repDob));
      const repCols = [
        {
          key: 'fio',
          label: 'ФИО',
          width: repFio,
          align: 'left',
          headerAlign: 'center',
        },
        {
          key: 'role',
          label: 'Должность',
          width: repRole,
          align: 'center',
          headerAlign: 'center',
        },
        {
          key: 'dob',
          label: 'Дата рождения',
          width: repDob,
          align: 'center',
          headerAlign: 'center',
        },
      ];
      const endRepsY = drawTable(
        doc,
        { x: left, y: doc.y, columns: repCols, rows: repRows },
        {
          text: { font: regular, size: 9, color: '#000000' },
          headerText: { font: bold, size: 9, color: '#000000' },
          zebra: false,
        }
      );
      doc.y = endRepsY;
      // Signature line
      const headCoachShort = (() => {
        const selectedOnly = (staffPool || []).filter((s) => s.selected);
        const coach = selectedOnly.find(
          (s) => (s.match_role?.name || '').toLowerCase() === 'главный тренер'
        );
        if (!coach) return '';
        const parts = String(coach.full_name || '')
          .trim()
          .split(/\s+/);
        if (!parts.length) return '';
        const sur = parts[0] || '';
        const ini = parts
          .slice(1)
          .map((p) => (p ? `${p[0].toUpperCase()}.` : ''))
          .join(' ');
        return `${sur} ${ini}`.trim();
      })();
      doc.moveDown(0.9);
      const rowY = doc.y;
      const labelColor = '#666666';
      const lineColor = '#D0D5DD';
      const fs = 10;
      const micro = 8;
      const lineY = rowY + fs + 3;
      const sigLineX1 = left;
      const sigLineW = Math.min(160, Math.max(100, boxW * 0.28));
      doc
        .save()
        .lineWidth(1)
        .strokeColor(lineColor)
        .moveTo(sigLineX1, lineY)
        .lineTo(sigLineX1 + sigLineW, lineY)
        .stroke()
        .restore();
      try {
        doc.font('SB-Italic');
      } catch {
        doc.font(regular);
      }
      const sigCap = 'подпись';
      const sigCapW = doc.widthOfString(sigCap);
      const sigCapX = sigLineX1 + Math.max(0, (sigLineW - sigCapW) / 2);
      doc
        .fontSize(micro)
        .fillColor(labelColor)
        .text(sigCap, sigCapX, lineY + 2, { lineBreak: false });
      const dateLineX1 = sigLineX1 + sigLineW + 24;
      const dateLineW = 90;
      doc
        .save()
        .lineWidth(1)
        .strokeColor(lineColor)
        .moveTo(dateLineX1, lineY)
        .lineTo(dateLineX1 + dateLineW, lineY)
        .stroke()
        .restore();
      try {
        doc.font('SB-Italic');
      } catch {
        doc.font(regular);
      }
      const dateCap = 'дата';
      const dateCapW = doc.widthOfString(dateCap);
      const dateCapX = dateLineX1 + Math.max(0, (dateLineW - dateCapW) / 2);
      doc
        .fontSize(micro)
        .fillColor(labelColor)
        .text(dateCap, dateCapX, lineY + 2, { lineBreak: false });
      const nameX = dateLineX1 + dateLineW + 24;
      const nameW = Math.max(140, left + boxW - nameX);
      if (headCoachShort) {
        doc
          .font(regular)
          .fontSize(fs)
          .fillColor('#000000')
          .text(headCoachShort, nameX, rowY, {
            width: nameW,
            align: 'center',
            lineBreak: false,
          });
      } else {
        const ny = lineY;
        doc
          .save()
          .lineWidth(1)
          .strokeColor(lineColor)
          .moveTo(nameX, ny)
          .lineTo(nameX + nameW, ny)
          .stroke()
          .restore();
        try {
          doc.font('SB-Italic');
        } catch {
          doc.font(regular);
        }
        const coachCap = 'ФИО главного тренера';
        const coachCapW = doc.widthOfString(coachCap);
        const coachCapX = nameX + Math.max(0, (nameW - coachCapW) / 2);
        doc
          .fontSize(micro)
          .fillColor(labelColor)
          .text(coachCap, coachCapX, ny + 2, { lineBreak: false });
      }
    };

    renderOne(s1.slice(), 1);
    doc.addPage();
    renderOne(s2.slice(), 2);
    // Footer across pages
    const range = doc.bufferedPageRange();
    const total = range.count || 1;
    for (let i = range.start; i < range.start + total; i += 1) {
      doc.switchToPage(i);
      await applyFooter(doc, {
        page: i - range.start + 1,
        total,
        barcodeText: String(matchId),
        numberText: null,
      });
    }
    return new Promise((resolve, reject) => {
      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      doc.end();
    });
  }
}

async function exportRepresentativesPdf(matchId, teamId, actorId) {
  const data = await lineupService.list(matchId, actorId);
  if (teamId !== data.team1_id && teamId !== data.team2_id) {
    const err = new Error('team_not_in_match');
    err.code = 400;
    throw err;
  }
  const meta = await getMatchMeta(matchId);
  // Prefer selected match staff (if any) else season staff
  const { default: matchStaffService } = await import('./matchStaffService.js');
  const staffData = await matchStaffService.list(matchId, actorId);
  const isHome = teamId === staffData.team1_id;
  const pool = (isHome ? staffData.home.staff : staffData.away.staff) || [];
  const selectedOnly = pool.filter((s) => s.selected);
  if (selectedOnly.length > 8) {
    const err = new Error('too_many_officials');
    err.code = 400;
    throw err;
  }
  const list = selectedOnly.length ? selectedOnly : pool;

  const doc = new PDFDocument({
    margin: 30,
    size: 'A4',
    layout: 'landscape',
    bufferPages: true,
  });
  const { regular, bold } = applyFonts(doc);
  applyFirstPageHeader(doc);
  // Offset from header
  const headerBottom2 = 30 + 32 + 16;
  doc.y = Math.max(doc.y, headerBottom2);
  // Title
  doc
    .font(bold)
    .fontSize(16)
    .text('Представители команды к матчу', { align: 'center' });
  doc.moveDown(0.4);
  // Meta box (brand style)
  const left2 = doc.page.margins.left;
  const right2 = doc.page.margins.right;
  const boxX2 = left2;
  const boxW2 = doc.page.width - left2 - right2;
  const {
    padX: padX2,
    padY: padY2,
    borderWidth: bw2,
    borderColor: bc2,
    radius: r2,
    background: bg2,
    primaryColor: pc2,
    primarySize: ps2,
    secondarySize: ss2,
  } = PDF_STYLE.infoBox;
  // Slightly increase horizontal inset inside the box
  const insetX2 = padX2 + 2;
  const textX2 = boxX2 + insetX2;
  const innerW2 = boxW2 - insetX2 * 2;
  // Consistent compact gaps (no artificial box growth)
  // Ultra-compact gaps
  const lineGap2 = 2;
  const boxStartY2 = doc.y;
  // Measure (no textual prefixes, with icon space)
  const teamLine2 =
    teamId === data.team1_id
      ? data.team1_name || meta.homeName
      : data.team2_name || meta.awayName;
  const compLine2 = meta.tournament || meta.competition || '';
  // match/date are handwritten lines below in this variant too
  const iconSize2 = 10;
  const iconGap2 = 6;
  const textAvailW2 = innerW2 - iconSize2 - iconGap2;
  // Measure with regular font for consistent spacing (no bold)
  doc.font(regular).fontSize(ps2);
  const hT2 = doc.heightOfString(teamLine2, { width: textAvailW2 });
  const hC2 = doc.heightOfString(compLine2, { width: textAvailW2 });
  doc.font(regular).fontSize(ss2);
  const lineH2 = Math.max(20, ss2 + 8);
  const padTop2 = Math.max(padY2, 6);
  const padBottom2 = 6;
  const boxH2 = padTop2 + hT2 + 2 + hC2 + lineGap2 + lineH2 + padBottom2;
  // Draw background + border
  doc.save();
  doc.lineWidth(bw2).strokeColor(bc2).fillColor(bg2);
  doc.roundedRect(boxX2, boxStartY2, boxW2, boxH2, r2).fillAndStroke();
  doc.restore();
  // Render text with icons
  let textY2 = boxStartY2 + padTop2;
  const drawIcon2 = (kind, ix, iy, sz) => {
    const g = '#98A2B3';
    doc.save().lineWidth(1).strokeColor(g);
    if (kind === 'team') {
      doc.circle(ix + sz * 0.4, iy + sz * 0.6, sz * 0.25).stroke();
      doc.circle(ix + sz * 0.75, iy + sz * 0.45, sz * 0.2).stroke();
    } else if (kind === 'trophy') {
      doc.rect(ix + sz * 0.1, iy, sz * 0.8, sz * 0.25).stroke();
      doc
        .moveTo(ix + sz * 0.15, iy + sz * 0.25)
        .lineTo(ix + sz * 0.5, iy + sz * 0.7)
        .lineTo(ix + sz * 0.85, iy + sz * 0.25)
        .stroke();
      doc.rect(ix + sz * 0.35, iy + sz * 0.75, sz * 0.3, sz * 0.2).stroke();
    } else if (kind === 'match') {
      doc.circle(ix + sz * 0.25, iy + sz * 0.5, sz * 0.18).stroke();
      doc.circle(ix + sz * 0.75, iy + sz * 0.5, sz * 0.18).stroke();
      doc
        .moveTo(ix + sz * 0.35, iy + sz * 0.5)
        .lineTo(ix + sz * 0.65, iy + sz * 0.5)
        .stroke();
    } else if (kind === 'calendar') {
      doc.rect(ix, iy + sz * 0.1, sz, sz * 0.8).stroke();
      doc
        .moveTo(ix, iy + sz * 0.25)
        .lineTo(ix + sz, iy + sz * 0.25)
        .stroke();
      doc.rect(ix + sz * 0.2, iy + sz * 0.45, sz * 0.2, sz * 0.2).stroke();
      doc.rect(ix + sz * 0.6, iy + sz * 0.45, sz * 0.2, sz * 0.2).stroke();
    }
    doc.restore();
  };
  const renderLine2 = (icon, content, fontFam, size, color) => {
    drawIcon2(icon, textX2, textY2 + 1, iconSize2);
    doc.font(fontFam).fontSize(size).fillColor(color);
    doc.text(content, textX2 + iconSize2 + iconGap2, textY2, {
      width: innerW2 - iconSize2 - iconGap2,
    });
    textY2 = doc.y + lineGap2;
  };
  renderLine2('team', teamLine2, regular, ps2, pc2);
  renderLine2('trophy', compLine2, regular, ps2, pc2);
  // One compact labeled handwriting line: "Матч и дата: ________"
  const drawLabeledLine2 = (icon, label) => {
    drawIcon2(icon, textX2, textY2 + 1, iconSize2);
    const tx = textX2 + iconSize2 + iconGap2;
    const tw = innerW2 - iconSize2 - iconGap2;
    // Compute baseline line position
    const ly = textY2 + Math.floor(lineH2 / 2);
    // Bold label, same style as primary lines (Команда/Соревнование)
    // Regular label (no bold), same style as other primary lines
    doc.font(regular).fontSize(ps2).fillColor(pc2);
    const lw = Math.min(doc.widthOfString(label), Math.max(60, tw * 0.4));
    const baselineAdjust = 1;
    const labelY = ly - ps2 + baselineAdjust;
    doc.text(label, tx, labelY, { width: lw, lineBreak: false });
    const gap = 8;
    const lineStart = tx + lw + gap;
    const lineEnd = tx + tw;
    doc
      .save()
      .lineWidth(1)
      .strokeColor('#D0D5DD')
      .moveTo(lineStart, ly + 1)
      .lineTo(lineEnd, ly + 1)
      .stroke()
      .restore();
    textY2 += lineH2;
  };
  drawLabeledLine2('calendar', 'Матч и дата');
  // Below box
  doc.y = boxStartY2 + boxH2;
  doc.fillColor('#000000');
  doc.moveDown(0.6);
  // Section heading
  doc
    .font(bold)
    .fontSize(12)
    .fillColor('#000000')
    .text('Официальные представители', left2, doc.y, { width: boxW2 });
  doc.moveDown(0.2);
  // Table with exactly 8 rows (pad blanks) — consistent with players sheet
  let rows = list.map((r) => ({
    fio: r.full_name,
    dob: r.date_of_birth
      ? new Date(r.date_of_birth).toLocaleDateString('ru-RU')
      : '',
    role: r.role?.name || '',
  }));
  // Representatives table rows: default 6 rows, if more than 6 then up to 8 rows
  {
    const targetRows2 = rows.length > 6 ? 8 : 6;
    if (rows.length < targetRows2)
      rows = rows.concat(
        Array.from({ length: targetRows2 - rows.length }, () => ({
          fio: '',
          dob: '',
          role: '',
        }))
      );
    if (rows.length > targetRows2) rows = rows.slice(0, targetRows2);
  }
  const repRole2 = 120;
  const repDob2 = 100;
  const repFio2 = Math.max(200, boxW2 - (repRole2 + repDob2));
  const repCols2 = [
    {
      key: 'fio',
      label: 'ФИО',
      width: repFio2,
      align: 'left',
      headerAlign: 'center',
    },
    {
      key: 'role',
      label: 'Должность',
      width: repRole2,
      align: 'center',
      headerAlign: 'center',
    },
    {
      key: 'dob',
      label: 'Дата рождения',
      width: repDob2,
      align: 'center',
      headerAlign: 'center',
    },
  ];
  drawTable(
    doc,
    { x: left2, y: doc.y, columns: repCols2, rows },
    {
      text: { font: regular, size: 9, color: '#000000' },
      headerText: { font: bold, size: 9, color: '#000000' },
      zebra: false,
    }
  );

  // Footer across pages (single page expected)
  const range2 = doc.bufferedPageRange();
  const total2 = range2.count || 1;
  for (let i = range2.start; i < range2.start + total2; i += 1) {
    doc.switchToPage(i);

    await applyFooter(doc, {
      page: i - range2.start + 1,
      total: total2,
      barcodeText: matchId,
      numberText: null,
    });
  }

  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}

export default { exportPlayersPdf, exportRepresentativesPdf };
