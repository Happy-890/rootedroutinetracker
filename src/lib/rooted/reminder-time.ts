// Use the browser/device locale's default hour cycle instead of forcing AM/PM.
export function formatReminderTime(time: string, locale?: string) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return "Set time";
  const [hours, minutes] = time.split(":").map(Number);
  const date = new Date(2000, 0, 1, hours, minutes);
  return new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }).format(date);
}
