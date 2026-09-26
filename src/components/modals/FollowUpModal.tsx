import React, { useState } from 'react';
import { Stethoscope, X, Check } from 'lucide-react';
import { Patient, FollowUpEntry, FollowUpType } from '../../types/pharmacy';
import { formatYMD, parseLocalDate } from '../../utils/pharmacyCalculations';

interface FollowUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  patients: Patient[];
  lang: 'ar' | 'en';
  onAddFollowUp: (entry: Omit<FollowUpEntry, 'id' | 'createdAt'>) => void;
  onShowToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const FollowUpModal: React.FC<FollowUpModalProps> = ({
  isOpen,
  onClose,
  patients,
  lang,
  onAddFollowUp,
  onShowToast,
}) => {
  const activePatients = patients.filter(p => !p.isArchived);

  const [patientId, setPatientId] = useState<string>(activePatients[0]?.id || '');
  const [type, setType] = useState<FollowUpType>('ANTIBIOTIC');
  const [drug, setDrug] = useState<string>('');
  const [startDateStr, setStartDateStr] = useState<string>(formatYMD(new Date()));
  const [daysOffset, setDaysOffset] = useState<number>(3);
  const [notes, setNotes] = useState<string>('');

  if (!isOpen) return null;

  const handleTypeChange = (newType: FollowUpType) => {
    setType(newType);
    if (newType === 'ANTIBIOTIC') setDaysOffset(3);
    else if (newType === 'CHRONIC_INIT') setDaysOffset(7);
    else if (newType === 'TITRATION') setDaysOffset(14);
    else setDaysOffset(30);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const patient = activePatients.find(p => p.id === patientId);
    if (!patient) {
      onShowToast(lang === 'ar' ? 'يرجى اختيار مريض' : 'Please select patient', 'error');
      return;
    }
    if (!drug.trim()) {
      onShowToast(lang === 'ar' ? 'يرجى إدخال اسم الدواء' : 'Please enter medication name', 'error');
      return;
    }

    const start = parseLocalDate(startDateStr);
    const dueDate = new Date(start.getFullYear(), start.getMonth(), start.getDate() + daysOffset);

    onAddFollowUp({
      patientId: patient.id,
      patientName: patient.name,
      phone: patient.phone,
      type,
      drug: drug.trim(),
      startDate: startDateStr,
      dueDate: formatYMD(dueDate),
      daysOffset,
      notes: notes.trim(),
      resolved: false,
    });

    onClose();
    onShowToast(lang === 'ar' ? 'تم تسجيل خطة المتابعة السريرية بنجاح' : 'Clinical follow-up registered', 'success');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#1f1f1f] light:bg-white border border-[#383838] light:border-neutral-200 rounded-xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 bg-[#292929] light:bg-neutral-100 border-b border-[#383838] flex items-center justify-between">
          <div className="font-extrabold text-base text-white light:text-neutral-900 flex items-center gap-2">
            <Stethoscope className="w-5 h-5 text-amber-400" />
            <span>{lang === 'ar' ? 'تسجيل متابعة سريرية جديدة (مضاد / علاج مزمن)' : 'New Clinical Follow-Up'}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          <div className="space-y-1">
            <label className="font-semibold text-neutral-300 light:text-neutral-700">
              {lang === 'ar' ? 'اختر المريض *' : 'Select Patient *'}
            </label>
            <select
              value={patientId}
              onChange={e => setPatientId(e.target.value)}
              className="w-full bg-[#141414] light:bg-neutral-50 border border-[#383838] light:border-neutral-300 text-white light:text-neutral-900 rounded-lg p-2.5 outline-none focus:border-blue-500"
              required
            >
              {activePatients.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.phone})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-semibold text-neutral-300 light:text-neutral-700">
                {lang === 'ar' ? 'نوع المتابعة السريرية *' : 'Follow-Up Category *'}
              </label>
              <select
                value={type}
                onChange={e => handleTypeChange(e.target.value as FollowUpType)}
                className="w-full bg-[#141414] light:bg-neutral-50 border border-[#383838] light:border-neutral-300 text-white light:text-neutral-900 rounded-lg p-2.5 outline-none focus:border-blue-500"
              >
                <option value="ANTIBIOTIC">مضاد حيوي (Stewardship)</option>
                <option value="CHRONIC_INIT">بدء علاج مزمن جديد</option>
                <option value="TITRATION">معايرة جرعة (Titration)</option>
                <option value="SIDE_EFFECT">رصد أعراض جانبية</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-neutral-300 light:text-neutral-700">
                {lang === 'ar' ? 'اسم العلاج / المضاد *' : 'Medication / Antibiotic *'}
              </label>
              <input
                type="text"
                value={drug}
                onChange={e => setDrug(e.target.value)}
                placeholder="Augmentin 1g, Glucophage..."
                className="w-full bg-[#141414] light:bg-neutral-50 border border-[#383838] light:border-neutral-300 text-white light:text-neutral-900 rounded-lg p-2.5 outline-none focus:border-blue-500"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-semibold text-neutral-300 light:text-neutral-700">
                {lang === 'ar' ? 'تاريخ البدء أو الصرف' : 'Start Date'}
              </label>
              <input
                type="date"
                value={startDateStr}
                onChange={e => setStartDateStr(e.target.value)}
                className="w-full bg-[#141414] light:bg-neutral-50 border border-[#383838] light:border-neutral-300 text-white light:text-neutral-900 rounded-lg p-2.5 outline-none focus:border-blue-500 font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-neutral-300 light:text-neutral-700">
                {lang === 'ar' ? 'موعد المتابعة (بعد كم يوم؟)' : 'Milestone Timing'}
              </label>
              <select
                value={daysOffset}
                onChange={e => setDaysOffset(parseInt(e.target.value, 10))}
                className="w-full bg-[#141414] light:bg-neutral-50 border border-[#383838] light:border-neutral-300 text-white light:text-neutral-900 rounded-lg p-2.5 outline-none focus:border-blue-500"
              >
                <option value={3}>بعد 3 أيام (استجابة أولية / حرارة / تقبل)</option>
                <option value={7}>بعد 7 أيام (إكمال كورس مضاد / استقرار)</option>
                <option value={14}>بعد 14 يوم (معايرة خافض ضغط أو سكر)</option>
                <option value={30}>بعد 30 يوم (فحص وظائف أو آلام عضلات الستاتين)</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-neutral-300 light:text-neutral-700">
              {lang === 'ar' ? 'ملاحظات الاستشارة والتعليمات الخاصة' : 'Counseling & Clinical Notes'}
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="مثال: تم التنبيه على أخذ العلاج بعد الطعام ومراقبة هبوط الحرارة..."
              className="w-full bg-[#141414] light:bg-neutral-50 border border-[#383838] light:border-neutral-300 text-white light:text-neutral-900 rounded-lg p-2.5 outline-none focus:border-blue-500"
            />
          </div>

          {/* Footer */}
          <div className="pt-3 border-t border-[#2e2e2e] light:border-neutral-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-semibold"
            >
              {lang === 'ar' ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-[#0f6cbd] hover:bg-[#115ea3] text-white font-bold shadow-md"
            >
              <Check className="w-4 h-4" />
              <span>{lang === 'ar' ? 'حفظ وتفعيل خطة المتابعة' : 'Activate Follow-Up'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
