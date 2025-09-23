export function withHttp(url: string | null | undefined): string | null | undefined {
  if (!url) return url;
  return /^https?:\/\//i.test(url) ? url : `http://${url}`;
}
