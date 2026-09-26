import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  X,
  Users,
  AlertTriangle,
  HeartPulse,
  Image as ImageIcon,
  Calendar,
  Printer,
  Copy,
  MessageSquare,
  Send,
  Plus,
  Trash2,
  Sparkles,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';
import QRCode from 'qrcode';
import { Patient, Medication, VitalsEntry, LabScan, FollowUpEntry } from '../../types/pharmacy';
import {
  evaluateClinicalSafetyRadar,
  getEvidenceBasedCompanion,
  getDrugScheduleSuggestion,
  resolveGenericDrug,
} from '../../data/drugDatabase';
import {
  formatYMD,
  formatPhoneForWhatsApp,
  executeUniversalSMS,
  calculatePatientAge,
  generateThermalSlipText,
} from '../../utils/pharmacyCalculations';
import { extractPrescriptionWithAI } from '../../services/apiService';
import { PatientAdherenceVitalsChart } from '../charts/PatientAdherenceVitalsChart';

interface PatientDossierModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: Patient | null;
  initialTab?: string;
  followUps?: FollowUpEntry[];
  pharmacyName: string;
  gasUrl: string;
  lang: 'ar' | 'en';
  onSavePatient: (patient: Patient) => void;
  onDeletePatient?: (patientId: string) => void;
  onOpenHouseholdModal: (familyTag: string) => void;
  onOpenNewFollowUp?: () => void;
  onShowToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const PatientDossierModal: React.FC<PatientDossierModalProps> = ({
  isOpen,
  onClose,
  patient,
  initialTab = 'demographics',
  followUps = [],
  pharmacyName,
  gasUrl,
  lang,
  onSavePatient,
  onDeletePatient,
  onOpenHouseholdModal,
  onOpenNewFollowUp,
  onShowToast,
}) => {
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Form state
  const [formData, setFormData] = useState<Patient>({
    id: '',
    name: '',
    phone: '',
    dob: '',
    age: 0,
    gender: 'M',
    familyTag: '',
    loyaltyPoints: 0,
    allergies: '',
    notes: '',
    medications: [],
    vitals: [],
    scans: [],
    createdAt: new Date().toISOString(),
    isArchived: false,
  });

  // Vitals inputs
  const [newSys, setNewSys] = useState('');
  const [newDia, setNewDia] = useState('');
  const [newSugar, setNewSugar] = useState('');
  const [newMisc, setNewMisc] = useState('');

  // Thermal QR code
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  // Scan upload
  const [isUploadingScan, setIsUploadingScan] = useState(false);
  const [isExtractingOCR, setIsExtractingOCR] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    if (patient) {
      setFormData({
        ...patient,
        medications: patient.medications ? [...patient.medications] : [],
        vitals: patient.vitals ? [...patient.vitals] : [],
        scans: patient.scans ? [...patient.scans] : [],
      });
    } else {
      setFormData({
        id: 'PT-' + Date.now().toString().slice(-6),
        name: '',
        phone: '',
        dob: '',
        age: 0,
        gender: 'M',
        familyTag: '',
        loyaltyPoints: 0,
        allergies: '',
        notes: '',
        medications: [
          {
            name: '',
            lastDispenseDate: formatYMD(new Date()),
            daysSupply: 30,
            timing: 'morning',
            mealRelation: 'after_meal',
          },
        ],
        vitals: [],
        scans: [],
        createdAt: new Date().toISOString(),
        isArchived: false,
      });
    }

    setActiveTab(initialTab || 'demographics');
  }, [patient, isOpen, initialTab]);

  // Generate QR Code when thermal slip tab is opened
  useEffect(() => {
    if (activeTab === 'thermal' && formData.name) {
      const summary = `PATIENT: ${formData.name} | TEL: ${formData.phone} | MEDS: ${(formData.medications || []).map(m => m.name).join(', ')}`;
      QRCode.toDataURL(summary, { margin: 1, width: 140 }, (err, url) => {
        if (!err && url) setQrDataUrl(url);
      });
    }
  }, [activeTab, formData]);

  if (!isOpen) return null;

  // Real-time radar alerts
  const radarAlerts = evaluateClinicalSafetyRadar(formData.medications);

  const handleDobChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const age = calculatePatientAge(val);
    setFormData(prev => ({ ...prev, dob: val, age }));
  };

  const handleAddMedication = () => {
    setFormData(prev => ({
      ...prev,
      medications: [
        ...prev.medications,
        {
          name: '',
          lastDispenseDate: formatYMD(new Date()),
          daysSupply: 30,
          timing: 'morning',
          mealRelation: 'after_meal',
        },
      ],
    }));
  };

  const handleRemoveMedication = (index: number) => {
    setFormData(prev => ({
      ...prev,
      medications: prev.medications.filter((_, i) => i !== index),
    }));
  };

  const handleMedChange = (index: number, field: keyof Medication, val: any) => {
    setFormData(prev => {
      const copy = [...prev.medications];
      copy[index] = { ...copy[index], [field]: val };

      if (field === 'name' && val) {
        const suggestion = getDrugScheduleSuggestion(val);
        copy[index].timing = suggestion.timing;
        copy[index].mealRelation = suggestion.mealRelation;
      }
      return { ...prev, medications: copy };
    });
  };

  const handleAddVitals = () => {
    if (!newSys && !newSugar) {
      onShowToast(lang === 'ar' ? 'يرجى إدخال الضغط أو السكر على الأقل' : 'Enter BP or Glucose', 'error');
      return;
    }

    const sysNum = parseInt(newSys, 10);
    const diaNum = parseInt(newDia, 10);
    const sugarNum = parseInt(newSugar, 10);

    const bpStr = newSys && newDia ? `${newSys}/${newDia}` : newSys ? `${newSys}/—` : '—';
    const entry: VitalsEntry = {
      id: 'v-' + Date.now(),
      date: new Date().toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US'),
      bp: bpStr,
      systolic: isNaN(sysNum) ? undefined : sysNum,
      diastolic: isNaN(diaNum) ? undefined : diaNum,
      sugar: newSugar || '—',
      glucose: isNaN(sugarNum) ? undefined : sugarNum,
      misc: newMisc || 'قراءة روتينية',
      assessment:
        sysNum && sysNum >= 140
          ? 'ضغط مرتفع (يحتاج متابعة)'
          : sugarNum && sugarNum >= 180
          ? 'سكر مرتفع (يحتاج ضبط)'
          : 'ضمن النطاق المقبول',
    };

    setFormData(prev => ({
      ...prev,
      vitals: [entry, ...(prev.vitals || [])],
    }));

    setNewSys('');
    setNewDia('');
    setNewSugar('');
    setNewMisc('');
    onShowToast(lang === 'ar' ? 'تم تسجيل القراءة الحيوية بنجاح' : 'Vitals logged', 'success');
  };

  const handleScanUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingScan(true);
    const reader = new FileReader();
    reader.onload = async evt => {
      const base64 = evt.target?.result as string;

      // Add local scan
      const newScan: LabScan = {
        id: 's-' + Date.now(),
        date: new Date().toLocaleDateString(),
        title: file.name,
        dataUrl: base64,
      };

      setFormData(prev => ({
        ...prev,
        scans: [newScan, ...(prev.scans || [])],
      }));

      setIsUploadingScan(false);
      onShowToast(lang === 'ar' ? 'تم حفظ صورة التحليل / الوصفة بنجاح' : 'Prescription image attached', 'success');

      // Attempt AI extraction
      handleRunOCR(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleRunOCR = async (imageBase64: string) => {
    setIsExtractingOCR(true);
    try {
      const res = await extractPrescriptionWithAI(imageBase64);
      if (res && res.success) {
        if (res.medications && res.medications.length > 0) {
          const extractedMeds: Medication[] = res.medications.map((m: any) => ({
            name: m.name + (m.dosage ? ` ${m.dosage}` : ''),
            lastDispenseDate: formatYMD(new Date()),
            daysSupply: m.durationDays || 30,
            dosage: m.dosage,
            timing: 'morning',
            mealRelation: 'after_meal',
          }));

          setFormData(prev => ({
            ...prev,
            medications: [...prev.medications.filter(m => m.name.trim()), ...extractedMeds],
          }));
        }

        if (res.extractedVitals && (res.extractedVitals.systolic || res.extractedVitals.bloodGlucose)) {
          const v = res.extractedVitals;
          setFormData(prev => ({
            ...prev,
            vitals: [
              {
                id: 'v-ocr-' + Date.now(),
                date: new Date().toLocaleDateString(),
                bp: v.systolic && v.diastolic ? `${v.systolic}/${v.diastolic}` : '—',
                sugar: v.bloodGlucose || '—',
                misc: `Creatinine: ${v.creatinine || '—'} | HbA1c: ${v.hba1c || '—'}`,
                assessment: 'مستخرج آلياً من الوصفة/التحليل',
              },
              ...(prev.vitals || []),
            ],
          }));
        }

        onShowToast(
          lang === 'ar'
            ? 'نجح الذكاء الاصطناعي في قراءة واستخراج الأدوية والتحاليل من الصورة!'
            : 'AI successfully extracted prescription & lab data!',
          'success'
        );
      }
    } catch (err) {
      console.warn('OCR error:', err);
    } finally {
      setIsExtractingOCR(false);
    }
  };

  const handleSave = () => {
    if (!formData.name.trim()) {
      setActiveTab('demographics');
      onShowToast(lang === 'ar' ? 'يرجى إدخال اسم المريض' : 'Please enter patient name', 'error');
      return;
    }
    if (!formData.phone.trim()) {
      setActiveTab('demographics');
      onShowToast(lang === 'ar' ? 'يرجى إدخال رقم الهاتف' : 'Please enter phone number', 'error');
      return;
    }

    const cleanMeds = formData.medications.filter(m => m.name.trim());
    const finalPatient: Patient = {
      ...formData,
      medications: cleanMeds,
    };

    onSavePatient(finalPatient);
    onClose();
  };

  const thermalSlipText = generateThermalSlipText(formData, pharmacyName);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-[#1f1f1f] light:bg-white border border-[#383838] light:border-neutral-200 rounded-2xl max-w-4xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Top Header */}
        <div className="p-4 bg-[#292929] light:bg-neutral-100 border-b border-[#383838] flex items-center justify-between">
          <div className="font-extrabold text-base text-white light:text-neutral-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-400" />
            <span>
              {formData.name
                ? `${lang === 'ar' ? 'الملف السريري:' : 'Clinical Dossier:'} ${formData.name}`
                : lang === 'ar'
                ? 'تسجيل مريض مزمن جديد'
                : 'New Chronic Patient Dossier'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dossier Tabs */}
        <div className="bg-[#191919] light:bg-neutral-200 border-b border-[#383838] px-4 flex items-center gap-1 overflow-x-auto text-xs font-semibold">
          {[
            { id: 'demographics', labelAr: '1. البيانات والعائلة', labelEn: '1. Demographics' },
            { id: 'regimen', labelAr: '2. الأدوية والسلامة', labelEn: '2. Regimen & Safety' },
            { id: 'analytics', labelAr: '3. مخطط الالتزام والمؤشرات 📈', labelEn: '3. Adherence & Vitals Chart 📈' },
            { id: 'vitals', labelAr: '4. سجل الضغط والسكر', labelEn: '4. Vitals & Labs' },
            { id: 'scans', labelAr: '5. التحاليل والـ OCR', labelEn: '5. Scans & AI OCR' },
            { id: 'schedule', labelAr: '6. جدول تناول الدواء', labelEn: '6. Pill Organizer' },
            { id: 'thermal', labelAr: '7. البطاقة الفورية', labelEn: '7. Thermal Pocket Slip' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-3 px-3 border-b-2 whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'border-[#479ef5] text-[#479ef5] bg-[#292929]/40 font-bold'
                  : 'border-transparent text-neutral-400 hover:text-white'
              }`}
            >
              {lang === 'ar' ? tab.labelAr : tab.labelEn}
            </button>
          ))}
        </div>

        {/* Tab Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs flex-1">
          {/* TAB: RECHARTS LONGITUDINAL ADHERENCE & VITALS VISUALIZATION */}
          {activeTab === 'analytics' && (
            <PatientAdherenceVitalsChart
              patient={formData}
              followUps={followUps}
              lang={lang}
              onOpenNewFollowUp={() => {
                onClose();
                if (onOpenNewFollowUp) onOpenNewFollowUp();
              }}
              onShowToast={onShowToast}
            />
          )}

          {/* TAB 1: DEMOGRAPHICS */}
          {activeTab === 'demographics' && (
            <div className="space-y-4">
              {/* Family Alignment Notification Banner */}
              {formData.familyTag && (
                <div className="bg-blue-950/40 border border-blue-600/50 p-3.5 rounded-xl flex items-center justify-between gap-3">
                  <div>
                    <div className="font-bold text-sm text-blue-300 flex items-center gap-1.5">
                      <span>👨‍👩‍👧‍👦</span>
                      <span>{lang === 'ar' ? 'المريض مرتبط بعائلة:' : 'Linked Family:'} {formData.familyTag}</span>
                    </div>
                    <div className="text-[11px] text-neutral-300 mt-0.5">
                      {lang === 'ar'
                        ? 'يمكنك توحيد مواعيد صرف وصيدلية أفراد العائلة في رحلة واحدة وحساب الحبات الناقصة.'
                        : 'Coordinate refills for the entire family in one visit using bridge dose calculation.'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenHouseholdModal(formData.familyTag!);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-sm transition-colors whitespace-nowrap"
                  >
                    {lang === 'ar' ? 'توحيد صرف العائلة ⚡' : 'Household Sync ⚡'}
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-semibold text-neutral-300 light:text-neutral-700">
                    {lang === 'ar' ? 'الاسم الكامل للمريض *' : 'Full Name *'}
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="مثال: أحمد عبد الله الجبوري"
                    className="w-full bg-[#141414] light:bg-neutral-50 border border-[#383838] text-white light:text-neutral-900 rounded-lg p-2.5 outline-none focus:border-blue-500 font-semibold"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-neutral-300 light:text-neutral-700">
                    {lang === 'ar' ? 'رقم الهاتف (مع رمز الدولة لـ WhatsApp / SMS) *' : 'Phone (WhatsApp/SMS) *'}
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="07700000000 أو 9647700000000"
                    className="w-full bg-[#141414] light:bg-neutral-50 border border-[#383838] text-white light:text-neutral-900 rounded-lg p-2.5 outline-none focus:border-blue-500 font-mono"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-neutral-300 light:text-neutral-700">
                    {lang === 'ar' ? 'تاريخ الميلاد' : 'Date of Birth'}
                  </label>
                  <input
                    type="date"
                    value={formData.dob || ''}
                    onChange={handleDobChange}
                    className="w-full bg-[#141414] light:bg-neutral-50 border border-[#383838] text-white light:text-neutral-900 rounded-lg p-2.5 outline-none focus:border-blue-500 font-mono"
                  />
                  {formData.age ? (
                    <span className="text-[11px] text-blue-400 font-semibold">
                      {lang === 'ar' ? `العمر المحسوب: ${formData.age} سنة` : `Age: ${formData.age} years`}
                    </span>
                  ) : null}
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-neutral-300 light:text-neutral-700">
                    {lang === 'ar' ? 'الجنس' : 'Gender'}
                  </label>
                  <select
                    value={formData.gender || 'M'}
                    onChange={e => setFormData({ ...formData, gender: e.target.value as any })}
                    className="w-full bg-[#141414] light:bg-neutral-50 border border-[#383838] text-white light:text-neutral-900 rounded-lg p-2.5 outline-none focus:border-blue-500"
                  >
                    <option value="M">{lang === 'ar' ? 'ذكر' : 'Male'}</option>
                    <option value="F">{lang === 'ar' ? 'أنثى' : 'Female'}</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-neutral-300 light:text-neutral-700">
                    {lang === 'ar' ? 'رمز العائلة (Family Tag)' : 'Family Tag'}
                  </label>
                  <input
                    type="text"
                    value={formData.familyTag || ''}
                    onChange={e => setFormData({ ...formData, familyTag: e.target.value })}
                    placeholder="مثال: عائلة_الجبوري"
                    className="w-full bg-[#141414] light:bg-neutral-50 border border-[#383838] text-white light:text-neutral-900 rounded-lg p-2.5 outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-neutral-300 light:text-neutral-700">
                    {lang === 'ar' ? 'نقاط الولاء (Loyalty Points)' : 'Loyalty Points'}
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={formData.loyaltyPoints || 0}
                    onChange={e => setFormData({ ...formData, loyaltyPoints: parseInt(e.target.value, 10) || 0 })}
                    className="w-full bg-[#141414] light:bg-neutral-50 border border-[#383838] text-white light:text-neutral-900 rounded-lg p-2.5 outline-none focus:border-blue-500 font-mono font-bold"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-rose-400">
                  {lang === 'ar' ? 'الحساسيات الدوائية المعروفة (Allergies)' : 'Known Drug Allergies'}
                </label>
                <input
                  type="text"
                  value={formData.allergies || ''}
                  onChange={e => setFormData({ ...formData, allergies: e.target.value })}
                  placeholder="مثال: Penicillin, Sulfa, Aspirin..."
                  className="w-full bg-[#141414] light:bg-neutral-50 border border-rose-900/50 text-rose-300 rounded-lg p-2.5 outline-none focus:border-rose-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-neutral-300 light:text-neutral-700">
                  {lang === 'ar' ? 'التاريخ المرضي والملاحظات السريرية' : 'Clinical History & Medical Notes'}
                </label>
                <textarea
                  rows={3}
                  value={formData.notes || ''}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="تاريخ الإصابة، أمراض مصاحبة (فشل كلوي، ذبحة صدرية، ربو)..."
                  className="w-full bg-[#141414] light:bg-neutral-50 border border-[#383838] text-white light:text-neutral-900 rounded-lg p-2.5 outline-none focus:border-blue-500"
                />
              </div>
            </div>
          )}

          {/* TAB 2: REGIMEN & SAFETY */}
          {activeTab === 'regimen' && (
            <div className="space-y-4">
              {/* Radar Alerts */}
              {radarAlerts.length > 0 && (
                <div className="space-y-2">
                  {radarAlerts.map((a, i) => (
                    <div
                      key={i}
                      className="p-3.5 rounded-xl bg-rose-950/40 border-2 border-rose-600 text-rose-200 text-xs space-y-1"
                    >
                      <div className="font-extrabold flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-rose-400" />
                        <span>{a.title}</span>
                      </div>
                      <div>{a.detail}</div>
                      {a.recommendation && (
                        <div className="text-emerald-400 font-bold text-[11px] mt-1">
                          الإجراء المقترح: {a.recommendation}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Evidence Based Companions */}
              <div className="space-y-2">
                {formData.medications.map((m, idx) => {
                  const comp = getEvidenceBasedCompanion(resolveGenericDrug(m.name));
                  if (!comp) return null;
                  return (
                    <div
                      key={idx}
                      className="p-3 rounded-lg bg-blue-950/30 border border-blue-600/40 flex items-center justify-between gap-3"
                    >
                      <div>
                        <div className="font-bold text-blue-300 text-xs">
                          💡 مكمل سريري مقترح لـ ({m.name}): {comp.title}
                        </div>
                        <div className="text-[11px] text-neutral-300 mt-0.5">{comp.rationale}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onShowToast(lang === 'ar' ? 'تم تدوين التوصية للمريض' : 'Companion noted', 'info')}
                        className="px-2.5 py-1 rounded bg-blue-600 text-white font-bold text-[11px] shrink-0"
                      >
                        إضافة للتوصية
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Meds List header */}
              <div className="flex items-center justify-between pt-2">
                <span className="font-bold text-sm text-white light:text-neutral-900">
                  {lang === 'ar' ? 'الأدوية المزمنة المقررة:' : 'Prescribed Chronic Regimen:'}
                </span>
                <button
                  type="button"
                  onClick={handleAddMedication}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{lang === 'ar' ? 'إضافة دواء' : 'Add Medication'}</span>
                </button>
              </div>

              {/* Meds items */}
              <div className="space-y-2">
                {formData.medications.map((m, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-[#141414] light:bg-neutral-50 border border-[#2e2e2e] light:border-neutral-200 grid grid-cols-1 sm:grid-cols-12 gap-2 items-center"
                  >
                    <div className="sm:col-span-5 space-y-1">
                      <label className="text-[10px] text-neutral-400">{lang === 'ar' ? 'اسم الدواء (العلامة التجارية)' : 'Brand Name'}</label>
                      <input
                        type="text"
                        value={m.name}
                        onChange={e => handleMedChange(idx, 'name', e.target.value)}
                        placeholder="Glucophage, Concor, Lipitor..."
                        className="w-full bg-[#1f1f1f] light:bg-white border border-[#383838] p-2 rounded-lg text-white light:text-neutral-900 font-bold text-xs outline-none focus:border-blue-500"
                      />
                    </div>

                    <div className="sm:col-span-3 space-y-1">
                      <label className="text-[10px] text-neutral-400">{lang === 'ar' ? 'تاريخ آخر صرف' : 'Last Dispense'}</label>
                      <input
                        type="date"
                        value={m.lastDispenseDate}
                        onChange={e => handleMedChange(idx, 'lastDispenseDate', e.target.value)}
                        className="w-full bg-[#1f1f1f] light:bg-white border border-[#383838] p-2 rounded-lg text-white light:text-neutral-900 text-xs font-mono outline-none focus:border-blue-500"
                      />
                    </div>

                    <div className="sm:col-span-3 space-y-1">
                      <label className="text-[10px] text-neutral-400">{lang === 'ar' ? 'الكمية (أيام / حبات)' : 'Supply (Days/Tabs)'}</label>
                      <input
                        type="number"
                        min={1}
                        max={365}
                        value={m.daysSupply}
                        onChange={e => handleMedChange(idx, 'daysSupply', parseInt(e.target.value, 10) || 30)}
                        className="w-full bg-[#1f1f1f] light:bg-white border border-[#383838] p-2 rounded-lg text-white light:text-neutral-900 text-xs font-bold text-center outline-none focus:border-blue-500"
                      />
                    </div>

                    <div className="sm:col-span-1 flex justify-end pt-4">
                      <button
                        type="button"
                        onClick={() => handleRemoveMedication(idx)}
                        className="p-1.5 rounded-lg text-neutral-400 hover:text-rose-400 hover:bg-neutral-800 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: VITALS */}
          {activeTab === 'vitals' && (
            <div className="space-y-4">
              <div className="bg-[#141414] light:bg-neutral-50 p-4 rounded-xl border border-[#2e2e2e] light:border-neutral-200 space-y-3">
                <div className="font-bold text-sm text-white light:text-neutral-900 flex items-center gap-2">
                  <HeartPulse className="w-4 h-4 text-rose-400" />
                  <span>{lang === 'ar' ? 'تسجيل قراءة سريرية حية جديدة' : 'Record New Vital Signs'}</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] text-neutral-400 font-semibold">{lang === 'ar' ? 'الانقباضي (Systolic)' : 'Systolic'}</label>
                    <input
                      type="number"
                      placeholder="120"
                      value={newSys}
                      onChange={e => setNewSys(e.target.value)}
                      className="w-full bg-[#1f1f1f] light:bg-white border border-[#383838] p-2 rounded-lg text-white light:text-neutral-900 text-xs text-center font-mono font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-neutral-400 font-semibold">{lang === 'ar' ? 'الانبساطي (Diastolic)' : 'Diastolic'}</label>
                    <input
                      type="number"
                      placeholder="80"
                      value={newDia}
                      onChange={e => setNewDia(e.target.value)}
                      className="w-full bg-[#1f1f1f] light:bg-white border border-[#383838] p-2 rounded-lg text-white light:text-neutral-900 text-xs text-center font-mono font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-neutral-400 font-semibold">{lang === 'ar' ? 'السكر (mg/dL)' : 'Glucose'}</label>
                    <input
                      type="number"
                      placeholder="110"
                      value={newSugar}
                      onChange={e => setNewSugar(e.target.value)}
                      className="w-full bg-[#1f1f1f] light:bg-white border border-[#383838] p-2 rounded-lg text-white light:text-neutral-900 text-xs text-center font-mono font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-neutral-400 font-semibold">{lang === 'ar' ? 'HbA1c / نبض / وزن' : 'HbA1c / Pulse'}</label>
                    <input
                      type="text"
                      placeholder="HbA1c: 6.8% / 72 bpm"
                      value={newMisc}
                      onChange={e => setNewMisc(e.target.value)}
                      className="w-full bg-[#1f1f1f] light:bg-white border border-[#383838] p-2 rounded-lg text-white light:text-neutral-900 text-xs"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAddVitals}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-sm transition-colors"
                >
                  {lang === 'ar' ? '🩺 حفظ القراءة السريرية' : 'Log Clinical Entry'}
                </button>
              </div>

              {/* Vitals History Table */}
              <div className="border border-[#383838] rounded-xl overflow-hidden">
                <table className="w-full text-right dir-rtl text-xs">
                  <thead className="bg-[#292929] light:bg-neutral-100 text-neutral-300 font-bold border-b border-[#383838]">
                    <tr>
                      <th className="py-2.5 px-3">{lang === 'ar' ? 'التاريخ' : 'Date'}</th>
                      <th className="py-2.5 px-3">{lang === 'ar' ? 'ضغط الدم (BP)' : 'BP'}</th>
                      <th className="py-2.5 px-3">{lang === 'ar' ? 'السكر (mg/dL)' : 'Sugar'}</th>
                      <th className="py-2.5 px-3">{lang === 'ar' ? 'مؤشرات إضافية' : 'Misc'}</th>
                      <th className="py-2.5 px-3">{lang === 'ar' ? 'التقييم' : 'Assessment'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2e2e2e] text-neutral-200">
                    {(formData.vitals || []).length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-8 text-neutral-400">
                          {lang === 'ar' ? 'لا توجد قراءات سابقة مسجلة.' : 'No recorded vitals yet.'}
                        </td>
                      </tr>
                    ) : (
                      formData.vitals!.map((v, i) => (
                        <tr key={i} className="hover:bg-neutral-800/30">
                          <td className="py-2.5 px-3 font-mono text-neutral-400">{v.date}</td>
                          <td className="py-2.5 px-3 font-bold font-mono text-blue-400">{v.bp}</td>
                          <td className="py-2.5 px-3 font-mono font-bold text-amber-400">{v.sugar}</td>
                          <td className="py-2.5 px-3 text-neutral-300">{v.misc}</td>
                          <td className="py-2.5 px-3">
                            <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/40">
                              {v.assessment || 'مستقر'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: SCANS & AI OCR */}
          {activeTab === 'scans' && (
            <div className="space-y-4">
              <div className="bg-[#141414] light:bg-neutral-50 p-4 rounded-xl border border-[#2e2e2e] light:border-neutral-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-sm text-white light:text-neutral-900 flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-blue-400" />
                    <span>{lang === 'ar' ? 'رفع صورة التحليل أو الوصفة الطبية (مع OCR ذكي)' : 'Upload Lab Scan or Rx (with AI OCR)'}</span>
                  </div>
                  {isExtractingOCR && (
                    <span className="text-xs text-indigo-400 font-bold flex items-center gap-1.5 animate-pulse">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{lang === 'ar' ? 'جارِ التحليل والتعرف الذكي عبر Gemini...' : 'Extracting with Gemini...'}</span>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleScanUpload}
                    className="block w-full text-xs text-neutral-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500 cursor-pointer"
                  />
                </div>
                <div className="text-[11px] text-neutral-400">
                  {lang === 'ar'
                    ? 'يقوم الذكاء الاصطناعي تلقائياً بقراءة أسماء الأدوية المكتوبة بخط اليد وقيم التحاليل وإضافتها لملف المريض.'
                    : 'Gemini AI automatically transcribes prescriptions and lab reports into structured records.'}
                </div>
              </div>

              {/* Gallery */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {(formData.scans || []).map((s, i) => (
                  <div
                    key={i}
                    className="border border-[#383838] rounded-xl overflow-hidden bg-[#141414] group relative"
                  >
                    <img src={s.dataUrl} alt={s.title} className="w-full h-32 object-cover" />
                    <div className="p-2 text-[11px] text-neutral-300 flex items-center justify-between">
                      <span className="truncate">{s.title || s.date}</span>
                      {s.driveUrl && (
                        <a
                          href={s.driveUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-400 hover:underline flex items-center gap-0.5"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: PILL SCHEDULE ORGANIZER */}
          {activeTab === 'schedule' && (
            <div className="space-y-4">
              <div className="bg-[#141414] light:bg-neutral-50 p-4 rounded-xl border border-[#2e2e2e] light:border-neutral-200">
                <div className="font-bold text-sm text-white light:text-neutral-900 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-400" />
                  <span>{lang === 'ar' ? 'جدول المواعيد وعلاقة الدواء بوجبات الطعام (Pill Organizer)' : 'Daily Medication Schedule'}</span>
                </div>
                <p className="text-xs text-neutral-400 mt-1">
                  {lang === 'ar'
                    ? 'تنظيم أوقات تناول الأدوية وتفادي تعارض امتصاصها مع الطعام.'
                    : 'Synchronized daily dosing instructions.'}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Morning */}
                <div className="bg-[#141414] p-3.5 rounded-xl border border-[#2e2e2e] space-y-2">
                  <div className="font-bold text-amber-400 flex items-center gap-1.5 text-xs">
                    <span>☀️</span>
                    <span>{lang === 'ar' ? 'الصباح / الإفطار' : 'Morning / Breakfast'}</span>
                  </div>
                  <div className="space-y-1 text-xs">
                    {formData.medications
                      .filter(m => m.timing === 'morning' || m.timing === 'bid' || !m.timing)
                      .map((m, i) => (
                        <div key={i} className="p-2 rounded bg-[#1f1f1f] border border-[#383838]">
                          <strong className="text-white block">{m.name}</strong>
                          <span className="text-[10px] text-neutral-400">
                            {m.mealRelation === 'before_meal' ? 'قبل الإفطار بـ 30 دقيقة' : 'مع أو بعد الإفطار'}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Noon */}
                <div className="bg-[#141414] p-3.5 rounded-xl border border-[#2e2e2e] space-y-2">
                  <div className="font-bold text-blue-400 flex items-center gap-1.5 text-xs">
                    <span>🌤️</span>
                    <span>{lang === 'ar' ? 'الظهيرة / الغداء' : 'Noon / Lunch'}</span>
                  </div>
                  <div className="space-y-1 text-xs">
                    {formData.medications
                      .filter(m => m.timing === 'noon')
                      .map((m, i) => (
                        <div key={i} className="p-2 rounded bg-[#1f1f1f] border border-[#383838]">
                          <strong className="text-white block">{m.name}</strong>
                          <span className="text-[10px] text-neutral-400">بعد الغداء</span>
                        </div>
                      ))}
                    {formData.medications.filter(m => m.timing === 'noon').length === 0 && (
                      <span className="text-neutral-500 text-[11px]">لا توجد جرعات ظهيرة</span>
                    )}
                  </div>
                </div>

                {/* Evening */}
                <div className="bg-[#141414] p-3.5 rounded-xl border border-[#2e2e2e] space-y-2">
                  <div className="font-bold text-orange-400 flex items-center gap-1.5 text-xs">
                    <span>🌅</span>
                    <span>{lang === 'ar' ? 'المساء / العشاء' : 'Evening / Dinner'}</span>
                  </div>
                  <div className="space-y-1 text-xs">
                    {formData.medications
                      .filter(m => m.timing === 'bid' || m.timing === 'evening')
                      .map((m, i) => (
                        <div key={i} className="p-2 rounded bg-[#1f1f1f] border border-[#383838]">
                          <strong className="text-white block">{m.name}</strong>
                          <span className="text-[10px] text-neutral-400">مع العشاء</span>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Bedtime */}
                <div className="bg-[#141414] p-3.5 rounded-xl border border-[#2e2e2e] space-y-2">
                  <div className="font-bold text-indigo-400 flex items-center gap-1.5 text-xs">
                    <span>🌙</span>
                    <span>{lang === 'ar' ? 'قبل النوم' : 'Bedtime'}</span>
                  </div>
                  <div className="space-y-1 text-xs">
                    {formData.medications
                      .filter(m => m.timing === 'bedtime')
                      .map((m, i) => (
                        <div key={i} className="p-2 rounded bg-[#1f1f1f] border border-[#383838]">
                          <strong className="text-white block">{m.name}</strong>
                          <span className="text-[10px] text-neutral-400">قبل النوم مباشرة</span>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: POCKET THERMAL SLIP */}
          {activeTab === 'thermal' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="font-bold text-sm text-white light:text-neutral-900">
                  {lang === 'ar' ? 'البطاقة الطبية الفورية (Pocket Thermal Slip & QR)' : 'Pocket Thermal Slip & QR'}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(thermalSlipText);
                      onShowToast(lang === 'ar' ? 'تم نسخ نص البطاقة الطبية' : 'Copied slip', 'success');
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{lang === 'ar' ? 'نسخ النص' : 'Copy'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const clean = formatPhoneForWhatsApp(formData.phone);
                      window.open(`https://wa.me/${clean}?text=${encodeURIComponent(thermalSlipText)}`, '_blank');
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>WhatsApp</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>{lang === 'ar' ? 'طباعة إيصال' : 'Print Slip'}</span>
                  </button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 items-start">
                <pre
                  id="thermal-slip-print"
                  className="flex-1 bg-white text-black p-4 font-mono text-xs rounded-lg border border-neutral-300 shadow-inner overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-[380px]"
                >
                  {thermalSlipText}
                </pre>

                {qrDataUrl && (
                  <div className="bg-white p-3 rounded-lg border border-neutral-300 flex flex-col items-center gap-2 shrink-0">
                    <img src={qrDataUrl} alt="Patient QR Code" className="w-28 h-28" />
                    <span className="text-[10px] text-neutral-700 font-mono font-bold">
                      {formData.name.split(' ')[0]} - QR
                    </span>
                  </div>
                )}
              </div>

              {/* Danger Zone: Permanent Patient Deletion */}
              {patient?.id && (
                <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-800/40 space-y-3 mt-6">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2 text-rose-400 font-bold text-xs">
                      <ShieldAlert className="w-4 h-4 text-rose-400" />
                      <span>{lang === 'ar' ? 'منطقة العمليات الحساسة (Danger Zone)' : 'Danger Zone'}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(true)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>{lang === 'ar' ? 'حذف ملف المريض نهائياً' : 'Delete Patient Permanently'}</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-neutral-300 leading-relaxed">
                    {lang === 'ar'
                      ? 'سيؤدي حذف هذا الملف إلى إزالة كافة بيانات المريض وقائمة أدويته وسجلات الضغط والسكر والمتابعات السريرية المرتبطة به نهائياً.'
                      : 'Deleting this patient will permanently remove their records, active regimens, vitals logs, and linked clinical follow-ups.'}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Bottom Footer */}
        <div className="p-4 bg-[#292929] light:bg-neutral-100 border-t border-[#383838] flex items-center justify-between gap-3">
          {patient?.id && activeTab === 'thermal' ? (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/50 text-xs font-semibold transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4 text-rose-400" />
              <span>{lang === 'ar' ? 'حذف المريض' : 'Delete Patient'}</span>
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold transition-colors"
            >
              {lang === 'ar' ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 rounded-lg bg-[#0f6cbd] hover:bg-[#115ea3] text-white text-xs font-bold shadow-md transition-colors cursor-pointer"
            >
              {lang === 'ar' ? '💾 حفظ الملف السريري' : 'Save Dossier'}
            </button>
          </div>
        </div>
      </div>

      {/* Permanent Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#1f1f1f] border border-rose-800/60 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-2.5 rounded-full bg-rose-950/60 border border-rose-800/60">
                <AlertTriangle className="w-6 h-6 text-rose-400" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-white">
                  {lang === 'ar' ? 'تأكيد حذف ملف المريض نهائياً' : 'Confirm Permanent Deletion'}
                </h3>
                <span className="text-[11px] text-neutral-400">
                  {formData.name} ({formData.phone})
                </span>
              </div>
            </div>

            <p className="text-xs text-neutral-300 leading-relaxed bg-[#141414] p-3 rounded-lg border border-neutral-800">
              {lang === 'ar'
                ? 'هل أنت متأكد من رغبتك في حذف هذا الملف بشكل نهائي؟ سيتم حذف جميع بيانات المريض، والأدوية المزمنة، وسجلات الضغط والسكر، والمتابعات السريرية المرتبطة به ولا يمكن استرجاعها.'
                : 'Are you sure you want to permanently delete this patient dossier? All personal data, chronic medications, vitals history, and clinical follow-ups will be permanently deleted.'}
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold transition-colors"
              >
                {lang === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  if (onDeletePatient && patient?.id) {
                    onDeletePatient(patient.id);
                  }
                  onClose();
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>{lang === 'ar' ? 'نعم، حذف نهائي' : 'Yes, Delete Permanently'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
