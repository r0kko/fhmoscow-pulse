export function calculateValidUntil(birthDate, issueDate) {
  if (!birthDate || !issueDate) return null;
  const birth = new Date(birthDate);
  const issue = new Date(issueDate);
  if (Number.isNaN(birth.getTime()) || Number.isNaN(issue.getTime()))
    return null;
  const age = (issue - birth) / (365.25 * 24 * 3600 * 1000);
  let until;
  if (age < 20) {
    until = new Date(birth);
    until.setFullYear(until.getFullYear() + 20);
  } else if (age < 45) {
    until = new Date(birth);
    until.setFullYear(until.getFullYear() + 45);
  } else {
    until = new Date(birth);
    until.setFullYear(until.getFullYear() + 100);
    return until.toISOString().slice(0, 10);
  }
  until.setDate(until.getDate() + 90);
  return until.toISOString().slice(0, 10);
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
