import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Header } from './components/Header';
import { Navigation, ViewType } from './components/Navigation';
import { DashboardView } from './components/views/DashboardView';
import { PatientsView } from './components/views/PatientsView';
import { FollowUpView } from './components/views/FollowUpView';
import { TimelineView } from './components/views/TimelineView';
import { SafetyRadarView } from './components/views/SafetyRadarView';
import { InventoryForecastView } from './components/views/InventoryForecastView';
import { ReportsView } from './components/views/ReportsView';
import { ArchiveView } from './components/views/ArchiveView';
import { SettingsView } from './components/views/SettingsView';

import { PatientDossierModal } from './components/modals/PatientDossierModal';
import { RefillModal } from './components/modals/RefillModal';
import { HouseholdSyncModal } from './components/modals/HouseholdSyncModal';
import { FollowUpModal } from './components/modals/FollowUpModal';

import { Patient, FollowUpEntry, Settings, HouseholdMemberAlignment } from './types/pharmacy';
import { INITIAL_PATIENTS, INITIAL_FOLLOW_UPS } from './data/mockPatients';
import { calculateDaysRemaining, formatYMD } from './utils/pharmacyCalculations';
import { evaluateClinicalSafetyRadar } from './data/drugDatabase';
import { syncPushToGoogleSheet, fetchFromGoogleSheet, testSheetConnectionDetailed } from './services/apiService';

const DEFAULT_SETTINGS: Settings = {
  pharmacyName: 'صيدلية النبض السريرية',
  gasUrl: '',
  waTemplate:
    'مرحباً {name}، تحيات {pharmacy}. نود تذكيرك بأن موعد تكرار علاجك ({drug}) مستحق بتاريخ {date}. يرجى مراجعتنا لاستلام أدويتك لضمان استقرار حالتك الصحية.',
  waAbxTemplate:
    'مرحباً {name}، معك دكتور الصيدلة من {pharmacy}. نود الاطمئنان على تحسن أعراضك مع مضاد ({drug}). نؤكد على ضرورة إكمال كامل كورس العلاج حتى لو شعرت بالتحسن لمنع عودة العدوى أو تطور بكتيريا مقاومة.',
  waChronicFollowTemplate:
    'مرحباً {name}، معك دكتور الصيدلة السريرية من {pharmacy}. نود الاطمئنان عليك ومتابعة استجابتك لعلاج ({drug}). هل واجهت أي أعراض كالسعال الجاف أو الدوخة أو ألم في العضلات؟',
  smsTemplate:
    '{pharmacy}: نذكركم بأن موعد تكرار علاجكم ({drug}) مستحق بتاريخ {date}. صحتكم أولويتنا.',
  waDropoutTemplate:
    'أهلاً بك {name}، معك دكتور الصيدلة السريرية من {pharmacy}. لاحظنا انقطاعك عن علاجك المزمن لأكثر من أسبوعين. نود الاطمئنان عليك والمساعدة في ضبط جرعاتك.',
};

export default function App() {
  const [activeView, setActiveView] = useState<ViewType>('dashboard');
  const [lang, setLang] = useState<'ar' | 'en'>('ar');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [currentTime, setCurrentTime] = useState<string>('00:00:00');

  // Core state
  const [patients, setPatients] = useState<Patient[]>(() => {
    try {
      const saved = localStorage.getItem('crm_cache_data');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Failed to load cached patients:', e);
    }
    return INITIAL_PATIENTS;
  });

  const [followUps, setFollowUps] = useState<FollowUpEntry[]>(() => {
    try {
      const saved = localStorage.getItem('crm_follow_ups');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Failed to load cached follow-ups:', e);
    }
    return INITIAL_FOLLOW_UPS;
  });

  const [settings, setSettings] = useState<Settings>(() => {
    try {
      const saved = localStorage.getItem('crm_settings');
      if (saved) {
        return Object.assign({}, DEFAULT_SETTINGS, JSON.parse(saved));
      }
    } catch (e) {}
    return DEFAULT_SETTINGS;
  });

  // Cloud Sync state
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'error' | 'idle'>('synced');
  const [syncMessage, setSyncMessage] = useState<string>('جاهز ومتصل');

  // Modals state
  const [isDossierOpen, setIsDossierOpen] = useState(false);
  const [selectedPatientForDossier, setSelectedPatientForDossier] = useState<Patient | null>(null);
  const [dossierInitialTab, setDossierInitialTab] = useState<string>('demographics');

  const [isRefillModalOpen, setIsRefillModalOpen] = useState(false);
  const [refillPatient, setRefillPatient] = useState<Patient | null>(null);
  const [refillInitialMedIndex, setRefillInitialMedIndex] = useState<number | undefined>(undefined);

  const [isHouseholdModalOpen, setIsHouseholdModalOpen] = useState(false);
  const [selectedFamilyTag, setSelectedFamilyTag] = useState<string>('');

  const [isFollowUpModalOpen, setIsFollowUpModalOpen] = useState(false);

  // Toast state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info'; id: number } | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type, id: Date.now() });
    setTimeout(() => {
      setToast(curr => (curr?.message === message ? null : curr));
    }, 3500);
  }, []);

  // Clock ticker
  useEffect(() => {
    const timer = setInterval(() => {
      const d = new Date();
      setCurrentTime(d.toTimeString().split(' ')[0]);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Sync state to LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem('crm_cache_data', JSON.stringify(patients));
    } catch (e) {}
  }, [patients]);

  useEffect(() => {
    try {
      localStorage.setItem('crm_follow_ups', JSON.stringify(followUps));
    } catch (e) {}
  }, [followUps]);

  useEffect(() => {
    try {
      localStorage.setItem('crm_settings', JSON.stringify(settings));
    } catch (e) {}
  }, [settings]);

  // Sync HTML lang and dir attributes
  useEffect(() => {
    document.documentElement.setAttribute('lang', lang);
    document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
  }, [lang]);

  // Sync theme
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    }
  }, [theme]);

  // Background Google Sheet Sync
  const handleSheetSync = useCallback(async (isManual = false) => {
    if (!settings.gasUrl || !settings.gasUrl.trim()) {
      setSyncStatus('idle');
      setSyncMessage(lang === 'ar' ? 'الرابط غير محدد' : 'No Gas URL');
      if (isManual) {
        showToast(
          lang === 'ar' ? 'يرجى إدخال رابط Google Apps Script في الإعدادات للمزامنة السحابية' : 'Configure Google Apps Script URL in Settings',
          'error'
        );
      }
      return;
    }

    setSyncStatus('syncing');
    setSyncMessage(lang === 'ar' ? 'جارِ المزامنة...' : 'Syncing...');

    try {
      // Fetch upstream using dual fetch (CORS fetch + JSONP fallback)
      const data = await fetchFromGoogleSheet(settings.gasUrl);
      if (data && data.patients) {
        if (data.patients.length === 0 && patients.length > 0) {
          // Upstream is fresh/empty; push local data
          await syncPushToGoogleSheet(settings.gasUrl, patients, followUps, settings);
          setSyncStatus('synced');
          setSyncMessage(lang === 'ar' ? 'تم تزويد الشيت بالبيانات' : 'Upstream Seeded');
          if (isManual) showToast(lang === 'ar' ? 'تم رفع السجلات المحلية للـ Sheet بنجاح' : 'Seeded Sheet successfully', 'success');
          return;
        }

        setPatients(data.patients);
        if (data.followUps) setFollowUps(data.followUps);

        setSyncStatus('synced');
        setSyncMessage(lang === 'ar' ? 'متصل ومحدث' : 'Synced');
        if (isManual) {
          showToast(
            lang === 'ar' ? `تمت المزامنة بنجاح! تم تحميل ${data.patients.length} مريض و ${data.followUps ? data.followUps.length : 0} متابعة` : `Synced ${data.patients.length} records`,
            'success'
          );
        }
      }
    } catch (err: any) {
      console.warn('Sheet sync error, attempting push fallback:', err);
      // Fallback: try push local
      try {
        const pushRes = await syncPushToGoogleSheet(settings.gasUrl, patients, followUps, settings);
        if (pushRes.success) {
          setSyncStatus('synced');
          setSyncMessage(lang === 'ar' ? 'تم الحفظ بالسحابة' : 'Saved to Cloud');
          if (isManual) showToast(lang === 'ar' ? 'تم حفظ ومزامنة البيانات في Google Sheet بنجاح' : 'Saved to cloud successfully', 'success');
        } else {
          throw new Error('Push failed');
        }
      } catch (e) {
        setSyncStatus('error');
        setSyncMessage(lang === 'ar' ? 'خطأ في الاتصال' : 'Connection Error');
        if (isManual) {
          showToast(
            lang === 'ar' ? 'فشل الاتصال برابط Google Sheet. تأكد من نشر السكريبت كـ Web App مع إذن Anyone' : 'Connection to Google Sheet failed. Check Web App permissions.',
            'error'
          );
        }
      }
    }
  }, [settings, lang, patients, followUps, showToast]);

  // Compute navigation badges
  const { dueRefillsCount, activeFollowUpsCount, criticalSafetyCount } = useMemo(() => {
    let due = 0;
    const activePts = patients.filter(p => !p.isArchived);

    activePts.forEach(p => {
      const hasDue = (p.medications || []).some(m => {
        const remaining = calculateDaysRemaining(m.lastDispenseDate, m.daysSupply);
        return remaining <= 3;
      });
      if (hasDue) due++;
    });

    const activeFUs = followUps.filter(f => !f.resolved).length;

    let critSafety = 0;
    activePts.forEach(p => {
      const alerts = evaluateClinicalSafetyRadar(p.medications || []);
      if (alerts.some(a => a.type === 'danger')) critSafety++;
    });

    return {
      dueRefillsCount: due,
      activeFollowUpsCount: activeFUs,
      criticalSafetyCount: critSafety,
    };
  }, [patients, followUps]);

  // Handlers for Modals
  const handleOpenPatientModal = (patientId?: string, tab = 'demographics') => {
    if (patientId) {
      const found = patients.find(p => p.id === patientId);
      setSelectedPatientForDossier(found || null);
    } else {
      setSelectedPatientForDossier(null);
    }
    setDossierInitialTab(tab);
    setIsDossierOpen(true);
  };

  const handleOpenRefillModal = (patientId: string, medIndex?: number) => {
    const found = patients.find(p => p.id === patientId);
    if (!found) return;
    setRefillPatient(found);
    setRefillInitialMedIndex(medIndex);
    setIsRefillModalOpen(true);
  };

  const handleOpenHouseholdModal = (familyTag: string) => {
    setSelectedFamilyTag(familyTag);
    setIsHouseholdModalOpen(true);
  };

  const handleSavePatient = (updatedPatient: Patient) => {
    setPatients(prev => {
      const idx = prev.findIndex(p => p.id === updatedPatient.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = updatedPatient;
        return copy;
      } else {
        return [updatedPatient, ...prev];
      }
    });
    showToast(lang === 'ar' ? `تم حفظ ملف ${updatedPatient.name} بنجاح` : `Saved ${updatedPatient.name}`, 'success');
  };

  const handleExecuteRefill = (patientId: string, medIndices: number[], daysSupply: number) => {
    const today = formatYMD(new Date());
    const refilledDrugNames: string[] = [];

    setPatients(prev => {
      return prev.map(p => {
        if (p.id !== patientId) return p;

        const updatedMeds = p.medications.map((m, idx) => {
          if (medIndices.includes(idx)) {
            refilledDrugNames.push(m.name);
            return {
              ...m,
              lastDispenseDate: today,
              daysSupply: daysSupply,
            };
          }
          return m;
        });

        const points = daysSupply >= 90 ? 30 : daysSupply >= 30 ? 10 : 0;

        return {
          ...p,
          medications: updatedMeds,
          loyaltyPoints: (Number(p.loyaltyPoints) || 0) + points,
        };
      });
    });

    showToast(
      lang === 'ar'
        ? `تم صرف (${refilledDrugNames.join(', ')}) وحفظ نمط (${daysSupply} يوم/حبة)!`
        : `Refilled (${refilledDrugNames.join(', ')}) for ${daysSupply} days`,
      'success'
    );
  };

  const handleApplyHouseholdAlignment = (rows: HouseholdMemberAlignment[]) => {
    const today = formatYMD(new Date());

    setPatients(prev => {
      return prev.map(member => {
        const memberRows = rows.filter(r => r.patientId === member.id);
        if (memberRows.length === 0) return member;

        const updatedMeds = member.medications.map(med => {
          const matchRow = memberRows.find(r => r.medName === med.name);
          if (matchRow) {
            const daysToTarget = Math.max(
              1,
              Math.ceil(
                (new Date(matchRow.targetDateStr).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24)
              )
            );
            return {
              ...med,
              lastDispenseDate: today,
              daysSupply: daysToTarget,
            };
          }
          return med;
        });

        return {
          ...member,
          medications: updatedMeds,
        };
      });
    });
  };

  const handleAddFollowUp = (entry: Omit<FollowUpEntry, 'id' | 'createdAt'>) => {
    const newEntry: FollowUpEntry = {
      ...entry,
      id: 'FU-' + Date.now().toString().slice(-6),
      createdAt: new Date().toISOString(),
    };
    setFollowUps(prev => [newEntry, ...prev]);
  };

  const handleResolveFollowUp = (id: string) => {
    setFollowUps(prev =>
      prev.map(f => (f.id === id ? { ...f, resolved: true, resolvedAt: new Date().toISOString() } : f))
    );
    showToast(lang === 'ar' ? 'تم توثيق اكتمال المتابعة بنجاح' : 'Follow-up marked as resolved', 'success');
  };

  const handleDeleteFollowUp = (id: string) => {
    setFollowUps(prev => prev.filter(f => f.id !== id));
    showToast(lang === 'ar' ? 'تم حذف سجل المتابعة' : 'Follow-up deleted', 'info');
  };

  const handleArchivePatient = (patientId: string) => {
    setPatients(prev =>
      prev.map(p =>
        p.id === patientId
          ? {
              ...p,
              isArchived: true,
              archivedDate: formatYMD(new Date()),
              archiveReason: lang === 'ar' ? 'نقل إلى الأرشيف' : 'Archived',
            }
          : p
      )
    );
    showToast(lang === 'ar' ? 'تمت أرشفة الملف بنجاح' : 'Patient archived', 'info');
  };

  const handleRestorePatient = (patientId: string) => {
    setPatients(prev =>
      prev.map(p => (p.id === patientId ? { ...p, isArchived: false, archivedDate: undefined } : p))
    );
    showToast(lang === 'ar' ? 'تمت استعادة الملف بنجاح' : 'Patient restored', 'success');
  };

  const handleExportBackup = () => {
    const dump = {
      patients,
      followUps,
      settings,
      exportedAt: new Date().toISOString(),
      version: '2.5.0-enterprise',
    };
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(dump, null, 2));
    const dl = document.createElement('a');
    dl.setAttribute('href', dataStr);
    dl.setAttribute('download', `PharmPulse_Enterprise_Backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(dl);
    dl.click();
    dl.remove();
    showToast(lang === 'ar' ? 'تم تصدير النسخة الاحتياطية بنجاح' : 'Backup exported', 'success');
  };

  const handleImportBackup = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = evt => {
      try {
        const parsed = JSON.parse(evt.target?.result as string);
        if (Array.isArray(parsed.patients)) {
          setPatients(parsed.patients);
          if (Array.isArray(parsed.followUps)) setFollowUps(parsed.followUps);
          if (parsed.settings) setSettings(Object.assign({}, DEFAULT_SETTINGS, parsed.settings));
          showToast(lang === 'ar' ? 'تم استيراد النسخة الاحتياطية وتحديث السجلات بنجاح' : 'Backup restored', 'success');
        } else {
          showToast(lang === 'ar' ? 'ملف النسخة الاحتياطية غير صالح' : 'Invalid backup file', 'error');
        }
      } catch (err) {
        showToast(lang === 'ar' ? 'تعذر قراءة ملف النسخة الاحتياطية' : 'Error reading file', 'error');
      }
    };
    reader.readAsText(file);
  };

  const handleResetDatabase = () => {
    if (confirm(lang === 'ar' ? 'هل أنت متأكد من إعادة ضبط البيانات إلى النماذج الافتراضية؟' : 'Reset to default seed data?')) {
      setPatients(INITIAL_PATIENTS);
      setFollowUps(INITIAL_FOLLOW_UPS);
      showToast(lang === 'ar' ? 'تمت استعادة البيانات النموذجية الافتراضية' : 'Database reset to seed data', 'success');
    }
  };

  return (
    <div className="min-h-screen bg-[#141414] light:bg-[#f5f5f5] text-white light:text-neutral-900 font-sans flex flex-col antialiased selection:bg-[#0f6cbd] selection:text-white">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-6 left-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-2xl text-xs font-bold border transition-all animate-bounce ${
            toast.type === 'success'
              ? 'bg-[#1f1f1f] text-emerald-400 border-emerald-600'
              : toast.type === 'error'
              ? 'bg-[#1f1f1f] text-rose-400 border-rose-600'
              : 'bg-[#1f1f1f] text-blue-400 border-blue-600'
          }`}
        >
          <span>{toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : 'ℹ️'}</span>
          <span>{toast.message}</span>
        </div>
      )}

      {/* Top Command Bar / Header */}
      <Header
        pharmacyName={settings.pharmacyName}
        currentTime={currentTime}
        syncStatus={syncStatus}
        syncMessage={syncMessage}
        onSync={() => handleSheetSync(true)}
        lang={lang}
        onToggleLang={() => setLang(l => (l === 'ar' ? 'en' : 'ar'))}
        theme={theme}
        onToggleTheme={() => setTheme(t => (t === 'dark' ? 'light' : 'dark'))}
        onOpenNewPatient={() => handleOpenPatientModal()}
        onOpenNewFollowUp={() => setIsFollowUpModalOpen(true)}
      />

      {/* Navigation Pivot Bar */}
      <Navigation
        activeView={activeView}
        onSelectView={setActiveView}
        dueRefillsCount={dueRefillsCount}
        activeFollowUpsCount={activeFollowUpsCount}
        criticalSafetyCount={criticalSafetyCount}
        lang={lang}
      />

      {/* Main Viewport Container */}
      <main className="flex-1 p-4 md:p-6 max-w-[1600px] w-full mx-auto">
        {activeView === 'dashboard' && (
          <DashboardView
            patients={patients}
            followUps={followUps}
            pharmacyName={settings.pharmacyName}
            waTemplate={settings.waTemplate}
            smsTemplate={settings.smsTemplate}
            lang={lang}
            onOpenPatientModal={handleOpenPatientModal}
            onOpenRefillModal={handleOpenRefillModal}
            onOpenHouseholdModal={handleOpenHouseholdModal}
            onOpenFollowUpModal={() => setIsFollowUpModalOpen(true)}
            onUpdatePatient={handleSavePatient}
            onShowToast={showToast}
          />
        )}

        {activeView === 'patients' && (
          <PatientsView
            patients={patients}
            lang={lang}
            onOpenPatientModal={handleOpenPatientModal}
            onOpenHouseholdModal={handleOpenHouseholdModal}
            onArchivePatient={handleArchivePatient}
            onShowToast={showToast}
          />
        )}

        {activeView === 'followup' && (
          <FollowUpView
            followUps={followUps}
            patients={patients}
            pharmacyName={settings.pharmacyName}
            waAbxTemplate={settings.waAbxTemplate}
            waChronicFollowTemplate={settings.waChronicFollowTemplate}
            lang={lang}
            onOpenFollowUpModal={() => setIsFollowUpModalOpen(true)}
            onResolveFollowUp={handleResolveFollowUp}
            onDeleteFollowUp={handleDeleteFollowUp}
            onShowToast={showToast}
          />
        )}

        {activeView === 'timeline' && (
          <TimelineView
            patients={patients}
            lang={lang}
            onOpenRefillModal={handleOpenRefillModal}
            onOpenPatientModal={handleOpenPatientModal}
          />
        )}

        {activeView === 'safety' && (
          <SafetyRadarView
            patients={patients}
            lang={lang}
            onShowToast={showToast}
            onOpenPatientModal={handleOpenPatientModal}
          />
        )}

        {activeView === 'inventory' && (
          <InventoryForecastView
            patients={patients}
            lang={lang}
            onShowToast={showToast}
          />
        )}

        {activeView === 'reports' && (
          <ReportsView
            patients={patients}
            lang={lang}
          />
        )}

        {activeView === 'archive' && (
          <ArchiveView
            patients={patients}
            lang={lang}
            onRestorePatient={handleRestorePatient}
          />
        )}

        {activeView === 'settings' && (
          <SettingsView
            settings={settings}
            lang={lang}
            onSaveSettings={s => {
              setSettings(s);
              showToast(lang === 'ar' ? 'تم حفظ الإعدادات' : 'Settings saved', 'success');
            }}
            onExportBackup={handleExportBackup}
            onImportBackup={handleImportBackup}
            onResetDatabase={handleResetDatabase}
            onTestSheetConnection={() => handleSheetSync(true)}
          />
        )}
      </main>

      {/* MODALS */}
      {/* 1. Patient Dossier Modal */}
      <PatientDossierModal
        isOpen={isDossierOpen}
        onClose={() => setIsDossierOpen(false)}
        patient={selectedPatientForDossier}
        initialTab={dossierInitialTab}
        followUps={followUps}
        pharmacyName={settings.pharmacyName}
        gasUrl={settings.gasUrl}
        lang={lang}
        onSavePatient={handleSavePatient}
        onOpenHouseholdModal={handleOpenHouseholdModal}
        onOpenNewFollowUp={() => setIsFollowUpModalOpen(true)}
        onShowToast={showToast}
      />

      {/* 2. Granular Refill Modal */}
      <RefillModal
        isOpen={isRefillModalOpen}
        onClose={() => setIsRefillModalOpen(false)}
        patient={refillPatient}
        initialMedIndex={refillInitialMedIndex}
        lang={lang}
        onExecuteRefill={handleExecuteRefill}
      />

      {/* 3. Household Sync Modal */}
      <HouseholdSyncModal
        isOpen={isHouseholdModalOpen}
        onClose={() => setIsHouseholdModalOpen(false)}
        familyTag={selectedFamilyTag}
        patients={patients}
        pharmacyName={settings.pharmacyName}
        lang={lang}
        onApplyAlignment={handleApplyHouseholdAlignment}
        onShowToast={showToast}
      />

      {/* 4. Follow Up Modal */}
      <FollowUpModal
        isOpen={isFollowUpModalOpen}
        onClose={() => setIsFollowUpModalOpen(false)}
        patients={patients}
        lang={lang}
        onAddFollowUp={handleAddFollowUp}
        onShowToast={showToast}
      />
    </div>
  );
}
