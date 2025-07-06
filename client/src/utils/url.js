export function withHttp(url) {
  if (!url) return url;
  return /^https?:\/\//i.test(url) ? url : `http://${url}`;
}
