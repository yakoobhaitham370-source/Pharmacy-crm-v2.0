import React, { useState, useMemo } from 'react';
import { BellRing, Calendar, Filter, Zap, Clock } from 'lucide-react';
import { Patient } from '../../types/pharmacy';
import { calculateDaysRemaining, formatYMD } from '../../utils/pharmacyCalculations';

interface TimelineViewProps {
  patients: Patient[];
  lang: 'ar' | 'en';
  onOpenRefillModal: (patientId: string, medIndex?: number) => void;
  onOpenPatientModal: (patientId: string) => void;
}

export const TimelineView: React.FC<TimelineViewProps> = ({
  patients,
  lang,
  onOpenRefillModal,
  onOpenPatientModal,
}) => {
  const [filterDays, setFilterDays] = useState<number>(30);

  const activePatients = useMemo(() => patients.filter(p => !p.isArchived), [patients]);

  const timelineItems = useMemo(() => {
    const list: {
      patient: Patient;
      medIndex: number;
      medName: string;
      daysSupply: number;
      lastDispenseDate: string;
      dueDate: Date;
      daysRemaining: number;
    }[] = [];

    activePatients.forEach(p => {
      (p.medications || []).forEach((m, idx) => {
        const daysRemaining = calculateDaysRemaining(m.lastDispenseDate, m.daysSupply);
        const lastDate = new Date(m.lastDispenseDate);
        const dueDate = new Date(
          lastDate.getFullYear(),
          lastDate.getMonth(),
          lastDate.getDate() + (m.daysSupply || 30)
        );

        if (daysRemaining <= filterDays) {
          list.push({
            patient: p,
            medIndex: idx,
            medName: m.name,
            daysSupply: m.daysSupply,
            lastDispenseDate: m.lastDispenseDate,
            dueDate,
            daysRemaining,
          });
        }
      });
    });

    list.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
    return list;
  }, [activePatients, filterDays]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-[#1f1f1f] light:bg-white border border-[#383838] light:border-neutral-200 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="font-extrabold text-lg text-white light:text-neutral-900 flex items-center gap-2">
              <BellRing className="w-5 h-5 text-rose-400" />
              <span>{lang === 'ar' ? 'جدول المواعيد والمراجعات الدوائية التفصيلي' : 'Refill Chronology Timeline'}</span>
            </div>
            <p className="text-xs text-neutral-400 light:text-neutral-500 mt-1">
              {lang === 'ar'
                ? 'عرض زمني تفصيلي لمواعيد نفاد كل صنف دوائي بدقة لكل مريض، لإتاحة صرف الصنف الفردي أو الحزمة الكاملة.'
                : 'Granular view of when each specific chronic medication expires across all patients.'}
            </p>
          </div>

          {/* Time range buttons */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-400 font-semibold">{lang === 'ar' ? 'المدى الزمني:' : 'Range:'}</span>
            {[
              { days: 3, labelAr: '3 أيام', labelEn: '3 Days' },
              { days: 7, labelAr: 'أسبوع', labelEn: '7 Days' },
              { days: 14, labelAr: 'أسبوعين', labelEn: '14 Days' },
              { days: 30, labelAr: 'شهر', labelEn: '30 Days' },
            ].map(r => (
              <button
                key={r.days}
                onClick={() => setFilterDays(r.days)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  filterDays === r.days
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    : 'bg-neutral-800 text-neutral-400 hover:text-white'
                }`}
              >
                {lang === 'ar' ? r.labelAr : r.labelEn}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Timeline Table */}
      <div className="bg-[#1f1f1f] light:bg-white border border-[#383838] light:border-neutral-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right dir-rtl text-xs">
            <thead className="bg-[#292929] light:bg-neutral-100 text-neutral-300 light:text-neutral-700 font-bold border-b border-[#383838]">
              <tr>
                <th className="py-3 px-4">{lang === 'ar' ? 'تاريخ الاستحقاق' : 'Due Date'}</th>
                <th className="py-3 px-4">{lang === 'ar' ? 'المريض' : 'Patient'}</th>
                <th className="py-3 px-4">{lang === 'ar' ? 'الدواء المستحق' : 'Due Medication'}</th>
                <th className="py-3 px-3">{lang === 'ar' ? 'آخر صرف والمدة' : 'Dispensed'}</th>
                <th className="py-3 px-3">{lang === 'ar' ? 'الكمية المتبقية' : 'Status'}</th>
                <th className="py-3 px-4 text-center">{lang === 'ar' ? 'إجراء الصرف' : 'Refill Action'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2e2e2e] light:divide-neutral-200 text-neutral-200 light:text-neutral-800">
              {timelineItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-neutral-400">
                    {lang === 'ar'
                      ? 'لا توجد أدوية مستحقة في النطاق الزمني المحدد.'
                      : 'No medications due in this time window.'}
                  </td>
                </tr>
              ) : (
                timelineItems.map((item, idx) => {
                  const isOverdue = item.daysRemaining < 0;
                  return (
                    <tr key={idx} className="hover:bg-neutral-800/40 light:hover:bg-neutral-50 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-white light:text-neutral-900">
                        {formatYMD(item.dueDate)}
                      </td>
                      <td className="py-3 px-4 font-bold text-white light:text-neutral-900">
                        <button
                          onClick={() => onOpenPatientModal(item.patient.id)}
                          className="hover:text-blue-400 hover:underline transition-colors"
                        >
                          {item.patient.name}
                        </button>
                        <div className="text-[10px] text-neutral-400 font-normal">
                          {item.patient.phone}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-blue-400">{item.medName}</div>
                      </td>
                      <td className="py-3 px-3 text-neutral-300 light:text-neutral-700">
                        <span>{item.lastDispenseDate}</span>
                        <span className="text-[10px] text-neutral-400 block">
                          ({item.daysSupply} {lang === 'ar' ? 'يوم' : 'days'})
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        {isOverdue ? (
                          <span className="inline-block text-[11px] font-bold px-2 py-0.5 rounded bg-rose-950/70 text-rose-400 border border-rose-800/50">
                            {lang === 'ar' ? `منتهي منذ ${Math.abs(item.daysRemaining)} يوم` : `${Math.abs(item.daysRemaining)}d overdue`}
                          </span>
                        ) : item.daysRemaining <= 3 ? (
                          <span className="inline-block text-[11px] font-bold px-2 py-0.5 rounded bg-amber-950/70 text-amber-400 border border-amber-800/50">
                            {lang === 'ar' ? `متبقي ${item.daysRemaining} يوم` : `${item.daysRemaining}d left`}
                          </span>
                        ) : (
                          <span className="inline-block text-[11px] font-semibold px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 border border-neutral-700">
                            {lang === 'ar' ? `متبقي ${item.daysRemaining} يوم` : `${item.daysRemaining}d left`}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => onOpenRefillModal(item.patient.id, item.medIndex)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0f6cbd] hover:bg-[#115ea3] text-white text-xs font-bold shadow-sm transition-colors"
                        >
                          <Zap className="w-3.5 h-3.5 text-amber-300" />
                          <span>{lang === 'ar' ? 'صرف هذا الدواء فقط ⚡' : 'Refill Med ⚡'}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
