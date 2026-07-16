/**
 * Localized, human-friendly notification copy.
 * Supports interpolation with {{variable}} placeholders.
 *
 * Usage:
 *   const { title, message } = getNotificationCopy("booking_accepted", { providerName: "Acme", date: "Jun 4" });
 */

import type { NotificationType } from "@/lib/notifications";

export type Locale = "en" | "es";

type Template = { title: string; message: string };
type EventCopy = Record<Locale, Template>;

const TEMPLATES: Partial<Record<NotificationType, EventCopy>> = {
  booking_created: {
    en: {
      title: "Booking requested ✨",
      message: "Your booking with {{providerName}} for {{date}} has been sent. We'll let you know once it's confirmed.",
    },
    es: {
      title: "Reserva solicitada ✨",
      message: "Tu reserva con {{providerName}} para el {{date}} fue enviada. Te avisaremos cuando se confirme.",
    },
  },
  booking_accepted: {
    en: {
      title: "Booking accepted ✅",
      message: "{{providerName}} accepted your booking for {{date}}. Get ready!",
    },
    es: {
      title: "Reserva aceptada ✅",
      message: "{{providerName}} aceptó tu reserva para el {{date}}. ¡Prepárate!",
    },
  },
  booking_rejected: {
    en: {
      title: "Booking declined",
      message: "Unfortunately {{providerName}} can't take your booking on {{date}}. Try another pro or date.",
    },
    es: {
      title: "Reserva rechazada",
      message: "Lamentablemente {{providerName}} no puede aceptar tu reserva el {{date}}. Prueba con otro profesional o fecha.",
    },
  },
  booking_in_progress: {
    en: {
      title: "Service started 🔧",
      message: "{{providerName}} has started working on your service. Sit tight!",
    },
    es: {
      title: "Servicio iniciado 🔧",
      message: "{{providerName}} ha comenzado tu servicio. ¡Tranquilo, está en marcha!",
    },
  },
  provider_on_the_way: {
    en: {
      title: "Pro on the way 🚗",
      message: "{{providerName}} is heading to your location and should arrive shortly.",
    },
    es: {
      title: "Profesional en camino 🚗",
      message: "{{providerName}} se dirige a tu ubicación y llegará pronto.",
    },
  },
  booking_completed: {
    en: {
      title: "Service completed 🎉",
      message: 'Your "{{serviceName}}" booking is complete. We hope it went great — leave a review to help others!',
    },
    es: {
      title: "Servicio completado 🎉",
      message: 'Tu reserva de "{{serviceName}}" está completa. Esperamos que haya ido genial — ¡deja una reseña para ayudar a otros!',
    },
  },
  booking_cancelled: {
    en: {
      title: "Booking cancelled",
      message: 'Your booking for "{{serviceName}}" on {{date}} has been cancelled.{{reasonSuffix}}',
    },
    es: {
      title: "Reserva cancelada",
      message: 'Tu reserva de "{{serviceName}}" para el {{date}} fue cancelada.{{reasonSuffix}}',
    },
  },
  booking_rescheduled: {
    en: {
      title: "Booking rescheduled 🔄",
      message: "Your booking has been moved to {{date}} at {{time}}.",
    },
    es: {
      title: "Reserva reprogramada 🔄",
      message: "Tu reserva fue movida al {{date}} a las {{time}}.",
    },
  },
  payment_success: {
    en: {
      title: "Payment successful 💳",
      message: "Your payment of {{amount}} for {{description}} went through.",
    },
    es: {
      title: "Pago exitoso 💳",
      message: "Tu pago de {{amount}} por {{description}} se procesó correctamente.",
    },
  },
  payment_received: {
    en: {
      title: "Payment received 💰",
      message: "You received a payment of {{amount}} for {{description}}.",
    },
    es: {
      title: "Pago recibido 💰",
      message: "Recibiste un pago de {{amount}} por {{description}}.",
    },
  },
};

/** Detects the user's preferred locale from the browser. Falls back to "en". */
export function detectLocale(): Locale {
  if (typeof navigator === "undefined") return "en";
  const lang = (navigator.language || "en").toLowerCase();
  if (lang.startsWith("es")) return "es";
  return "en";
}

function interpolate(template: string, vars: Record<string, string | number | undefined>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const v = vars[key];
    return v === undefined || v === null ? "" : String(v);
  });
}

/**
 * Returns a localized title + message for a notification event.
 * If the event type has no template, returns null (caller should fall back to provided copy).
 */
export function getNotificationCopy(
  type: NotificationType,
  vars: Record<string, string | number | undefined> = {},
  locale: Locale = detectLocale()
): Template | null {
  const event = TEMPLATES[type];
  if (!event) return null;
  const tmpl = event[locale] ?? event.en;
  return {
    title: interpolate(tmpl.title, vars),
    message: interpolate(tmpl.message, vars),
  };
}
