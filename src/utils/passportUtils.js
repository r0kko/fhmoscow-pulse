export function calculateValidUntil(birthDate, issueDate) {
  if (!birthDate || !issueDate) return null;
  const birth = parseYmdUtc(birthDate);
  const issue = parseYmdUtc(issueDate);
  if (!birth || !issue) return null;

  const ageYears =
    (issue.getTime() - birth.getTime()) / (365.25 * 24 * 3600 * 1000);

  // Base renewal date is 20th, 45th, or 100th birthday — computed in UTC to avoid TZ drift.
  const until = new Date(
    Date.UTC(birth.getUTCFullYear(), birth.getUTCMonth(), birth.getUTCDate())
  );
  if (ageYears < 20) {
    until.setUTCFullYear(until.getUTCFullYear() + 20);
    until.setUTCDate(until.getUTCDate() + 90); // 90 days after 20th birthday
  } else if (ageYears < 45) {
    until.setUTCFullYear(until.getUTCFullYear() + 45);
    until.setUTCDate(until.getUTCDate() + 90); // 90 days after 45th birthday
  } else {
    until.setUTCFullYear(until.getUTCFullYear() + 100);
    // For 45+, valid until 100th birthday (no +90 days)
  }

  return until.toISOString().slice(0, 10);
}

function parseYmdUtc(s) {
  if (typeof s !== 'string') {
    const d = new Date(s);
    return Number.isNaN(d.getTime())
      ? null
      : new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  }
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]) - 1;
    const d = Number(m[3]);
    return new Date(Date.UTC(y, mo, d));
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

export function sanitizePassportData(data = {}) {
  const out = { ...data };
  if (out.series !== undefined) {
    out.series = String(out.series).replace(/\s+/g, '').trim();
  }
  if (out.number !== undefined) {
    out.number = String(out.number).replace(/\s+/g, '').trim();
  }
  if (out.issue_date !== undefined && out.issue_date !== null) {
    const d = new Date(out.issue_date);
    out.issue_date = Number.isNaN(d.getTime())
      ? String(out.issue_date).trim()
      : d.toISOString().slice(0, 10);
  }
  if (out.valid_until !== undefined && out.valid_until !== null) {
    const d = new Date(out.valid_until);
    out.valid_until = Number.isNaN(d.getTime())
      ? String(out.valid_until).trim()
      : d.toISOString().slice(0, 10);
  }
  if (out.issuing_authority !== undefined) {
    out.issuing_authority = String(out.issuing_authority).trim();
  }
  if (out.issuing_authority_code !== undefined) {
    out.issuing_authority_code = String(out.issuing_authority_code)
      .replace(/\s+/g, '')
      .trim();
  }
  if (out.place_of_birth !== undefined) {
    out.place_of_birth = String(out.place_of_birth).trim();
  }
  return out;
}
