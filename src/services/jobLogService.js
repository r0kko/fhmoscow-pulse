import { v4 as uuidv4 } from 'uuid';

import JobLog from '../models/jobLog.js';

export async function createJobRun(job, message = null) {
  try {
    const row = await JobLog.create({
      id: uuidv4(),
      job,
      status: 'START',
      started_at: new Date(),
      message: message || null,
    });
    return row.id;
  } catch {
    return null;
  }
}

export async function finishJobRun(
  id,
  { status = 'SUCCESS', durationMs = null, message = null, error = null } = {}
) {
  if (!id) return;
  try {
    const fields = {
      status,
      finished_at: new Date(),
      duration_ms: durationMs,
    };
    if (message) fields.message = message;
    if (error) fields.error_message = String(error);
    await JobLog.update(fields, { where: { id } });
  } catch {
    /* ignore */
  }
}

export async function appendJobRun(
  id,
  { status = 'INFO', message = null } = {}
) {
  if (!id) return;
  try {
    await JobLog.update({ status, message }, { where: { id } });
  } catch {
    /* ignore */
  }
}

export default { createJobRun, finishJobRun, appendJobRun };
