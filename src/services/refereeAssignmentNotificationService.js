import crypto from 'node:crypto';

import { Op } from 'sequelize';

import { utcToMoscow } from '../utils/time.js';
import { MatchRefereeNotification } from '../models/index.js';

import emailService from './emailService.js';

const CHANNEL_EMAIL = 'EMAIL';
const TYPE_PUBLISHED = 'ASSIGNMENT_PUBLISHED';
const TYPE_CANCELLED = 'ASSIGNMENT_CANCELLED';
const TYPE_SCHEDULE = 'ASSIGNMENT_SCHEDULE';

function assignmentKey(assignment) {
  if (!assignment) return null;
  const matchId = assignment.match_id || assignment.Match?.id;
  const roleId = assignment.referee_role_id || assignment.RefereeRole?.id;
  const userId = assignment.user_id || assignment.User?.id;
  if (!matchId || !roleId || !userId) return null;
  return `${matchId}:${roleId}:${userId}`;
}

function buildAssignmentMap(assignments = []) {
  const map = new Map();
  assignments.forEach((assignment) => {
    const key = assignmentKey(assignment);
    if (!key) return;
    if (!map.has(key)) map.set(key, assignment);
  });
  return map;
}

function diffAssignments(before = [], after = []) {
  const beforeMap = buildAssignmentMap(before);
  const afterMap = buildAssignmentMap(after);
  const added = [];
  const removed = [];
  for (const [key, row] of afterMap.entries()) {
    if (!beforeMap.has(key)) added.push(row);
  }
  for (const [key, row] of beforeMap.entries()) {
    if (!afterMap.has(key)) removed.push(row);
  }
  return { added, removed };
}

function formatMskDateTime(date) {
  if (!date) return { date: '—', time: '—', label: '—' };
  const msk = utcToMoscow(date);
  if (!msk) return { date: '—', time: '—', label: '—' };
  const dd = String(msk.getUTCDate()).padStart(2, '0');
  const mm = String(msk.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = msk.getUTCFullYear();
  const hh = String(msk.getUTCHours()).padStart(2, '0');
  const mi = String(msk.getUTCMinutes()).padStart(2, '0');
  const dateLabel = `${dd}.${mm}.${yyyy}`;
  const timeLabel = `${hh}:${mi}`;
  return { date: dateLabel, time: timeLabel, label: `${dateLabel}, ${timeLabel}` };
}

function moscowDateKey(date) {
  const msk = utcToMoscow(date);
  if (!msk) return null;
  return msk.toISOString().slice(0, 10);
}

function buildMatchMeta(match) {
  if (!match) return '';
  const tournament = match.Tournament?.name || match.Tournament?.full_name;
  const stage = match.Stage?.name;
  const group = match.TournamentGroup?.name;
  const tour = match.Tour?.name;
  return [tournament, stage, group, tour].filter(Boolean).join(' · ');
}

function buildGroundMeta(match) {
  const ground = match?.Ground?.name || '';
  const address =
    match?.Ground?.Address?.result || match?.Ground?.Address?.source || '';
  return { ground, address };
}

function buildAssignmentSnapshot(assignment) {
  const match = assignment.Match || null;
  const role = assignment.RefereeRole || null;
  const { label, time, date } = formatMskDateTime(match?.date_start);
  const sortTs = match?.date_start
    ? new Date(match.date_start).getTime()
    : null;
  const team1 = match?.HomeTeam?.name || '—';
  const team2 = match?.AwayTeam?.name || '—';
  const matchLabel = `${team1} — ${team2}`;
  const roleLabel = role?.name || 'Роль не указана';
  const roleGroup = role?.RefereeRoleGroup?.name || '';
  const meta = buildMatchMeta(match);
  const groundMeta = buildGroundMeta(match);
  return {
    match_id: match?.id || assignment.match_id || null,
    match_label: matchLabel,
    meta,
    datetime: label,
    time: time || '',
    date: date || '',
    role: roleGroup ? `${roleLabel} · ${roleGroup}` : roleLabel,
    ground: groundMeta.ground || '',
    address: groundMeta.address || '',
    sort_ts: Number.isFinite(sortTs) ? sortTs : null,
  };
}

function buildPayloadHash(source) {
  const base = String(source || '');
  return crypto.createHash('sha256').update(base).digest('hex');
}

function sortSnapshots(list = []) {
  return list.sort((a, b) => {
    const aTs = Number.isFinite(a.sort_ts) ? a.sort_ts : Number.MAX_SAFE_INTEGER;
    const bTs = Number.isFinite(b.sort_ts) ? b.sort_ts : Number.MAX_SAFE_INTEGER;
    if (aTs !== bTs) return aTs - bTs;
    const aLabel = a.match_label || '';
    const bLabel = b.match_label || '';
    return aLabel.localeCompare(bLabel, 'ru', { sensitivity: 'base' });
  });
}


export async function notifyRefereeAssignmentChanges({
  before = [],
  after = [],
  actorId = null,
} = {}) {
  const stats = {
    recipients: 0,
    queued: 0,
    failed: 0,
    published: 0,
    cancelled: 0,
    skipped_no_email: 0,
    skipped_duplicate: 0,
  };

  const { added, removed } = diffAssignments(before, after);
  if (!added.length && !removed.length) return stats;

  const affected = new Map();
  const registerChange = (assignment, type) => {
    const user = assignment?.User;
    if (!user?.id) return;
    if (!user.email) {
      stats.skipped_no_email += 1;
      return;
    }
    const matchDate = assignment.Match?.date_start || null;
    const dateKey = moscowDateKey(matchDate);
    if (!dateKey) return;
    const userId = assignment.user_id || user.id;
    const entryKey = `${userId}:${dateKey}`;
    if (!affected.has(entryKey)) {
      affected.set(entryKey, {
        user,
        userId,
        dateKey,
        published: [],
        cancelled: [],
        changeKeys: new Set(),
      });
    }
    const entry = affected.get(entryKey);
    const snapshot = buildAssignmentSnapshot(assignment);
    const changeKey =
      type === TYPE_PUBLISHED
        ? assignment.id || assignmentKey(assignment)
        : assignmentKey(assignment);
    if (type === TYPE_PUBLISHED) {
      entry.published.push(snapshot);
      stats.published += 1;
    } else {
      entry.cancelled.push(snapshot);
      stats.cancelled += 1;
    }
    if (changeKey) entry.changeKeys.add(`${type}:${changeKey}`);
  };

  added.forEach((assignment) => registerChange(assignment, TYPE_PUBLISHED));
  removed.forEach((assignment) => registerChange(assignment, TYPE_CANCELLED));

  stats.recipients = affected.size;

  if (!affected.size) return stats;

  const entries = Array.from(affected.values()).map((entry) => {
    sortSnapshots(entry.published);
    sortSnapshots(entry.cancelled);
    const changeKeys = Array.from(entry.changeKeys).sort();
    const hashSource = [
      TYPE_SCHEDULE,
      entry.userId,
      entry.dateKey,
      ...changeKeys,
    ].join('|');
    return {
      ...entry,
      changeKeys,
      payloadHash: buildPayloadHash(hashSource),
    };
  });

  const hashes = entries.map((entry) => entry.payloadHash).filter(Boolean);
  const existing =
    hashes.length > 0
      ? await MatchRefereeNotification.findAll({
          where: { payload_hash: { [Op.in]: hashes } },
          attributes: ['payload_hash'],
        })
      : [];
  const existingHashes = new Set(existing.map((row) => row.payload_hash));

  const pending = entries.filter((entry) => {
    if (!entry.payloadHash) return true;
    if (existingHashes.has(entry.payloadHash)) {
      stats.skipped_duplicate += 1;
      return false;
    }
    return true;
  });

  if (!pending.length) return stats;

  const rows = pending.map((entry) => ({
    match_referee_id: null,
    user_id: entry.userId,
    type: TYPE_SCHEDULE,
    channel: CHANNEL_EMAIL,
    payload_hash: entry.payloadHash,
    payload: {
      date: entry.dateKey,
      published: entry.published,
      cancelled: entry.cancelled,
      change_keys: entry.changeKeys,
    },
    created_by: actorId,
    updated_by: actorId,
  }));

  await MatchRefereeNotification.bulkCreate(rows, {
    returning: true,
    ignoreDuplicates: true,
  });

  for (const entry of pending) {
    const uniqueHashes = entry.payloadHash ? [entry.payloadHash] : [];
    try {
      await emailService.sendRefereeAssignmentsNotificationEmail(entry.user, {
        date: entry.dateKey,
        published: entry.published,
        cancelled: entry.cancelled,
        meta: { payloadHashes: uniqueHashes },
      });
      stats.queued += 1;
      if (uniqueHashes.length) {
        await MatchRefereeNotification.update(
          { sent_at: new Date(), updated_by: actorId },
          { where: { payload_hash: { [Op.in]: uniqueHashes } } }
        );
      }
    } catch (_err) {
      stats.failed += 1;
    }
  }

  return stats;
}

export default {
  notifyRefereeAssignmentChanges,
};
