/**
 * Build & download an .ics calendar invite for a booking.
 * RFC 5545 compatible — works with Google Calendar, Apple, Outlook.
 */

interface IcsArgs {
  uid: string;
  title: string;
  description?: string;
  location?: string;
  /** Local date e.g. 2026-04-22 */
  date: Date;
  /** "HH:MM" 24h */
  startTime: string;
  /** "HH:MM" 24h */
  endTime: string;
  organizerName?: string;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Format as floating local time: YYYYMMDDTHHMMSS (no Z) */
function toIcsLocal(date: Date, time: string): string {
  const [h, m] = time.split(":").map(Number);
  const d = new Date(date);
  d.setHours(h, m, 0, 0);
  return (
    d.getFullYear().toString() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    "T" +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    "00"
  );
}

function escapeIcs(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

export function buildIcs(args: IcsArgs): string {
  const dtStart = toIcsLocal(args.date, args.startTime);
  const dtEnd = toIcsLocal(args.date, args.endTime);
  const dtStamp =
    new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//TaskHive//Booking//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${args.uid}@taskhive`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${escapeIcs(args.title)}`,
    args.description ? `DESCRIPTION:${escapeIcs(args.description)}` : "",
    args.location ? `LOCATION:${escapeIcs(args.location)}` : "",
    args.organizerName ? `ORGANIZER;CN=${escapeIcs(args.organizerName)}:mailto:noreply@taskhive.app` : "",
    "STATUS:CONFIRMED",
    "BEGIN:VALARM",
    "TRIGGER:-PT1H",
    "ACTION:DISPLAY",
    "DESCRIPTION:Reminder",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);

  return lines.join("\r\n");
}

/** Format as YYYYMMDDTHHMMSS for Google Calendar URL (floating local time) */
function toGcalLocal(date: Date, time: string): string {
  return toIcsLocal(date, time);
}

/**
 * Build a Google Calendar "create event" URL.
 * Opens in a new tab; user is signed in to their own Google account.
 */
export function buildGoogleCalendarUrl(args: Omit<IcsArgs, "uid" | "organizerName">): string {
  const dates = `${toGcalLocal(args.date, args.startTime)}/${toGcalLocal(args.date, args.endTime)}`;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: args.title,
    dates,
  });
  if (args.description) params.set("details", args.description);
  if (args.location) params.set("location", args.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function downloadIcs(filename: string, args: IcsArgs): void {
  const blob = new Blob([buildIcs(args)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".ics") ? filename : `${filename}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
