import { Patient, InventoryForecastItem } from '../types/pharmacy';
import { resolveGenericDrug } from '../data/drugDatabase';

export function formatPhoneForWhatsApp(rawPhone: string): string {
  if (!rawPhone) return '';
  let clean = String(rawPhone).replace(/[^0-9]/g, '');
  if (clean.startsWith('00')) clean = clean.substring(2);
  if (clean.startsWith('07') && clean.length === 11) {
    clean = '964' + clean.substring(1);
  } else if (clean.startsWith('7') && clean.length === 10) {
    clean = '964' + clean;
  }
  return clean;
}

export function formatYMD(dateInput?: string | Date | null): string {
  if (!dateInput) {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput.trim())) {
    return dateInput.trim();
  }
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function parseLocalDate(ymdStr?: string): Date {
  if (!ymdStr) return new Date();
  const parts = String(ymdStr).split('T')[0].split('-');
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    return new Date(year, month, day);
  }
  return new Date(ymdStr);
}

export function calculateDaysRemaining(lastDispenseDate: string, daysSupply: number): number {
  const lastDate = parseLocalDate(lastDispenseDate);
  const supply = Number(daysSupply) || 30;
  const nextDue = new Date(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate() + supply);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.ceil((nextDue.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function calculatePDC(patient: Patient): number {
  if (!patient.medications || patient.medications.length === 0) return 100;
  let totalDaysCovered = 0;
  let totalExpectedDays = 0;
  const now = Date.now();

  patient.medications.forEach(med => {
    const lastRefill = parseLocalDate(med.lastDispenseDate);
    const daysSupply = parseInt(String(med.daysSupply), 10) || 30;
    const daysSince = Math.max(1, Math.floor((now - lastRefill.getTime()) / (1000 * 60 * 60 * 24)));

    totalExpectedDays += daysSince;
    totalDaysCovered += Math.min(daysSupply, daysSince);
  });

  if (totalExpectedDays === 0) return 100;
  return Math.min(100, Math.round((totalDaysCovered / totalExpectedDays) * 100));
}

export function calculatePatientAge(dob?: string): number {
  if (!dob) return 0;
  const birth = parseLocalDate(dob);
  const diff = Date.now() - birth.getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25)));
}

export function executeUniversalSMS(rawPhone: string, messageText: string): void {
  const cleanPhone = rawPhone.replace(/[^0-9+]/g, '');

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(messageText).catch(() => {});
  }

  const isAndroid = /Android/i.test(navigator.userAgent);
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !('MSStream' in window);

  if (isAndroid) {
    const encodedBody = encodeURIComponent(messageText);
    const intentUrl = `intent://smsto:${cleanPhone}#Intent;scheme=smsto;action=android.intent.action.SENDTO;S.sms_body=${encodedBody};end`;

    const link = document.createElement('a');
    link.href = intentUrl;
    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => {
      window.location.href = `sms:${cleanPhone}?body=${encodedBody}`;
    }, 350);
  } else if (isIOS) {
    window.location.href = `sms:${cleanPhone}&body=${encodeURIComponent(messageText)}`;
  } else {
    window.location.href = `sms:${cleanPhone}?body=${encodeURIComponent(messageText)}`;
  }
}

export function generateThermalSlipText(patient: Patient, pharmacyName: string): string {
  const lines: string[] = [];
  lines.push('==================================================');
  lines.push(`       ${(pharmacyName || 'PHARMPULSE ENTERPRISE').toUpperCase()}`);
  lines.push('       CLINICAL PHARMACY POCKET DOSSIER');
  lines.push('==================================================');
  lines.push(`DATE:      ${new Date().toLocaleString()}`);
  lines.push(`PATIENT:   ${patient.name}`);
  lines.push(`PHONE:     ${patient.phone}`);
  lines.push(`AGE/SEX:   ${patient.age || '—'} Y / ${patient.gender || '—'}`);
  lines.push(`FAMILY:    ${patient.familyTag || 'N/A'}`);
  lines.push(`LOYALTY:   ⭐ ${patient.loyaltyPoints || 0} Points`);
  lines.push(`ALLERGIES: ${patient.allergies || 'NIL / NONE REPORTED'}`);
  lines.push('--------------------------------------------------');
  lines.push('ACTIVE CHRONIC REGIMEN:');
  if (patient.medications && patient.medications.length > 0) {
    patient.medications.forEach((m, idx) => {
      const remaining = calculateDaysRemaining(m.lastDispenseDate, m.daysSupply);
      const remText = remaining <= 0 ? 'DUE NOW' : `${remaining}d left`;
      lines.push(` ${idx + 1}. ${m.name.padEnd(24)} [${m.daysSupply}d] (${remText})`);
    });
  } else {
    lines.push(' NO ACTIVE MEDICATIONS RECORDED.');
  }
  lines.push('--------------------------------------------------');
  lines.push('LATEST CLINICAL VITALS:');
  if (patient.vitals && patient.vitals.length > 0) {
    const v = patient.vitals[0];
    lines.push(` BP: ${v.bp} mmHg | SUGAR: ${v.sugar} mg/dL`);
    if (v.misc) lines.push(` ${v.misc}`);
  } else {
    lines.push(' NO VITALS RECORDED.');
  }
  lines.push('--------------------------------------------------');
  lines.push('DISPENSED WITH CARE BY YOUR CLINICAL PHARMACIST');
  lines.push('PLEASE BRING THIS SLIP UPON YOUR NEXT REFILL');
  lines.push('==================================================');

  return lines.join('\n');
}

export function calculateInventoryDemand(patients: Patient[]): InventoryForecastItem[] {
  const active = patients.filter(p => !p.isArchived);
  const drugMap: Record<
    string,
    {
      drugName: string;
      genericClass: string;
      activePatientsCount: number;
      demand7Days: number;
      demand14Days: number;
      demand30Days: number;
      estimatedBoxesNeeded: number;
    }
  > = {};

  active.forEach(p => {
    (p.medications || []).forEach(m => {
      const key = m.name.toLowerCase().trim();
      const generic = resolveGenericDrug(m.name);
      const remaining = calculateDaysRemaining(m.lastDispenseDate, m.daysSupply);

      if (!drugMap[key]) {
        drugMap[key] = {
          drugName: m.name,
          genericClass: generic,
          activePatientsCount: 0,
          demand7Days: 0,
          demand14Days: 0,
          demand30Days: 0,
          estimatedBoxesNeeded: 0,
        };
      }

      drugMap[key].activePatientsCount += 1;

      // If refill is due within 7 days
      if (remaining <= 7) {
        drugMap[key].demand7Days += 1;
      }
      if (remaining <= 14) {
        drugMap[key].demand14Days += 1;
      }
      if (remaining <= 30) {
        drugMap[key].demand30Days += 1;
      }
    });
  });

  return Object.values(drugMap).map(item => {
    const estBoxes = Math.ceil(item.demand30Days * 1.15); // 15% buffer
    let status: 'critical' | 'warning' | 'stable' = 'stable';
    if (item.demand7Days >= 3) status = 'critical';
    else if (item.demand14Days >= 2) status = 'warning';

    return {
      ...item,
      estimatedBoxesNeeded: estBoxes,
      status,
    };
  }).sort((a, b) => b.demand7Days - a.demand7Days || b.demand30Days - a.demand30Days);
}

/**
 * Filters patient list by name, phone number (with digit normalization), ID, or family tag.
 */
export function filterPatientsByQuery(patients: Patient[], query: string): Patient[] {
  const q = (query || '').trim().toLowerCase();
  if (!q) return patients;

  const digitsOnly = q.replace(/\D/g, '');

  return patients.filter(patient => {
    if (patient.isArchived) return false;

    // Check patient name
    const nameMatch = (patient.name || '').toLowerCase().includes(q);

    // Check phone number (direct match or normalized digit matching)
    const phone = patient.phone || '';
    const phoneDigits = phone.replace(/\D/g, '');
    const phoneMatch =
      phone.toLowerCase().includes(q) ||
      (digitsOnly.length >= 2 && phoneDigits.includes(digitsOnly));

    // Check patient ID
    const idMatch = (patient.id || '').toLowerCase().includes(q);

    // Check family tag
    const familyMatch = !!patient.familyTag && patient.familyTag.toLowerCase().includes(q);

    return nameMatch || phoneMatch || idMatch || familyMatch;
  });
}

