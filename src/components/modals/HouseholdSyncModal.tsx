import React, { useState, useMemo } from 'react';
import { Users, X, Check, Calendar, MessageSquare, AlertCircle } from 'lucide-react';
import { Patient, HouseholdMemberAlignment } from '../../types/pharmacy';
import { calculateDaysRemaining, formatYMD, parseLocalDate, formatPhoneForWhatsApp } from '../../utils/pharmacyCalculations';

interface HouseholdSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  familyTag: string;
  patients: Patient[];
  pharmacyName: string;
  lang: 'ar' | 'en';
  onApplyAlignment: (rows: HouseholdMemberAlignment[]) => void;
  onShowToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const HouseholdSyncModal: React.FC<HouseholdSyncModalProps> = ({
  isOpen,
  onClose,
  familyTag,
  patients,
  pharmacyName,
  lang,
  onApplyAlignment,
  onShowToast,
}) => {
  // Target alignment date defaults to 1st of next month
  const defaultTargetDate = useMemo(() => {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return formatYMD(nextMonth);
  }, []);

  const [targetDateStr, setTargetDateStr] = useState<string>(defaultTargetDate);
  const [draftMessage, setDraftMessage] = useState<string>('');

  const familyMembers = useMemo(() => {
    if (!familyTag) return [];
    return patients.filter(p => !p.isArchived && p.familyTag === familyTag);
  }, [patients, familyTag]);

  // Compute alignment rows
  const computedRows = useMemo(() => {
    const rows: HouseholdMemberAlignment[] = [];
    const targetDate = parseLocalDate(targetDateStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const daysToTarget = Math.max(1, Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));

    familyMembers.forEach(member => {
      (member.medications || []).forEach(med => {
        const remaining = calculateDaysRemaining(med.lastDispenseDate, med.daysSupply);
        const lastDate = parseLocalDate(med.lastDispenseDate);
        const currentExpiry = new Date(
          lastDate.getFullYear(),
          lastDate.getMonth(),
          lastDate.getDate() + (med.daysSupply || 30)
        );

        const neededTablets = Math.max(0, daysToTarget - Math.max(0, remaining));

        rows.push({
          patientId: member.id,
          patientName: member.name,
          phone: member.phone,
          medName: med.name,
          currentExpiry: formatYMD(currentExpiry),
          daysRemaining: remaining,
          neededTablets,
          targetDateStr,
        });
      });
    });

    return rows;
  }, [familyMembers, targetDateStr]);

  // Update draft message whenever computedRows change
  React.useEffect(() => {
    const lines = computedRows
      .filter(r => r.neededTablets > 0)
      .map(r => `• ${r.patientName}: ${r.medName} (${r.neededTablets} حبة لتوحيد الموعد)`);

    const msg = `مرحباً بكم، تحيات ${pharmacyName || 'الصيدلية السريرية'}.\nحرصاً منا على راحتكم وتوفير مشقة الزيارات المتكررة، قمنا بجدولة توحيد مواعيد صرف علاج أفراد عائلتكم الكريمة (${familyTag}) لتاريخ موحد: ${targetDateStr}.\n\nالكميات الإضافية المحسوبة لتزامن الصرف في رحلة واحدة:\n${lines.join('\n')}\n\nدمتم وعائلتكم بأتم الصحة والعافية.`;
    setDraftMessage(msg);
  }, [computedRows, familyTag, pharmacyName, targetDateStr]);

  if (!isOpen || !familyTag) return null;

  const handleApply = () => {
    onApplyAlignment(computedRows);
    onClose();
    onShowToast(
      lang === 'ar'
        ? `تم توحيد مواعيد صرف عائلة (${familyTag}) بنجاح حتى تاريخ ${targetDateStr}`
        : `Synchronized family (${familyTag}) until ${targetDateStr}`,
      'success'
    );
  };

  const handleSendWhatsApp = () => {
    if (computedRows.length === 0) return;
    const primaryPhone = computedRows[0].phone;
    const cleanPhone = formatPhoneForWhatsApp(primaryPhone);
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(draftMessage)}`, '_blank');
    onShowToast(lang === 'ar' ? 'تم فتح WhatsApp لإرسال رسالة العائلة الموحدة' : 'Opened WhatsApp for family sync message', 'success');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#1f1f1f] light:bg-white border border-[#383838] light:border-neutral-200 rounded-xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 bg-[#292929] light:bg-neutral-100 border-b border-[#383838] flex items-center justify-between">
          <div className="font-extrabold text-base text-white light:text-neutral-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-400" />
            <span>{lang === 'ar' ? 'توحيد مواعيد صرف علاج العائلة (One-Trip Family Dispense)' : 'Household Refill Synchronizer'}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 text-xs overflow-y-auto">
          <div className="bg-blue-950/30 border border-blue-700/40 p-4 rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-blue-300">
                👨‍👩‍👧‍👦 {lang === 'ar' ? 'العائلة المستهدفة:' : 'Family Tag:'} {familyTag}
              </span>
              <span className="text-neutral-400">
                {familyMembers.length} {lang === 'ar' ? 'أفراد مسجلون' : 'members'}
              </span>
            </div>
            <p className="text-neutral-300 leading-relaxed">
              {lang === 'ar'
                ? 'يقوم هذا المحرك بحساب عدد الحبات والأيام الإضافية الناقصة (Bridge Doses) لكل فرد من أفراد العائلة لمزامنة استحقاق كل الأدوية في موعد زيارة واحد مستقبلاً.'
                : 'Calculates exact bridge doses required for each family member to align all medication refilling to a single coordinated trip.'}
            </p>

            <div className="pt-2 flex items-center gap-3">
              <label className="font-semibold text-neutral-200">
                {lang === 'ar' ? 'تاريخ الاستحقاق الموحد المستهدف:' : 'Target Synchronized Refill Date:'}
              </label>
              <input
                type="date"
                value={targetDateStr}
                onChange={e => setTargetDateStr(e.target.value)}
                className="bg-[#141414] light:bg-neutral-50 border border-[#383838] text-white light:text-neutral-900 p-2 rounded-lg text-xs outline-none focus:border-blue-500 font-mono"
              />
            </div>
          </div>

          {/* Members Table */}
          <div className="border border-[#383838] rounded-lg overflow-hidden">
            <table className="w-full text-right dir-rtl text-xs">
              <thead className="bg-[#292929] light:bg-neutral-100 text-neutral-300 font-bold border-b border-[#383838]">
                <tr>
                  <th className="py-2.5 px-3">{lang === 'ar' ? 'فرد العائلة' : 'Member'}</th>
                  <th className="py-2.5 px-3">{lang === 'ar' ? 'الدواء المزمن' : 'Medication'}</th>
                  <th className="py-2.5 px-3">{lang === 'ar' ? 'النفاد الحالي' : 'Current Expiry'}</th>
                  <th className="py-2.5 px-3">{lang === 'ar' ? 'المتبقي' : 'Days Left'}</th>
                  <th className="py-2.5 px-3">{lang === 'ar' ? 'حبات التوحيد المطلوبة' : 'Bridge Tablets'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2e2e2e] text-neutral-200">
                {computedRows.map((r, idx) => (
                  <tr key={idx} className="hover:bg-neutral-800/30">
                    <td className="py-2.5 px-3 font-bold text-white light:text-neutral-900">{r.patientName}</td>
                    <td className="py-2.5 px-3 text-neutral-300">{r.medName}</td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-neutral-400">{r.currentExpiry}</td>
                    <td className="py-2.5 px-3">
                      {r.daysRemaining <= 0 ? (
                        <span className="text-rose-400 font-bold">{lang === 'ar' ? 'منتهي' : 'Expired'}</span>
                      ) : (
                        <span>{r.daysRemaining} {lang === 'ar' ? 'يوم' : 'd'}</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-extrabold text-blue-400 text-sm">
                      {r.neededTablets > 0 ? (
                        <span>+{r.neededTablets} {lang === 'ar' ? 'حبة / يوم' : 'tabs'}</span>
                      ) : (
                        <span className="text-emerald-400 text-xs">{lang === 'ar' ? 'مغطى بالكامل' : 'Covered'}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Draft Message */}
          <div className="space-y-1">
            <label className="font-bold text-neutral-300 block">
              {lang === 'ar' ? 'مسودة الرسالة العائلية الموحدة (WhatsApp):' : 'Draft Unified WhatsApp Message:'}
            </label>
            <textarea
              rows={4}
              value={draftMessage}
              onChange={e => setDraftMessage(e.target.value)}
              className="w-full bg-[#141414] light:bg-neutral-50 border border-[#383838] text-white light:text-neutral-900 text-xs rounded-lg p-2.5 outline-none focus:border-blue-500 font-sans"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#292929] light:bg-neutral-100 border-t border-[#383838] flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleSendWhatsApp}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors cursor-pointer"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>{lang === 'ar' ? 'إرسال رسالة العائلة WhatsApp' : 'Send WhatsApp to Family'}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold transition-colors"
            >
              {lang === 'ar' ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md transition-colors cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{lang === 'ar' ? 'اعتماد وتجديد تواريخ العائلة' : 'Apply & Sync Dates'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
