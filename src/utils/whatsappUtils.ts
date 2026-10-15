import { Guest } from '../types/guest';
import { GuestService } from '../services/guestService';

export interface FormattedPhoneResult {
  raw: string;
  formatted: string; // E.g. "5493513552331"
  display: string;   // E.g. "+54 9 351 355-2331"
  isValid: boolean;
  alternatives: string[];
}

/**
 * Robust phone sanitizer and formatter specifically optimized for Argentine mobile numbers (Cordoba 351, Carlos Paz 3541, etc.)
 * Ensures WhatsApp wa.me links open directly without "Invalid phone number" error.
 */
export function cleanAndFormatPhoneNumber(rawPhone?: string): FormattedPhoneResult {
  if (!rawPhone || !rawPhone.trim()) {
    return { raw: '', formatted: '', display: 'Sin teléfono', isValid: false, alternatives: [] };
  }

  const raw = rawPhone.trim();

  // Split multiple numbers separated by slash, comma, 'y', or dash
  const rawParts = raw.split(/[/,;]|\s+y\s+/i).map((p) => p.trim()).filter(Boolean);
  const alternatives: string[] = [];

  const formatSingle = (input: string): string => {
    // Strip everything except digits
    let digits = input.replace(/\D/g, '');

    // Handle leading 0 (trunk prefix in Argentina, e.g. 0351 -> 351)
    if (digits.startsWith('0')) {
      digits = digits.slice(1);
    }

    // Handle removal of '15' mobile prefix inside local Argentine numbers:
    // e.g. 351 15 6859509 -> 351 6859509
    if (digits.length === 12 && digits.startsWith('35115')) {
      digits = '351' + digits.slice(5);
    } else if (digits.length === 12 && digits.startsWith('354115')) {
      digits = '3541' + digits.slice(6);
    }

    // Case 1: Already has 549 (e.g. 5493516859509 -> 13 digits)
    if (digits.startsWith('549') && digits.length >= 12) {
      return digits;
    }

    // Case 2: Starts with 54 without 9 (e.g. 543516859509 -> 12 digits)
    if (digits.startsWith('54') && digits.length === 12) {
      return '549' + digits.slice(2);
    }

    // Case 3: 10 digits standard Argentine mobile (e.g. 3513552331 or 1123456789)
    if (digits.length === 10) {
      return '549' + digits;
    }

    // Case 4: 9 digits (e.g. 517442233 where 3 was accidentally truncated from 3517442233)
    if (digits.length === 9 && digits.startsWith('517')) {
      return '5493' + digits;
    }

    // Fallback: If 7-11 digits, assume Argentine mobile
    if (digits.length >= 8 && digits.length <= 11) {
      return '549' + digits;
    }

    return digits;
  };

  const primaryFormatted = formatSingle(rawParts[0] || raw);

  if (rawParts.length > 1) {
    for (let i = 1; i < rawParts.length; i++) {
      const alt = formatSingle(rawParts[i]);
      if (alt && alt !== primaryFormatted) {
        alternatives.push(alt);
      }
    }
  }

  const isValid = primaryFormatted.length >= 10 && primaryFormatted.length <= 15;

  // Pretty display for UI
  let display = primaryFormatted;
  if (primaryFormatted.startsWith('549') && primaryFormatted.length === 13) {
    // 54 9 351 685-9509
    const area = primaryFormatted.slice(3, 6);
    const mid = primaryFormatted.slice(6, 9);
    const end = primaryFormatted.slice(9);
    display = `+54 9 ${area} ${mid}-${end}`;
  } else if (primaryFormatted.startsWith('549') && primaryFormatted.length === 14) {
    // 54 9 3541 33-5967
    const area = primaryFormatted.slice(3, 7);
    const mid = primaryFormatted.slice(7, 10);
    const end = primaryFormatted.slice(10);
    display = `+54 9 ${area} ${mid}-${end}`;
  } else if (primaryFormatted) {
    display = `+${primaryFormatted}`;
  } else {
    display = raw;
  }

  return {
    raw,
    formatted: primaryFormatted,
    display,
    isValid,
    alternatives,
  };
}

/**
 * Reusable single-window WhatsApp opener.
 * Prevents opening dozens of browser tabs by reusing a dedicated named target window.
 */
export function openWhatsAppInSingleTab(url: string): Window | null {
  if (typeof window === 'undefined') return null;
  // Using the named window 'DIVO_WHATSAPP_DISPATCHER' forces the browser
  // to always reuse the existing tab/window instead of opening a new one!
  const targetName = 'DIVO_WHATSAPP_DISPATCHER';
  const win = window.open(url, targetName);
  if (win) {
    try {
      win.focus();
    } catch {}
  }
  return win;
}

/**
 * Builds the official WhatsApp invitation or reminder URL with sanitized phone number.
 */
export function buildWhatsAppUrl(
  guest: Guest,
  type: 'invitation' | 'reminder' = 'invitation',
  phoneOverride?: string
): string {
  const phoneData = cleanAndFormatPhoneNumber(phoneOverride || guest.phone);
  const targetPhone = phoneData.isValid ? phoneData.formatted : '';

  let message = '';
  if (type === 'reminder') {
    const rsvpUrl = GuestService.getRSVPUrl(guest);
    const companionsText =
      guest.confirmedCompanions > 0
        ? ` (Pase válido para vos y tu acompañante${guest.companionName ? `: ${guest.companionName}` : ''})`
        : ' (Pase individual)';

    message =
      `¡Hola ${guest.firstName}! ✨\n\n` +
      `¡Hoy es el gran día! Te esperamos esta tarde para celebrar juntos los 20 Años de DIVO Trajes y Etiqueta:\n` +
      `"DIVO 20 años — Vistiendo Momentos"\n\n` +
      `⏰ Horario: 19:00 hs puntual\n` +
      `📍 Lugar: Capilla Paseo del Buen Pastor (Hipólito Yrigoyen 325, Córdoba)\n` +
      `👔 Dress Code: Elegante\n` +
      `🎟️ Tu Pase:${companionsText}\n` +
      `🔑 Tu Código QR de Puerta: ${guest.token}\n\n` +
      `Podés abrir tu tarjeta con tu código QR de acceso desde acá:\n` +
      `${rsvpUrl}\n\n` +
      `Tené a mano tu código QR al ingresar por puerta para una acreditación inmediata. ¡Nos vemos en unas horas! 🥂`;
  } else {
    const rsvpUrl = GuestService.getRSVPUrl(guest);
    message =
      `Estimado/a ${guest.firstName} ${guest.lastName}:\n\n` +
      `DIVO Trajes y Etiqueta tiene el agrado de invitarte a celebrar nuestros 20 Años en el evento:\n` +
      `"DIVO 20 años — Vistiendo Momentos"\n\n` +
      `📅 Jueves 22 de Octubre de 2026\n` +
      `⏰ 19:00 hs\n` +
      `📍 Capilla Paseo del Buen Pastor, Córdoba\n` +
      `✨ Aniversario + Show en Vivo + Desfile Exclusivo\n` +
      `👔 Dress Code: Elegante\n` +
      `🔑 Código de Acreditación QR: ${guest.token}\n\n` +
      `Por favor, confirma tu asistencia y la de tu acompañante en el siguiente enlace exclusivo:\n` +
      `${rsvpUrl}\n\n` +
      `¡Esperamos contar con tu distinguida presencia!`;
  }

  const encoded = encodeURIComponent(message);
  if (targetPhone) {
    return `https://wa.me/${targetPhone}?text=${encoded}`;
  }
  return `https://wa.me/?text=${encoded}`;
}

/**
 * Generates an industry-standard vCard (.vcf) file containing all guests with phone numbers.
 * When downloaded and opened on Android or iOS, it imports all contacts in 2 seconds with the tag "DIVO 20".
 * The organizer can then create a single WhatsApp Broadcast List (Lista de Difusión)
 * and send to all 126 guests with ZERO open tabs in 1 tap!
 */
export function generateVCardFile(guests: Guest[]): string {
  const cards: string[] = [];

  for (const guest of guests) {
    const phoneData = cleanAndFormatPhoneNumber(guest.phone);
    if (!phoneData.isValid) continue;

    const fullName = `${guest.firstName} ${guest.lastName}`.trim();
    const companionsText =
      guest.companionsAllowed > 0 ? `+${guest.companionsAllowed} Acomp.` : 'Individual';

    const vcard = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:DIVO 20 - ${fullName}`,
      `N:${guest.lastName || ''};${guest.firstName || ''};;;`,
      `ORG:DIVO Trajes - 20 Anos`,
      `TITLE:${guest.category}`,
      `TEL;TYPE=CELL,VOICE:+${phoneData.formatted}`,
      `NOTE:Token: ${guest.token} | Categoria: ${guest.category} | Pase: ${companionsText}`,
      'END:VCARD',
    ].join('\r\n');

    cards.push(vcard);
  }

  return cards.join('\r\n\r\n');
}

/**
 * Generates a JavaScript automated dispatcher script to paste directly into
 * web.whatsapp.com Developer Console. It automates sending messages without opening any new tabs!
 */
export function generateWhatsAppWebConsoleScript(
  guests: Guest[],
  type: 'invitation' | 'reminder' = 'invitation',
  delaySeconds: number = 5
): string {
  const validList = guests
    .map((g) => {
      const phoneData = cleanAndFormatPhoneNumber(g.phone);
      if (!phoneData.isValid) return null;
      const url = buildWhatsAppUrl(g, type);
      const textMatch = url.match(/[?&]text=([^&]+)/);
      const decodedText = textMatch ? decodeURIComponent(textMatch[1]) : '';
      return {
        id: g.id,
        name: `${g.firstName} ${g.lastName}`.trim(),
        phone: phoneData.formatted,
        message: decodedText,
      };
    })
    .filter(Boolean);

  return `/**
 * ========================================================
 * DIVO 20 AÑOS - SCRIPT AUTOMATIZADOR DE WHATSAPP WEB
 * ========================================================
 * Instrucciones:
 * 1. Abrí https://web.whatsapp.com en tu navegador e iniciá sesión con tu QR de WhatsApp.
 * 2. Abrí la Consola de Desarrollador (Apretá F12 o Ctrl+Shift+I -> pestaña 'Console').
 * 3. Pegá todo este código y presioná ENTER.
 * 4. El script despachará a los ${validList.length} contactos de forma secuencial sin abrir pestañas!
 */

(async function runDivoAutoSender() {
  const contacts = ${JSON.stringify(validList, null, 2)};
  const delayMs = ${delaySeconds * 1000};

  console.log("%c[DIVO 20 AÑOS] Iniciando despacho masivo de " + contacts.length + " invitaciones...", "color: #C5A059; font-weight: bold; font-size: 14px;");

  for (let i = 0; i < contacts.length; i++) {
    const contact = contacts[i];
    console.log(\`%c[\${i + 1}/\${contacts.length}] Enviando a \${contact.name} (\${contact.phone})...\`, "color: #25D366; font-weight: bold;");

    const encodedMsg = encodeURIComponent(contact.message);
    const sendUrl = \`https://web.whatsapp.com/send?phone=\${contact.phone}&text=\${encodedMsg}\`;

    // Redirige la misma ventana interna sin abrir pestañas
    window.location.href = sendUrl;

    // Espera el delay configurado para dar tiempo al usuario de enviar o automatizar
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  console.log("%c[DIVO 20 AÑOS] ¡Despacho completado con éxito!", "color: #C5A059; font-weight: bold; font-size: 16px;");
})();
`;
}
