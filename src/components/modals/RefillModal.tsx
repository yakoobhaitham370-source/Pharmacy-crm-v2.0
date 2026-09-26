import React, { useState, useEffect } from 'react';
import { Zap, X, Check, Star } from 'lucide-react';
import { Patient } from '../../types/pharmacy';
import { calculateDaysRemaining, formatYMD } from '../../utils/pharmacyCalculations';

interface RefillModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: Patient | null;
  initialMedIndex?: number;
  lang: 'ar' | 'en';
  onExecuteRefill: (patientId: string, medIndices: number[], daysSupply: number) => void;
}

export const RefillModal: React.FC<RefillModalProps> = ({
  isOpen,
  onClose,
  patient,
  initialMedIndex,
  lang,
  onExecuteRefill,
}) => {
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [daysCount, setDaysCount] = useState<number>(30);

  useEffect(() => {
    if (!patient || !isOpen) return;

    if (initialMedIndex !== undefined && patient.medications[initialMedIndex]) {
      setSelectedIndices([initialMedIndex]);
      setDaysCount(patient.medications[initialMedIndex].daysSupply || 30);
    } else {
      // Auto-select due medications (<= 3 days remaining)
      const dueIndices: number[] = [];
      let rememberedDays = 30;

      patient.medications.forEach((m, idx) => {
        const remaining = calculateDaysRemaining(m.lastDispenseDate, m.daysSupply);
        if (remaining <= 3) {
          dueIndices.push(idx);
          rememberedDays = m.daysSupply || 30;
        }
      });

      setSelectedIndices(dueIndices.length > 0 ? dueIndices : [0]);
      setDaysCount(rememberedDays);
    }
  }, [patient, initialMedIndex, isOpen]);

  if (!isOpen || !patient) return null;

  const toggleMed = (index: number) => {
    if (selectedIndices.includes(index)) {
      setSelectedIndices(selectedIndices.filter(i => i !== index));
    } else {
      setSelectedIndices([...selectedIndices, index]);
      if (patient.medications[index]?.daysSupply) {
        setDaysCount(patient.medications[index].daysSupply);
      }
    }
  };

  const handleSelectAll = (select: boolean) => {
    if (select) {
      setSelectedIndices(patient.medications.map((_, i) => i));
    } else {
      setSelectedIndices([]);
    }
  };

  const handleExecute = () => {
    if (selectedIndices.length === 0) return;
    onExecuteRefill(patient.id, selectedIndices, Number(daysCount) || 30);
    onClose();
  };

  const loyaltyReward = daysCount >= 90 ? 30 : daysCount >= 30 ? 10 : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#1f1f1f] light:bg-white border border-[#383838] light:border-neutral-200 rounded-xl max-w-xl w-full shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 bg-[#292929] light:bg-neutral-100 border-b border-[#383838] flex items-center justify-between">
          <div className="font-extrabold text-base text-white light:text-neutral-900 flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-400" />
            <span>{lang === 'ar' ? 'تكرار الصرف الدوائي المخصص وحفظ نمط التكرار' : 'Granular Refill Dispensing'}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 text-xs">
          <div className="bg-[#141414] light:bg-neutral-50 p-3 rounded-lg border border-[#2e2e2e] light:border-neutral-200 flex items-center justify-between">
            <div>
              <div className="font-bold text-sm text-white light:text-neutral-900">{patient.name}</div>
              <div className="text-neutral-400 font-mono mt-0.5">{patient.phone}</div>
            </div>
            {loyaltyReward > 0 && (
              <span className="inline-flex items-center gap-1 font-bold text-amber-400 bg-amber-950/60 px-2 py-1 rounded border border-amber-800/40">
                <Star className="w-3.5 h-3.5 fill-amber-400" />
                <span>+{loyaltyReward} نقطة ولاء</span>
              </span>
            )}
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="font-bold text-neutral-300 light:text-neutral-700">
              {lang === 'ar' ? 'حدد الأدوية المراد تجديد صرفها الآن:' : 'Select medications to refill now:'}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleSelectAll(true)}
                className="text-blue-400 hover:underline font-semibold"
              >
                {lang === 'ar' ? 'تحديد الكل' : 'Select All'}
              </button>
              <span className="text-neutral-600">|</span>
              <button
                type="button"
                onClick={() => handleSelectAll(false)}
                className="text-neutral-400 hover:underline font-semibold"
              >
                {lang === 'ar' ? 'إلغاء التحديد' : 'Deselect All'}
              </button>
            </div>
          </div>

          {/* Meds List */}
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {patient.medications.map((m, idx) => {
              const isChecked = selectedIndices.includes(idx);
              const remaining = calculateDaysRemaining(m.lastDispenseDate, m.daysSupply);
              const isDue = remaining <= 3;

              return (
                <div
                  key={idx}
                  onClick={() => toggleMed(idx)}
                  className={`p-3 rounded-lg border flex items-center justify-between cursor-pointer transition-all ${
                    isChecked
                      ? 'bg-blue-950/30 border-blue-600 text-white'
                      : isDue
                      ? 'bg-rose-950/20 border-rose-800/50 text-neutral-300'
                      : 'bg-[#141414] light:bg-neutral-50 border-[#2e2e2e] light:border-neutral-200 text-neutral-400'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {}}
                      className="w-4 h-4 rounded text-blue-600 cursor-pointer"
                    />
                    <div>
                      <div className="font-bold text-sm text-white light:text-neutral-900">{m.name}</div>
                      <div className="text-[11px] text-neutral-400 mt-0.5">
                        {lang === 'ar'
                          ? `نمط الصرف المحفوظ: ${m.daysSupply} يوم | آخر صرف: ${m.lastDispenseDate}`
                          : `Saved supply: ${m.daysSupply}d | Last: ${m.lastDispenseDate}`}
                      </div>
                    </div>
                  </div>

                  <div>
                    {remaining < 0 ? (
                      <span className="font-bold text-rose-400 bg-rose-950/60 px-2 py-0.5 rounded text-[11px] border border-rose-800/40">
                        {lang === 'ar' ? `متأخر ${Math.abs(remaining)} يوم` : `${Math.abs(remaining)}d overdue`}
                      </span>
                    ) : remaining <= 3 ? (
                      <span className="font-bold text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded text-[11px] border border-amber-800/40">
                        {lang === 'ar' ? `مستحق بعد ${remaining} يوم` : `${remaining}d left`}
                      </span>
                    ) : (
                      <span className="text-neutral-400 text-[11px]">
                        {lang === 'ar' ? `متبقي ${remaining} يوم` : `${remaining}d left`}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Days Supply Input */}
          <div className="space-y-2 pt-2 border-t border-[#2e2e2e] light:border-neutral-200">
            <label className="font-bold text-neutral-300 light:text-neutral-700 block">
              {lang === 'ar' ? 'مدة التكرار المحددة (عدد الأيام / الحبات):' : 'Dispense Duration (Days / Tablets):'}
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={1}
                max={365}
                value={daysCount}
                onChange={e => setDaysCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-32 bg-[#141414] light:bg-neutral-50 border border-[#383838] light:border-neutral-300 text-white light:text-neutral-900 text-base font-extrabold text-center rounded-lg p-2 outline-none focus:border-blue-500"
              />
              <span className="font-bold text-neutral-300">{lang === 'ar' ? 'يوم / حبة' : 'Days / Tablets'}</span>
            </div>

            {/* Quick chips */}
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              <span className="text-[11px] text-neutral-400">{lang === 'ar' ? 'اختصارات سريعة:' : 'Quick Presets:'}</span>
              {[
                { d: 3, label: '3 أيام' },
                { d: 7, label: 'أسبوع' },
                { d: 10, label: '10 أيام' },
                { d: 14, label: '14 يوم' },
                { d: 28, label: '28 يوم' },
                { d: 30, label: 'شهر (30)' },
                { d: 60, label: 'شهرين (60)' },
                { d: 90, label: 'فصلي (90)' },
              ].map(chip => (
                <button
                  key={chip.d}
                  type="button"
                  onClick={() => setDaysCount(chip.d)}
                  className={`px-2 py-1 rounded-md text-[11px] font-bold border transition-colors ${
                    daysCount === chip.d
                      ? 'bg-blue-600 text-white border-blue-500'
                      : 'bg-neutral-800 text-neutral-300 border-neutral-700 hover:bg-neutral-700'
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#292929] light:bg-neutral-100 border-t border-[#383838] flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold transition-colors"
          >
            {lang === 'ar' ? 'إلغاء' : 'Cancel'}
          </button>
          <button
            type="button"
            onClick={handleExecute}
            disabled={selectedIndices.length === 0}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>
              {lang === 'ar'
                ? `إتمام صرف ${selectedIndices.length} أدوية (${daysCount} يوم)`
                : `Dispense ${selectedIndices.length} Meds (${daysCount}d)`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
