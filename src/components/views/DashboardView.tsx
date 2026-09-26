import React, { useState, useMemo } from 'react';
import {
  Users,
  AlertCircle,
  Clock,
  UserX,
  Search,
  MessageSquare,
  Send,
  Zap,
  FileText,
  TrendingUp,
  CheckCircle2,
  Stethoscope,
  Plus,
} from 'lucide-react';
import { Patient, FollowUpEntry } from '../../types/pharmacy';
import {
  calculatePDC,
  calculateDaysRemaining,
  formatYMD,
  formatPhoneForWhatsApp,
  executeUniversalSMS,
} from '../../utils/pharmacyCalculations';

interface DashboardViewProps {
  patients: Patient[];
  followUps: FollowUpEntry[];
  pharmacyName: string;
  waTemplate: string;
  smsTemplate: string;
  lang: 'ar' | 'en';
  onOpenPatientModal: (patientId?: string, tab?: string) => void;
  onOpenRefillModal: (patientId: string, medIndex?: number) => void;
  onOpenHouseholdModal: (familyTag: string) => void;
  onOpenFollowUpModal: () => void;
  onUpdatePatient: (patient: Patient) => void;
  onShowToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  patients,
  followUps,
  pharmacyName,
  waTemplate,
  smsTemplate,
  lang,
  onOpenPatientModal,
  onOpenRefillModal,
  onOpenHouseholdModal,
  onOpenFollowUpModal,
  onUpdatePatient,
  onShowToast,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const activePatients = useMemo(() => patients.filter(p => !p.isArchived), [patients]);

  // Calculations for Dispatch Queue
  const { dueRefillsCount, dropoutsCount, dispatchRows, totalDemandMatches } = useMemo(() => {
    let dueCount = 0;
    let dropoutCount = 0;
    const rows: {
      patient: Patient;
      earliestDueDate: Date;
      dueMeds: { name: string; daysRemaining: number; nextDue: Date }[];
      pdc: number;
      isDropout: boolean;
    }[] = [];

    const now = new Date();
    const query = searchQuery.trim().toLowerCase();
    let demandMatches = 0;

    activePatients.forEach(p => {
      let patientIsDropout = false;
      let patientIsDueSoon = false;
      let earliestDate: Date | null = null;
      const dueMeds: { name: string; daysRemaining: number; nextDue: Date }[] = [];

      (p.medications || []).forEach(m => {
        if (query && m.name.toLowerCase().includes(query)) {
          demandMatches++;
        }

        const daysRemaining = calculateDaysRemaining(m.lastDispenseDate, m.daysSupply);
        const lastDate = new Date(m.lastDispenseDate);
        const nextDue = new Date(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate() + (m.daysSupply || 30));

        if (daysRemaining <= 3) {
          dueMeds.push({
            name: m.name,
            daysRemaining,
            nextDue,
          });

          if (!earliestDate || nextDue < earliestDate) {
            earliestDate = nextDue;
          }

          if (daysRemaining >= -14) {
            patientIsDueSoon = true;
          } else {
            patientIsDropout = true;
          }
        }
      });

      if (patientIsDueSoon) dueCount++;
      if (patientIsDropout) dropoutCount++;

      if (dueMeds.length > 0 && earliestDate) {
        rows.push({
          patient: p,
          earliestDueDate: earliestDate,
          dueMeds,
          pdc: calculatePDC(p),
          isDropout: patientIsDropout,
        });
      }
    });

    // Filter by search query if present
    const filteredRows = query
      ? rows.filter(r => {
          const matchPatient = r.patient.name.toLowerCase().includes(query) ||
            r.patient.phone.includes(query) ||
            (r.patient.familyTag && r.patient.familyTag.toLowerCase().includes(query));
          const matchMed = r.dueMeds.some(m => m.name.toLowerCase().includes(query));
          return matchPatient || matchMed;
        })
      : rows;

    filteredRows.sort((a, b) => a.earliestDueDate.getTime() - b.earliestDueDate.getTime());

    return {
      dueRefillsCount: dueCount,
      dropoutsCount: dropoutCount,
      dispatchRows: filteredRows,
      totalDemandMatches: demandMatches,
    };
  }, [activePatients, searchQuery]);

  const pendingFollowUps = useMemo(() => followUps.filter(f => !f.resolved), [followUps]);

  // WhatsApp Reminder Sender
  const handleSendWhatsApp = (row: typeof dispatchRows[0]) => {
    const p = row.patient;
    const dueMedNames = row.dueMeds.map(m => m.name).join(' و ');
    const template =
      waTemplate ||
      'مرحباً {name}، تحيات {pharmacy}. نود تذكيرك بأن موعد تكرار علاجك ({drug}) مستحق بتاريخ {date}. يرجى مراجعتنا لاستلام أدويتك لضمان استقرار حالتك الصحية.';

    const message = template
      .replace('{name}', p.name)
      .replace('{pharmacy}', pharmacyName)
      .replace('{drug}', dueMedNames)
      .replace('{date}', formatYMD(row.earliestDueDate));

    const updated = {
      ...p,
      lastReminderSent: new Date().toISOString(),
    };
    onUpdatePatient(updated);

    const cleanPhone = formatPhoneForWhatsApp(p.phone);
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, '_blank');
    onShowToast(
      lang === 'ar'
        ? `تم فتح WhatsApp لإرسال تذكير (${dueMedNames}) إلى ${p.name}`
        : `Opened WhatsApp for ${p.name}`,
      'success'
    );
  };

  // SMS Reminder Sender
  const handleSendSMS = (row: typeof dispatchRows[0]) => {
    const p = row.patient;
    const dueMedNames = row.dueMeds.map(m => m.name).join(' و ');
    const template =
      smsTemplate ||
      '{pharmacy}: نذكركم بأن موعد تكرار علاجكم ({drug}) مستحق بتاريخ {date}. صحتكم أولويتنا.';

    const message = template
      .replace('{name}', p.name)
      .replace('{pharmacy}', pharmacyName)
      .replace('{drug}', dueMedNames)
      .replace('{date}', formatYMD(row.earliestDueDate));

    const updated = {
      ...p,
      lastReminderSent: new Date().toISOString(),
    };
    onUpdatePatient(updated);

    executeUniversalSMS(p.phone, message);
    onShowToast(
      lang === 'ar'
        ? `تم تجهيز رسالة SMS إلى ${p.name}`
        : `Prepared SMS for ${p.name}`,
      'success'
    );
  };

  return (
    <div className="space-y-6">
      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Active Patients */}
        <div className="bg-[#1f1f1f] light:bg-white border border-[#383838] light:border-neutral-200 rounded-xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 left-0 h-1 bg-[#0f6cbd]" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-neutral-400 light:text-neutral-500 uppercase tracking-wider">
              {lang === 'ar' ? 'إجمالي المرضى النشطين' : 'Active Chronic Patients'}
            </span>
            <Users className="w-5 h-5 text-blue-400" />
          </div>
          <div className="text-3xl font-extrabold text-white light:text-neutral-900 mt-2">
            {activePatients.length}
          </div>
          <div className="text-xs text-neutral-500 light:text-neutral-400 mt-1">
            {lang === 'ar' ? 'مسجلون في برامج الصرف المستمر' : 'Enrolled in refill programs'}
          </div>
        </div>

        {/* Metric 2: Follow Ups Due */}
        <div className="bg-[#1f1f1f] light:bg-white border border-[#383838] light:border-neutral-200 rounded-xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 left-0 h-1 bg-amber-500" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-neutral-400 light:text-neutral-500 uppercase tracking-wider">
              {lang === 'ar' ? 'متابعات سريرية ومضادات' : 'Clinical Follow-Ups'}
            </span>
            <Stethoscope className="w-5 h-5 text-amber-400" />
          </div>
          <div className="text-3xl font-extrabold text-amber-400 mt-2">
            {pendingFollowUps.length}
          </div>
          <div className="text-xs text-neutral-500 light:text-neutral-400 mt-1">
            {lang === 'ar' ? 'مضادات يوم 3/7 ورعاية مزمنة' : 'Day 3/7 Stewardship checks'}
          </div>
        </div>

        {/* Metric 3: Due Refills */}
        <div className="bg-[#1f1f1f] light:bg-white border border-[#383838] light:border-neutral-200 rounded-xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 left-0 h-1 bg-rose-500" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-neutral-400 light:text-neutral-500 uppercase tracking-wider">
              {lang === 'ar' ? 'مستحقو الصرف (خلال 3 أيام)' : 'Refills Due (≤ 3 Days)'}
            </span>
            <Clock className="w-5 h-5 text-rose-400" />
          </div>
          <div className="text-3xl font-extrabold text-rose-400 mt-2">
            {dueRefillsCount}
          </div>
          <div className="text-xs text-neutral-500 light:text-neutral-400 mt-1">
            {lang === 'ar' ? 'بحاجة لتكرار الوصفة فوراً' : 'Require prompt dispensing'}
          </div>
        </div>

        {/* Metric 4: Dropouts */}
        <div className="bg-[#1f1f1f] light:bg-white border border-[#383838] light:border-neutral-200 rounded-xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 left-0 h-1 bg-orange-500" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-neutral-400 light:text-neutral-500 uppercase tracking-wider">
              {lang === 'ar' ? 'المنقطعون عن العلاج (> 14 يوم)' : 'Therapy Dropouts (>14d)'}
            </span>
            <UserX className="w-5 h-5 text-orange-400" />
          </div>
          <div className="text-3xl font-extrabold text-orange-400 mt-2">
            {dropoutsCount}
          </div>
          <div className="text-xs text-neutral-500 light:text-neutral-400 mt-1">
            {lang === 'ar' ? 'خطر انتكاس الحالة السريرية' : 'High non-adherence risk'}
          </div>
        </div>
      </div>

      {/* Universal Search & Demand Forecast */}
      <div className="bg-[#1f1f1f] light:bg-white border border-[#383838] light:border-neutral-200 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="font-bold text-base text-white light:text-neutral-900 flex items-center gap-2">
            <Search className="w-5 h-5 text-blue-400" />
            <span>{lang === 'ar' ? 'البحث المباشر والاستعلام السريري الذكي' : 'Universal Search & Demand Query'}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onOpenFollowUpModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#1e3a5f] hover:bg-[#284b77] text-blue-300 border border-[#0f6cbd]/40 transition-colors"
            >
              <Stethoscope className="w-3.5 h-3.5" />
              <span>{lang === 'ar' ? 'تسجيل متابعة / مضاد' : 'Add Follow-Up'}</span>
            </button>
            <button
              onClick={() => onOpenPatientModal()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#0f6cbd] hover:bg-[#115ea3] text-white transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{lang === 'ar' ? 'تسجيل مريض جديد' : 'New Patient'}</span>
            </button>
          </div>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-neutral-400 absolute right-3 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={
              lang === 'ar'
                ? 'ابحث باسم المريض، رقم الهاتف، الدواء (مثال: Glucophage, Lipitor, Concor)، أو رمز العائلة...'
                : 'Search patient name, phone, medication brand, or family tag...'
            }
            className="w-full bg-[#141414] light:bg-neutral-50 border border-[#383838] light:border-neutral-300 text-white light:text-neutral-900 text-sm rounded-lg px-9 py-2.5 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute left-3 top-2.5 text-xs text-neutral-400 hover:text-white px-1.5 py-0.5 rounded bg-neutral-800"
            >
              ✕
            </button>
          )}
        </div>

        {/* Demand Forecast Banner */}
        {searchQuery && totalDemandMatches > 0 && (
          <div className="bg-blue-950/40 border border-blue-600/40 rounded-lg p-3 text-xs text-blue-200 flex items-center justify-between gap-3 animate-fade-in">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-400 shrink-0" />
              <div>
                <strong>{lang === 'ar' ? 'توقع الطلب السريري:' : 'Clinical Demand Forecast:'}</strong>{' '}
                {lang === 'ar'
                  ? `يوجد ${totalDemandMatches} مريض نشط يستخدم دواء مطابق لبحثك، باحتياج متوقع لصرف ${totalDemandMatches} عبوة/شريط خلال 7 إلى 30 يوماً القادمة.`
                  : `There are ${totalDemandMatches} active patients matching this query, with an estimated upcoming requirement of ${totalDemandMatches} packs.`}
              </div>
            </div>
            <span className="font-extrabold text-blue-300 bg-blue-900/60 px-2 py-1 rounded text-xs shrink-0">
              {totalDemandMatches} {lang === 'ar' ? 'حالة نشطة' : 'Patients'}
            </span>
          </div>
        )}
      </div>

      {/* Priority Dispatch Room */}
      <div className="bg-[#1f1f1f] light:bg-white border border-[#383838] light:border-neutral-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-[#383838] light:border-neutral-200 flex items-center justify-between">
          <div className="font-bold text-base text-white light:text-neutral-900 flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-400" />
            <span>{lang === 'ar' ? 'غرفة الإرسال السريع وتكرار الصرف المخصص' : 'Priority Dispatch & Granular Refill Hub'}</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-blue-950/60 text-blue-300 border border-blue-700/50">
              {dispatchRows.length} {lang === 'ar' ? 'حالة مستحقة' : 'Due'}
            </span>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-right dir-rtl text-xs">
            <thead className="bg-[#292929] light:bg-neutral-100 text-neutral-300 light:text-neutral-700 font-bold border-b border-[#383838] light:border-neutral-200">
              <tr>
                <th className="py-3 px-4">{lang === 'ar' ? 'المريض' : 'Patient'}</th>
                <th className="py-3 px-3">{lang === 'ar' ? 'العائلة' : 'Family'}</th>
                <th className="py-3 px-3">{lang === 'ar' ? 'الهاتف' : 'Phone'}</th>
                <th className="py-3 px-4">{lang === 'ar' ? 'الأدوية المستحقة للصرف فقط' : 'Due Medications'}</th>
                <th className="py-3 px-3">{lang === 'ar' ? 'تاريخ الاستحقاق' : 'Next Due'}</th>
                <th className="py-3 px-3">{lang === 'ar' ? 'الالتزام (PDC)' : 'Adherence'}</th>
                <th className="py-3 px-3">{lang === 'ar' ? 'حالة التذكير' : 'Reminder Status'}</th>
                <th className="py-3 px-4 text-center">{lang === 'ar' ? 'الإجراءات السريعة' : 'Quick Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2e2e2e] light:divide-neutral-200 text-neutral-200 light:text-neutral-800">
              {dispatchRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-neutral-400">
                    {lang === 'ar'
                      ? 'لا توجد وصفات حرجة أو مستحقة حالياً مطابقة للبحث.'
                      : 'No critical due refills found.'}
                  </td>
                </tr>
              ) : (
                dispatchRows.map(row => {
                  const p = row.patient;
                  const todayYMD = formatYMD(new Date());
                  const sentDateYMD = p.lastReminderSent ? formatYMD(p.lastReminderSent) : null;
                  const isSentToday = sentDateYMD === todayYMD;

                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-neutral-800/40 light:hover:bg-neutral-50 transition-colors"
                    >
                      {/* Name */}
                      <td className="py-3.5 px-4 font-bold text-white light:text-neutral-900">
                        <button
                          onClick={() => onOpenPatientModal(p.id)}
                          className="hover:text-blue-400 text-right underline-offset-2 hover:underline transition-colors"
                        >
                          {p.name}
                        </button>
                      </td>

                      {/* Family Tag */}
                      <td className="py-3.5 px-3">
                        {p.familyTag ? (
                          <button
                            onClick={() => onOpenHouseholdModal(p.familyTag!)}
                            title={lang === 'ar' ? 'انقر لتوحيد صرف أفراد العائلة معاً' : 'Sync family refills'}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-950/60 text-blue-300 border border-blue-700/50 hover:bg-blue-900 transition-colors cursor-pointer"
                          >
                            <span>👨‍👩‍👧‍👦</span>
                            <span>{p.familyTag}</span>
                          </button>
                        ) : (
                          <span className="text-neutral-500">—</span>
                        )}
                      </td>

                      {/* Phone */}
                      <td className="py-3.5 px-3 font-mono text-neutral-300 light:text-neutral-600">
                        {p.phone}
                      </td>

                      {/* Due Medications */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          {row.dueMeds.map((dm, idx) => {
                            const isOverdue = dm.daysRemaining < 0;
                            return (
                              <div key={idx} className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-semibold text-white light:text-neutral-900">
                                  • {dm.name}
                                </span>
                                {isOverdue ? (
                                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-rose-950/70 text-rose-400 border border-rose-800/40">
                                    {lang === 'ar' ? `متأخر ${Math.abs(dm.daysRemaining)} يوم` : `${Math.abs(dm.daysRemaining)}d overdue`}
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-950/70 text-amber-400 border border-amber-800/40">
                                    {lang === 'ar' ? `مستحق بعد ${dm.daysRemaining} يوم` : `due in ${dm.daysRemaining}d`}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </td>

                      {/* Next Due Date */}
                      <td className="py-3.5 px-3 font-mono text-xs font-semibold text-neutral-300 light:text-neutral-700">
                        {formatYMD(row.earliestDueDate)}
                      </td>

                      {/* PDC Adherence */}
                      <td className="py-3.5 px-3">
                        <span
                          className={`inline-block font-extrabold px-2 py-0.5 rounded text-[11px] ${
                            row.pdc >= 80
                              ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-700/50'
                              : 'bg-rose-950/60 text-rose-400 border border-rose-700/50'
                          }`}
                        >
                          {row.pdc}%
                        </span>
                      </td>

                      {/* Reminder status badge */}
                      <td className="py-3.5 px-3">
                        {isSentToday ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              <span>{lang === 'ar' ? 'تم التذكير اليوم' : 'Sent Today'}</span>
                            </span>
                            <span className="text-[10px] text-neutral-400">
                              {new Date(p.lastReminderSent!).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        ) : row.isDropout ? (
                          <span className="inline-block text-[11px] font-bold px-2 py-0.5 rounded bg-rose-950 text-rose-400 border border-rose-800">
                            {lang === 'ar' ? 'منقطع (>14 يوم)' : 'Dropout'}
                          </span>
                        ) : (
                          <span className="inline-block text-[11px] font-bold px-2 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800">
                            {lang === 'ar' ? 'مستحق التكرار' : 'Due Now'}
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* WhatsApp */}
                          <button
                            onClick={() => handleSendWhatsApp(row)}
                            title={lang === 'ar' ? 'إرسال تذكير مخصص عبر WhatsApp للأدوية المستحقة' : 'Send WhatsApp Reminder'}
                            className="p-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-600/40 transition-colors"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>

                          {/* SMS */}
                          <button
                            onClick={() => handleSendSMS(row)}
                            title={lang === 'ar' ? 'إرسال رسالة SMS نصية' : 'Send SMS'}
                            className="p-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-600/40 transition-colors"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </button>

                          {/* Refill Button */}
                          <button
                            onClick={() => onOpenRefillModal(p.id)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#0f6cbd] hover:bg-[#115ea3] text-white font-bold text-xs shadow-sm transition-colors"
                            title={lang === 'ar' ? 'تكرار صرف الأدوية المحددة وحفظ النمط' : 'Refill Medications'}
                          >
                            <Zap className="w-3 h-3 text-amber-300" />
                            <span>{lang === 'ar' ? 'صرف' : 'Refill'}</span>
                          </button>

                          {/* Dossier */}
                          <button
                            onClick={() => onOpenPatientModal(p.id)}
                            className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700 transition-colors"
                            title={lang === 'ar' ? 'فتح الملف السريري الكامل' : 'Open Dossier'}
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>
                        </div>
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
