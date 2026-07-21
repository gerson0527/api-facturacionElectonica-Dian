export function formatDecimalCol(value: number | string, decimals = 2): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "0".padEnd(decimals + 2, "0").replace(".", ",");
  return num.toFixed(decimals).replace(".", ",");
}

export function formatDateCol(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatTimeCol(date: Date): string {
  const h = String(date.getUTCHours()).padStart(2, "0");
  const mi = String(date.getUTCMinutes()).padStart(2, "0");
  const s = String(date.getUTCSeconds()).padStart(2, "0");
  return `${h}:${mi}:${s}-05:00`;
}

export function formatDateTimeCol(date: Date): string {
  return `${formatDateCol(date)}T${formatTimeCol(date)}`;
}