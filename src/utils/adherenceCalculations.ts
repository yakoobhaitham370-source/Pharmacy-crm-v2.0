import { Medication, RefillRecord } from '../types/pharmacy';
import { parseLocalDate, formatYMD } from './pharmacyCalculations';

export type RefillAdherenceStatus =
  | 'on-time'         // Within grace period (-3 to +3 days)
  | 'minor-delay'     // 4 to 9 days late
  | 'moderate-gap'    // 10 to 20 days late
  | 'critical-gap'    // > 20 days late (severe discontinuation)
  | 'early';          // Refilled >= 4 days early

export interface TimelineRefillEvent {
  id: string;
  date: string;
  daysSupply: number;
  expectedDate: string; // date + daysSupply
  isCurrentLastDispense: boolean;
  // Interval to next recorded event (if next event exists)
  daysToNext?: number;
  gapDays?: number; // positive = late / gap; negative = early
  status?: RefillAdherenceStatus;
  statusLabelAr?: string;
  statusLabelEn?: string;
  note?: string;
}

export interface MedicationAdherenceAnalysis {
  events: TimelineRefillEvent[];
  totalRefillsCount: number;
  hasHistory: boolean;
  pdc: number; // 0 - 100%
  overallPattern: 'optimal' | 'mild-irregular' | 'severe-irregular' | 'early-overuse' | 'single-dispense';
  patternTitleAr: string;
  patternTitleEn: string;
  clinicalInsightAr: string;
  clinicalInsightEn: string;
  averageGapDays: number;
  maxGapDays: number;
  nextProjectedRefillDate: string;
  daysUntilNextRefill: number;
  isOverdueForRefill: boolean;
  overdueDays: number;
}

/**
 * Add days to a YYYY-MM-DD date string
 */
export function addDaysToYMD(ymdStr: string, days: number): string {
  const d = parseLocalDate(ymdStr);
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
  return formatYMD(next);
}

/**
 * Calculate difference in whole calendar days between two YYYY-MM-DD strings (b - a)
 */
export function diffDaysYMD(aStr: string, bStr: string): number {
  const a = parseLocalDate(aStr);
  const b = parseLocalDate(bStr);
  const diffTime = b.getTime() - a.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Normalizes all refill events and computes clinical adherence intervals
 */
export function analyzeMedicationAdherence(
  medication: Medication,
  currentDateYmd: string = formatYMD(new Date())
): MedicationAdherenceAnalysis {
  const rawList: { date: string; daysSupply: number; note?: string; id?: string }[] = [];

  // 1. Process medication.refillHistory
  if (Array.isArray(medication.refillHistory)) {
    medication.refillHistory.forEach((r, idx) => {
      if (typeof r === 'string' && r.trim()) {
        rawList.push({
          id: `hist-${idx}-${r}`,
          date: r.trim(),
          daysSupply: Number(medication.daysSupply) || 30,
        });
      } else if (r && typeof r === 'object' && r.date) {
        rawList.push({
          id: r.id || `hist-${idx}-${r.date}`,
          date: r.date.trim(),
          daysSupply: Number(r.daysSupply) || Number(medication.daysSupply) || 30,
          note: r.note,
        });
      }
    });
  }

  // 2. Include lastDispenseDate if valid
  const currentDispense = (medication.lastDispenseDate || '').trim();
  const currentSupply = Number(medication.daysSupply) || 30;

  if (currentDispense) {
    const existingIdx = rawList.findIndex(item => item.date === currentDispense);
    if (existingIdx === -1) {
      rawList.push({
        id: `current-${currentDispense}`,
        date: currentDispense,
        daysSupply: currentSupply,
      });
    } else {
      // Ensure daysSupply matches current if it's the current one
      rawList[existingIdx].daysSupply = currentSupply;
    }
  }

  // 3. Sort strictly chronologically ascending
  rawList.sort((a, b) => a.date.localeCompare(b.date));

  // Determine latest date in list
  const latestDateInList = rawList.length > 0 ? rawList[rawList.length - 1].date : currentDispense;

  // 4. Build timeline events with gap/adherence evaluation
  const events: TimelineRefillEvent[] = rawList.map((item, idx) => {
    const isCurrent = item.date === latestDateInList;
    const expected = addDaysToYMD(item.date, item.daysSupply);
    const nextItem = rawList[idx + 1];

    let daysToNext: number | undefined;
    let gapDays: number | undefined;
    let status: RefillAdherenceStatus | undefined;
    let statusLabelAr: string | undefined;
    let statusLabelEn: string | undefined;

    if (nextItem) {
      daysToNext = diffDaysYMD(item.date, nextItem.date);
      gapDays = daysToNext - item.daysSupply;

      if (gapDays <= -4) {
        status = 'early';
        statusLabelAr = `صرف مبكر (${Math.abs(gapDays)} يوم قبل الموعد)`;
        statusLabelEn = `Early refill (${Math.abs(gapDays)}d before end)`;
      } else if (gapDays >= -3 && gapDays <= 3) {
        status = 'on-time';
        statusLabelAr = 'في الموعد تماماً (التزام ممتاز)';
        statusLabelEn = 'On-schedule (optimal)';
      } else if (gapDays >= 4 && gapDays <= 9) {
        status = 'minor-delay';
        statusLabelAr = `تأخر بسيط (+${gapDays} يوم فجوة)`;
        statusLabelEn = `Minor delay (+${gapDays}d gap)`;
      } else if (gapDays >= 10 && gapDays <= 20) {
        status = 'moderate-gap';
        statusLabelAr = `فجوة تأخير واضحة (+${gapDays} يوم انقطاع)`;
        statusLabelEn = `Moderate gap (+${gapDays}d lapsed)`;
      } else {
        status = 'critical-gap';
        statusLabelAr = `انقطاع علاجي حاد (+${gapDays} يوم بلا دواء ⚠️)`;
        statusLabelEn = `Severe therapy gap (+${gapDays}d gap ⚠️)`;
      }
    }

    return {
      id: item.id || `ev-${idx}`,
      date: item.date,
      daysSupply: item.daysSupply,
      expectedDate: expected,
      isCurrentLastDispense: isCurrent,
      daysToNext,
      gapDays,
      status,
      statusLabelAr,
      statusLabelEn,
      note: item.note,
    };
  });

  // Next projected refill calculation based on latest event
  const lastEvent = events[events.length - 1];
  const nextProjectedRefillDate = lastEvent
    ? addDaysToYMD(lastEvent.date, lastEvent.daysSupply)
    : addDaysToYMD(currentDateYmd, 30);

  const daysUntilNextRefill = diffDaysYMD(currentDateYmd, nextProjectedRefillDate);
  const isOverdueForRefill = daysUntilNextRefill < 0;
  const overdueDays = isOverdueForRefill ? Math.abs(daysUntilNextRefill) : 0;

  // Adherence PDC calculation
  let pdc = 100;
  let averageGapDays = 0;
  let maxGapDays = 0;
  let totalGaps = 0;
  let gapCount = 0;

  if (events.length >= 2) {
    const firstDate = events[0].date;
    const finalExpectedDate = addDaysToYMD(lastEvent.date, lastEvent.daysSupply);
    // Observation window is from first refill to the latest of today or final expected
    const endDateForObs = currentDateYmd > finalExpectedDate ? currentDateYmd : finalExpectedDate;
    const totalObsDays = Math.max(1, diffDaysYMD(firstDate, endDateForObs));

    let coveredDays = 0;
    for (let i = 0; i < events.length; i++) {
      const ev = events[i];
      const nextEv = events[i + 1];
      if (nextEv) {
        const interval = diffDaysYMD(ev.date, nextEv.date);
        coveredDays += Math.min(ev.daysSupply, interval);
        if (ev.gapDays !== undefined && ev.gapDays > 0) {
          totalGaps += ev.gapDays;
          gapCount++;
          if (ev.gapDays > maxGapDays) maxGapDays = ev.gapDays;
        }
      } else {
        // Last event: days covered from last refill to either end of supply or today
        const daysSinceLast = Math.max(0, diffDaysYMD(ev.date, endDateForObs));
        coveredDays += Math.min(ev.daysSupply, daysSinceLast);
      }
    }

    pdc = Math.min(100, Math.max(0, Math.round((coveredDays / totalObsDays) * 100)));
    averageGapDays = gapCount > 0 ? Math.round(totalGaps / gapCount) : 0;
  } else if (events.length === 1 && isOverdueForRefill) {
    // Single dispense that is now overdue
    const daysSinceStart = diffDaysYMD(lastEvent.date, currentDateYmd);
    pdc = Math.min(100, Math.max(0, Math.round((lastEvent.daysSupply / daysSinceStart) * 100)));
    maxGapDays = overdueDays;
    averageGapDays = overdueDays;
  }

  // Determine overall clinical pattern
  let overallPattern: MedicationAdherenceAnalysis['overallPattern'] = 'optimal';
  let patternTitleAr = 'التزام دوائي مثالي ومنتظم';
  let patternTitleEn = 'Optimal & Regular Adherence';
  let clinicalInsightAr = 'المريض يلتزم بمواعيد صرف الدواء بدقة متناهية دون وجود فجوات انقطاع مؤثرة سريرياً.';
  let clinicalInsightEn = 'Patient adheres reliably to refills with no clinically significant gaps.';

  if (events.length <= 1) {
    overallPattern = 'single-dispense';
    patternTitleAr = isOverdueForRefill ? `تأخر عن موعد التكرار (+${overdueDays} يوم)` : 'صرف أولي مسجل';
    patternTitleEn = isOverdueForRefill ? `Overdue for refill (+${overdueDays}d)` : 'Initial Dispense';
    clinicalInsightAr = isOverdueForRefill
      ? `انتهت كمية الدواء المقررة وتأخر المريض عن التكرار بـ ${overdueDays} يوماً. يوصى بالتواصل الفوري لمنع مضاعفات انقطاع العلاج.`
      : 'يوجد صرف واحد فقط مسجل. أضف تواريخ الصرف السابقة أو تكرار الصرف القادم لمراقبة النمط الزمني للالتزام.';
    clinicalInsightEn = isOverdueForRefill
      ? `Supply ran out ${overdueDays} days ago. Contact patient to avoid therapy lapse.`
      : 'Only 1 dispense recorded. Add past refill dates to analyze longitudinal adherence.';
  } else if (maxGapDays > 14 || pdc < 75) {
    overallPattern = 'severe-irregular';
    patternTitleAr = `نمط غير منتظم (انقطاع علاجي حاد بـ +${maxGapDays} يوم)`;
    patternTitleEn = `Irregular Pattern (Severe Gap: +${maxGapDays}d)`;
    clinicalInsightAr = `⚠️ خطر سريري مرتفع: المريض يعاني من فجوات انقطاع دوائي متكررة بمعدل تغطية (${pdc}%). هذا النمط يعرض المريض لعدم استقرار ضغط الدم/السكر وتطور مضاعفات خطيرة. يُنصح بإجراء استشارة التزام دوائي والتحقق من الآثار الجانبية أو التكلفة أو نسيان الجرعات.`;
    clinicalInsightEn = `⚠️ High clinical risk: Patient has recurrent therapy lapses with PDC of ${pdc}%. Intervene to investigate barriers (side effects, cost, or forgetfulness).`;
  } else if (maxGapDays >= 4 || pdc < 85) {
    overallPattern = 'mild-irregular';
    patternTitleAr = `تأخر متقطع (متوسط فجوة +${averageGapDays} أيام)`;
    patternTitleEn = `Occasional Delays (Avg Gap: +${averageGapDays}d)`;
    clinicalInsightAr = `لوحظ تأخر متقطع في استلام العلاج بمتوسط (+${averageGapDays} أيام). يوصى بتفعيل رسائل التذكير التلقائية عبر WhatsApp قبل انتهاء الكمية بـ 3 أيام لتفادي تفاقم الفجوة.`;
    clinicalInsightEn = `Occasional late refills observed with average delay of +${averageGapDays} days. Schedule WhatsApp refill reminders 3 days ahead.`;
  } else {
    // Check if there are early refills
    const earlyCount = events.filter(e => e.status === 'early').length;
    if (earlyCount >= 2) {
      overallPattern = 'early-overuse';
      patternTitleAr = 'صرف مبكر متكرر (اشتباه زيادة جرعة أو تخزين)';
      patternTitleEn = 'Frequent Early Refills (Suspected Overuse/Hoarding)';
      clinicalInsightAr = 'المريض يطلب صرف وتكرار العلاج قبل انتهاء الكمية المقررة بعدة أيام في مناسبات متعددة. يرجى التحقق مما إذا كان المريض يضاعف الجرعة دون استشارة طبية أو يقوم بتخزين الدواء.';
      clinicalInsightEn = 'Patient refills several days early repeatedly. Verify if doses are being doubled or if medication is being stockpiled.';
    }
  }

  return {
    events,
    totalRefillsCount: events.length,
    hasHistory: events.length > 1,
    pdc,
    overallPattern,
    patternTitleAr,
    patternTitleEn,
    clinicalInsightAr,
    clinicalInsightEn,
    averageGapDays,
    maxGapDays,
    nextProjectedRefillDate,
    daysUntilNextRefill,
    isOverdueForRefill,
    overdueDays,
  };
}
