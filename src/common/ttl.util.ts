export function parseTtl(ttl: string): number {
  const m = ttl.match(/^(\d+)([smhd])$/);
  if (!m) return 15 * 60 * 1000;
  const n = parseInt(m[1], 10);
  switch (m[2]) {
    case "s":
      return n * 1000;
    case "m":
      return n * 60 * 1000;
    case "h":
      return n * 60 * 60 * 1000;
    case "d":
      return n * 24 * 60 * 60 * 1000;
    default:
      return 15 * 60 * 1000;
  }
}
