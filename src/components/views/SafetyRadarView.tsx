import React, { useState } from 'react';
import {
  ShieldAlert,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Pill,
  Apple,
  HeartPulse,
  Brain,
} from 'lucide-react';
import { Patient, InteractionAlert } from '../../types/pharmacy';
import { evaluateClinicalSafetyRadar, getEvidenceBasedCompanion, resolveGenericDrug } from '../../data/drugDatabase';
import { auditRegimenWithAI } from '../../services/apiService';

interface SafetyRadarViewProps {
  patients: Patient[];
  lang: 'ar' | 'en';
  onShowToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  onOpenPatientModal: (patientId: string, tab?: string) => void;
}

export const SafetyRadarView: React.FC<SafetyRadarViewProps> = ({
  patients,
  lang,
  onShowToast,
  onOpenPatientModal,
}) => {
  const [selectedPatientId, setSelectedPatientId] = useState<string>(patients[0]?.id || '');
  const [isAuditingAI, setIsAuditingAI] = useState(false);
  const [aiAuditResult, setAiAuditResult] = useState<any | null>(null);

  // Custom drug simulator
  const [simulatorMeds, setSimulatorMeds] = useState<string>('Metformin, Diovan, Lasix, Voltaren');

  const selectedPatient = patients.find(p => p.id === selectedPatientId);

  // Evaluate clinical safety radar for selected patient
  const patientAlerts = selectedPatient
    ? evaluateClinicalSafetyRadar(selectedPatient.medications || [])
    : [];

  // Simulated alerts
  const simulatedMedsList = simulatorMeds
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(name => ({ name }));
  const simulatedAlerts = evaluateClinicalSafetyRadar(simulatedMedsList);

  const handleRunAIAudit = async () => {
    if (!selectedPatient) return;
    setIsAuditingAI(true);
    setAiAuditResult(null);

    try {
      const res = await auditRegimenWithAI({
        patientName: selectedPatient.name,
        age: selectedPatient.age,
        gender: selectedPatient.gender,
        allergies: selectedPatient.allergies,
        medicalHistory: selectedPatient.notes,
        medications: selectedPatient.medications || [],
        vitals: selectedPatient.vitals || [],
      });

      if (res && res.success) {
        setAiAuditResult(res);
        onShowToast(lang === 'ar' ? 'اكتمل التدقيق السريري الذكي بنجاح' : 'AI Regimen Audit completed', 'success');
      } else {
        onShowToast(lang === 'ar' ? 'تعذر تشغيل التدقيق السريري الذكي' : 'Could not run AI audit', 'error');
      }
    } catch (err) {
      onShowToast(lang === 'ar' ? 'حدث خطأ أثناء التواصل مع نموذج الذكاء الاصطناعي' : 'Error contacting AI model', 'error');
    } finally {
      setIsAuditingAI(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Intro card */}
      <div className="bg-[#1f1f1f] light:bg-white border border-[#383838] light:border-neutral-200 rounded-xl p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="font-extrabold text-lg text-white light:text-neutral-900 flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-rose-400" />
            <span>{lang === 'ar' ? 'رادار السلامة الدوائية المتقدم والتدقيق السريري بالذكاء الاصطناعي' : 'Clinical Safety Radar & AI Regimen Audit'}</span>
          </div>
          <span className="text-xs px-2.5 py-1 rounded bg-rose-950/60 text-rose-300 border border-rose-800 font-bold">
            Evidence-Based Rules + Gemini AI
          </span>
        </div>
        <p className="text-xs text-neutral-400 light:text-neutral-600 max-w-4xl leading-relaxed">
          {lang === 'ar'
            ? 'نظام كشف التداخلات الدوائية التلقائي (Drug-Drug Interactions)، ورصد متلازمة الضربة الثلاثية (Triple Whammy)، وخطر انحلال العضلات مع الستاتين والماكروليد، ونزيف مضادات الصفيحات، بالإضافة لتوصيات المكملات التعويضية المثبتة سريرياً.'
            : 'Automated Drug-Drug Interaction detection, Triple Whammy AKI watch, Statin-Macrolide rhabdomyolysis prevention, and evidence-based companion supplement recommendations.'}
        </p>
      </div>

      {/* Patient selector & AI Audit */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-[#1f1f1f] light:bg-white border border-[#383838] light:border-neutral-200 rounded-xl p-5 shadow-sm space-y-4">
          <div className="font-bold text-sm text-white light:text-neutral-900 flex items-center gap-2">
            <HeartPulse className="w-4 h-4 text-blue-400" />
            <span>{lang === 'ar' ? 'اختر مريضاً لفحصه سريرياً' : 'Select Patient to Audit'}</span>
          </div>

          <select
            value={selectedPatientId}
            onChange={e => {
              setSelectedPatientId(e.target.value);
              setAiAuditResult(null);
            }}
            className="w-full bg-[#141414] light:bg-neutral-50 border border-[#383838] light:border-neutral-300 text-white light:text-neutral-900 text-xs rounded-lg p-2.5 outline-none focus:border-blue-500"
          >
            {patients.filter(p => !p.isArchived).map(p => (
              <option key={p.id} value={p.id}>
                {p.name} ({(p.medications || []).length} أدوية)
              </option>
            ))}
          </select>

          {selectedPatient && (
            <div className="bg-[#141414] light:bg-neutral-50 p-3.5 rounded-lg border border-[#2e2e2e] light:border-neutral-200 space-y-2 text-xs">
              <div>
                <span className="text-neutral-400">{lang === 'ar' ? 'الأدوية النشطة:' : 'Regimen:'}</span>
                <div className="font-bold text-white light:text-neutral-900 mt-1">
                  {(selectedPatient.medications || []).map(m => m.name).join(', ') || 'لا توجد أدوية'}
                </div>
              </div>

              {selectedPatient.allergies && (
                <div>
                  <span className="text-neutral-400">{lang === 'ar' ? 'الحساسيات:' : 'Allergies:'}</span>
                  <div className="text-rose-400 font-semibold">{selectedPatient.allergies}</div>
                </div>
              )}

              {selectedPatient.vitals && selectedPatient.vitals[0] && (
                <div>
                  <span className="text-neutral-400">{lang === 'ar' ? 'آخر علامات حيوية:' : 'Latest Vitals:'}</span>
                  <div className="text-blue-300 font-mono">
                    BP: {selectedPatient.vitals[0].bp} | Sugar: {selectedPatient.vitals[0].sugar} mg/dL
                  </div>
                </div>
              )}
            </div>
          )}

          <button
            onClick={handleRunAIAudit}
            disabled={isAuditingAI || !selectedPatient}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer disabled:opacity-50"
          >
            <Sparkles className={`w-4 h-4 ${isAuditingAI ? 'animate-spin' : ''}`} />
            <span>
              {isAuditingAI
                ? (lang === 'ar' ? 'جارِ فحص الجرعات والتداخلات بواسطة Gemini...' : 'Auditing with Gemini AI...')
                : (lang === 'ar' ? 'تشغيل التدقيق السريري الذكي بالـ AI' : 'Run AI Clinical Regimen Audit')}
            </span>
          </button>
        </div>

        {/* Results area */}
        <div className="lg:col-span-2 space-y-4">
          {/* Rule-based alerts */}
          <div className="bg-[#1f1f1f] light:bg-white border border-[#383838] light:border-neutral-200 rounded-xl p-5 shadow-sm space-y-3">
            <div className="font-bold text-sm text-white light:text-neutral-900 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span>{lang === 'ar' ? 'تنبيهات السلامة الفورية (Safety Radar)' : 'Immediate Rule-Based Alerts'}</span>
              </span>
              <span className="text-xs text-neutral-400">
                {patientAlerts.length} {lang === 'ar' ? 'تنبيه سريري' : 'alerts'}
              </span>
            </div>

            {patientAlerts.length === 0 ? (
              <div className="bg-emerald-950/20 border border-emerald-700/30 rounded-lg p-3.5 text-xs text-emerald-300 flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{lang === 'ar' ? 'لا توجد تعارضات حرجة واضحة بين الأدوية الحالية لهذا المريض.' : 'No major red-flag contraindications detected.'}</span>
              </div>
            ) : (
              patientAlerts.map((alert, idx) => (
                <div
                  key={idx}
                  className={`p-3.5 rounded-lg border text-xs space-y-1.5 ${
                    alert.type === 'danger'
                      ? 'bg-rose-950/30 border-rose-700/60 text-rose-200'
                      : 'bg-amber-950/30 border-amber-700/60 text-amber-200'
                  }`}
                >
                  <div className="font-bold flex items-center gap-2">
                    <span className="text-base">{alert.type === 'danger' ? '🚨' : '⚠️'}</span>
                    <span>{alert.title}</span>
                  </div>
                  <div className="text-neutral-300 light:text-neutral-700">{alert.detail}</div>
                  {alert.mechanism && (
                    <div className="text-[11px] text-neutral-400 font-mono bg-black/30 p-2 rounded">
                      <strong>Mechanism:</strong> {alert.mechanism}
                    </div>
                  )}
                  {alert.recommendation && (
                    <div className="text-emerald-400 font-semibold text-[11px]">
                      <strong>Pharmacist Action:</strong> {alert.recommendation}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* AI Clinical Audit Output */}
          {aiAuditResult && (
            <div className="bg-[#1f1f1f] light:bg-white border-2 border-indigo-500/50 rounded-xl p-5 shadow-lg space-y-4 animate-fade-in">
              <div className="flex items-center justify-between">
                <div className="font-extrabold text-sm text-indigo-300 light:text-indigo-800 flex items-center gap-2">
                  <Brain className="w-5 h-5 text-indigo-400" />
                  <span>{lang === 'ar' ? 'تقرير المستشار السريري الذكي (Gemini Clinical Report)' : 'Gemini AI Clinical Evaluation'}</span>
                </div>
                <span
                  className={`text-xs font-extrabold px-2.5 py-0.5 rounded ${
                    aiAuditResult.overallRiskScore === 'CRITICAL' || aiAuditResult.overallRiskScore === 'HIGH'
                      ? 'bg-rose-950 text-rose-400 border border-rose-800'
                      : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                  }`}
                >
                  Risk: {aiAuditResult.overallRiskScore || 'EVALUATED'}
                </span>
              </div>

              <div className="text-xs text-neutral-200 light:text-neutral-800 bg-[#141414] light:bg-neutral-50 p-3.5 rounded-lg border border-[#2e2e2e] leading-relaxed">
                <strong>{lang === 'ar' ? 'الملخص السريري:' : 'Clinical Summary:'}</strong>{' '}
                {lang === 'ar' ? aiAuditResult.summaryAr : (aiAuditResult.summaryEn || aiAuditResult.summaryAr)}
              </div>

              {/* Interactions from AI */}
              {aiAuditResult.interactions && aiAuditResult.interactions.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-bold text-neutral-300 light:text-neutral-700">
                    {lang === 'ar' ? 'التداخلات الدوائية المرصودة:' : 'Identified Drug Interactions:'}
                  </span>
                  {aiAuditResult.interactions.map((inter: any, i: number) => (
                    <div key={i} className="bg-rose-950/20 border border-rose-800/40 p-3 rounded text-xs space-y-1">
                      <div className="font-bold text-rose-300">{inter.titleAr || inter.titleEn}</div>
                      <div className="text-neutral-300">{inter.mechanism}</div>
                      <div className="text-emerald-400 text-[11px] font-semibold">
                        {lang === 'ar' ? inter.actionAr : (inter.actionEn || inter.actionAr)}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Food-Drug Interactions */}
              {aiAuditResult.foodInteractions && aiAuditResult.foodInteractions.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                    <Apple className="w-4 h-4 text-amber-400" />
                    <span>{lang === 'ar' ? 'تداخلات الأدوية مع الطعام والشراب:' : 'Food & Dietary Interactions:'}</span>
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {aiAuditResult.foodInteractions.map((f: any, idx: number) => (
                      <div key={idx} className="bg-amber-950/20 border border-amber-800/30 p-2.5 rounded text-xs">
                        <strong className="text-amber-300">{f.drug} + {f.foodItem}</strong>
                        <div className="text-neutral-300 mt-1">{lang === 'ar' ? f.instructionAr : (f.instructionEn || f.instructionAr)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Patient counseling points */}
              {aiAuditResult.patientCounselingPointsAr && (
                <div className="space-y-2">
                  <span className="text-xs font-bold text-blue-300">
                    {lang === 'ar' ? 'نقاط إرشاد وتثقيف المريض (Patient Counseling):' : 'Counseling Points:'}
                  </span>
                  <ul className="list-disc list-inside text-xs text-neutral-300 space-y-1">
                    {(lang === 'ar'
                      ? aiAuditResult.patientCounselingPointsAr
                      : aiAuditResult.patientCounselingPointsEn || aiAuditResult.patientCounselingPointsAr
                    ).map((point: string, pIdx: number) => (
                      <li key={pIdx}>{point}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Interactive Regimen Simulator */}
      <div className="bg-[#1f1f1f] light:bg-white border border-[#383838] light:border-neutral-200 rounded-xl p-5 shadow-sm space-y-4">
        <div className="font-extrabold text-sm text-white light:text-neutral-900 flex items-center gap-2">
          <Pill className="w-4 h-4 text-emerald-400" />
          <span>{lang === 'ar' ? 'محاكي فحص التداخلات لأي تركيبة أدوية جديدة (Interactive Sandbox)' : 'Interactive Drug Combination Sandbox'}</span>
        </div>
        <p className="text-xs text-neutral-400 light:text-neutral-600">
          {lang === 'ar'
            ? 'اكتب أي أسماء تجارية أو علمية مفصولة بفواصل لاختبار أمانها السريري فوراً (مثال: Concor, Lasix, Voltaren, Plavix, Nexium):'
            : 'Enter brand or generic drug names separated by commas to test instant clinical safety:'}
        </p>

        <input
          type="text"
          value={simulatorMeds}
          onChange={e => setSimulatorMeds(e.target.value)}
          className="w-full bg-[#141414] light:bg-neutral-50 border border-[#383838] light:border-neutral-300 text-white light:text-neutral-900 text-xs rounded-lg p-3 outline-none focus:border-blue-500 font-mono"
        />

        <div className="space-y-2">
          {simulatedAlerts.length === 0 ? (
            <div className="bg-emerald-950/20 border border-emerald-700/30 rounded-lg p-3 text-xs text-emerald-300">
              {lang === 'ar' ? 'التركيبة المدخلة آمنة سريرياً ولا توجد تحذيرات حرجة مباشرة.' : 'Entered combination is clinically clear of major red-flag alerts.'}
            </div>
          ) : (
            simulatedAlerts.map((sa, i) => (
              <div key={i} className="bg-rose-950/20 border border-rose-800/40 p-3 rounded-lg text-xs space-y-1">
                <div className="font-bold text-rose-300">🚨 {sa.title}</div>
                <div className="text-neutral-300">{sa.detail}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
