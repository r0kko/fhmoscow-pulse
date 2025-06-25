export function calculateValidUntil(birthDate, issueDate) {
  if (!birthDate || !issueDate) return null;
  const birth = new Date(birthDate);
  const issue = new Date(issueDate);
  if (Number.isNaN(birth.getTime()) || Number.isNaN(issue.getTime())) return null;
  const age = (issue - birth) / (365.25 * 24 * 3600 * 1000);
  let until;
  if (age < 20) {
    until = new Date(birth);
    until.setFullYear(until.getFullYear() + 20);
  } else if (age < 45) {
    until = new Date(birth);
    until.setFullYear(until.getFullYear() + 45);
  } else {
    return null;
  }
  return until.toISOString().slice(0, 10);
}
