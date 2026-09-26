import React, { useState } from 'react';
import { Settings as SettingsIcon, Save, Download, Upload, AlertTriangle, RefreshCw, Check, Code, Copy, ExternalLink, X, Cloud, HelpCircle } from 'lucide-react';
import { Settings } from '../../types/pharmacy';

interface SettingsViewProps {
  settings: Settings;
  lang: 'ar' | 'en';
  onSaveSettings: (settings: Settings) => void;
  onExportBackup: () => void;
  onImportBackup: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onResetDatabase: () => void;
  onTestSheetConnection: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  lang,
  onSaveSettings,
  onExportBackup,
  onImportBackup,
  onResetDatabase,
  onTestSheetConnection,
}) => {
  const [formData, setFormData] = useState<Settings>({ ...settings });
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [showScriptModal, setShowScriptModal] = useState(false);
  const [showNetlifyModal, setShowNetlifyModal] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const APPS_SCRIPT_CODE = `/**
 * PharmPulse Enterprise - Google Apps Script Backend (Code.gs)
 * -------------------------------------------------------------
 * 1. Open your Google Sheet.
 * 2. Extensions > Apps Script.
 * 3. Paste this code into Code.gs.
 * 4. Deploy > New deployment > Web app.
 * 5. Execute as: "Me", Who has access: "Anyone".
 * 6. Copy Web App URL into PharmPulse Settings.
 */

const SHEET_PATIENTS = "Patients_DB";
const SHEET_FOLLOWUPS = "Clinical_FollowUps";
const SHEET_AUDIT_LOG = "Audit_Log";
const DRIVE_FOLDER_NAME = "PharmPulse_Prescriptions_Labs";

function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || "FETCH_ALL";
    const callback = e && e.parameter && e.parameter.callback;
    let result = {};

    if (action === "FETCH_ALL" || action === "GET_DATA") {
      initDatabaseSheetsIfMissing();
      result = {
        status: "SUCCESS",
        timestamp: new Date().toISOString(),
        patients: getAllPatientsFromSheet(),
        followUps: getAllFollowUpsFromSheet(),
      };
    } else if (action === "PING") {
      result = { status: "SUCCESS", message: "PharmPulse API Online" };
    } else {
      result = { status: "ERROR", message: "Unknown action" };
    }

    const jsonString = JSON.stringify(result);
    if (callback) {
      return ContentService.createTextOutput(callback + "(" + jsonString + ")")
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return ContentService.createTextOutput(jsonString).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "ERROR", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    initDatabaseSheetsIfMissing();
    let rawData = e.postData ? e.postData.contents : "";
    if (!rawData) return jsonResponse({ status: "ERROR", message: "Empty payload" });

    let payload = JSON.parse(rawData);
    const action = payload.action || "SYNC_UPSTREAM";

    if (action === "SYNC_UPSTREAM" || action === "SAVE_ALL") {
      if (Array.isArray(payload.patients)) savePatientsToSheet(payload.patients);
      if (Array.isArray(payload.followUps)) saveFollowUpsToSheet(payload.followUps);
      logAudit("SYNC", "Synced " + (payload.patients ? payload.patients.length : 0) + " patients");
      return jsonResponse({ status: "SUCCESS", message: "Synchronized successfully" });
    }

    if (action === "UPLOAD_SCAN") {
      const url = saveBase64ImageToDrive(payload.patientId, payload.title, payload.base64Data);
      return jsonResponse({ status: "SUCCESS", fileUrl: url });
    }

    return jsonResponse({ status: "ERROR", message: "Unknown action" });
  } catch (err) {
    return jsonResponse({ status: "ERROR", message: err.toString() });
  }
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function initDatabaseSheetsIfMissing() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss.getSheetByName(SHEET_PATIENTS)) {
    const s = ss.insertSheet(SHEET_PATIENTS);
    const headers = ["Patient ID", "Full Name", "Phone", "Age", "Gender", "Family Tag", "Diagnosis", "Allergies", "Loyalty Points", "Medications (JSON)", "Vitals (JSON)", "Scans (JSON)", "Is Archived", "Last Updated"];
    s.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold").setBackground("#0f6cbd").setFontColor("#fff");
    s.setFrozenRows(1);
  }
  if (!ss.getSheetByName(SHEET_FOLLOWUPS)) {
    const s = ss.insertSheet(SHEET_FOLLOWUPS);
    const headers = ["FollowUp ID", "Patient ID", "Patient Name", "Phone", "Type", "Drug", "Start Date", "Due Date", "Days Offset", "Adherence (%)", "Systolic", "Diastolic", "Glucose", "Notes", "Resolved", "Last Updated"];
    s.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold").setBackground("#1e3a5f").setFontColor("#fff");
    s.setFrozenRows(1);
  }
  if (!ss.getSheetByName(SHEET_AUDIT_LOG)) {
    const s = ss.insertSheet(SHEET_AUDIT_LOG);
    s.getRange(1, 1, 1, 3).setValues([["Timestamp", "Action", "Details"]]).setFontWeight("bold").setBackground("#292929").setFontColor("#fff");
    s.setFrozenRows(1);
  }
}

function savePatientsToSheet(patients) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_PATIENTS);
  if (!sheet) return;
  const now = new Date().toISOString();
  const data = sheet.getDataRange().getValues();
  const map = {};
  for (let r = 1; r < data.length; r++) { if (data[r][0]) map[data[r][0]] = r + 1; }
  const toAppend = [];
  patients.forEach(p => {
    const row = [p.id||"", p.name||"", p.phone||"", p.age||"", p.gender||"", p.familyTag||"", p.diagnosis||"", p.allergies||"", p.loyaltyPoints||0, JSON.stringify(p.medications||[]), JSON.stringify(p.vitals||[]), JSON.stringify(p.scans||[]), p.isArchived?"TRUE":"FALSE", now];
    if (p.id && map[p.id]) sheet.getRange(map[p.id], 1, 1, row.length).setValues([row]);
    else toAppend.push(row);
  });
  if (toAppend.length) sheet.getRange(sheet.getLastRow()+1, 1, toAppend.length, toAppend[0].length).setValues(toAppend);
}

function saveFollowUpsToSheet(followUps) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_FOLLOWUPS);
  if (!sheet) return;
  const now = new Date().toISOString();
  const data = sheet.getDataRange().getValues();
  const map = {};
  for (let r = 1; r < data.length; r++) { if (data[r][0]) map[data[r][0]] = r + 1; }
  const toAppend = [];
  followUps.forEach(f => {
    const row = [f.id||"", f.patientId||"", f.patientName||"", f.phone||"", f.type||"", f.drug||"", f.startDate||"", f.dueDate||"", f.daysOffset||0, f.adherenceScore!==undefined?f.adherenceScore:"", f.systolic||"", f.diastolic||"", f.glucose||"", f.notes||"", f.resolved?"TRUE":"FALSE", now];
    if (f.id && map[f.id]) sheet.getRange(map[f.id], 1, 1, row.length).setValues([row]);
    else toAppend.push(row);
  });
  if (toAppend.length) sheet.getRange(sheet.getLastRow()+1, 1, toAppend.length, toAppend[0].length).setValues(toAppend);
}

function getAllPatientsFromSheet() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_PATIENTS);
  if (!sheet) return [];
  const rows = sheet.getDataRange().getValues();
  const list = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row[0]) continue;
    let meds = [], vit = [], sc = [];
    try { meds = row[9] ? JSON.parse(row[9]) : []; } catch(e) {}
    try { vit = row[10] ? JSON.parse(row[10]) : []; } catch(e) {}
    try { sc = row[11] ? JSON.parse(row[11]) : []; } catch(e) {}
    list.push({ id: String(row[0]), name: String(row[1]||""), phone: String(row[2]||""), age: row[3]?Number(row[3]):undefined, gender: String(row[4]||""), familyTag: row[5]?String(row[5]):undefined, diagnosis: String(row[6]||""), allergies: String(row[7]||""), loyaltyPoints: Number(row[8]||0), medications: meds, vitals: vit, scans: sc, isArchived: String(row[12]).toUpperCase()==="TRUE" });
  }
  return list;
}

function getAllFollowUpsFromSheet() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_FOLLOWUPS);
  if (!sheet) return [];
  const rows = sheet.getDataRange().getValues();
  const list = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row[0]) continue;
    list.push({ id: String(row[0]), patientId: String(row[1]||""), patientName: String(row[2]||""), phone: String(row[3]||""), type: String(row[4]||"CHRONIC_INITIATION"), drug: String(row[5]||""), startDate: String(row[6]||""), dueDate: String(row[7]||""), daysOffset: Number(row[8]||0), adherenceScore: row[9]!==""?Number(row[9]):undefined, systolic: row[10]!==""?Number(row[10]):undefined, diastolic: row[11]!==""?Number(row[11]):undefined, glucose: row[12]!==""?Number(row[12]):undefined, notes: String(row[13]||""), resolved: String(row[14]).toUpperCase()==="TRUE" });
  }
  return list;
}

function saveBase64ImageToDrive(patientId, fileName, base64Data) {
  if (!base64Data) return "";
  let folder;
  const folders = DriveApp.getFoldersByName(DRIVE_FOLDER_NAME);
  folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(DRIVE_FOLDER_NAME);
  const clean = base64Data.replace(/^data:image\\/(png|jpeg|jpg|webp);base64,/, "");
  const blob = Utilities.newBlob(Utilities.base64Decode(clean), "image/jpeg", (patientId||"Scan") + "_" + (fileName||"rx.jpg"));
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return file.getUrl();
}

function logAudit(action, details) {
  try {
    const s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_AUDIT_LOG);
    if (s) s.appendRow([new Date(), action, details]);
  } catch(e) {}
}`;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings(formData);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="bg-[#1f1f1f] light:bg-white border border-[#383838] light:border-neutral-200 rounded-xl p-5 shadow-sm">
        <div className="font-extrabold text-lg text-white light:text-neutral-900 flex items-center gap-2">
          <SettingsIcon className="w-5 h-5 text-blue-400" />
          <span>{lang === 'ar' ? 'الإعدادات العامة والربط السحابي وقوالب الرسائل' : 'Settings & Cloud Integration'}</span>
        </div>
        <p className="text-xs text-neutral-400 light:text-neutral-500 mt-1">
          {lang === 'ar'
            ? 'تخصيص اسم الصيدلية، ورابط مزامنة Google Sheet / Google Drive، وصيغ رسائل التذكير والمتابعة السريرية.'
            : 'Configure pharmacy branding, Google Sheet Web App endpoint, and customized WhatsApp & SMS messaging templates.'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Pharmacy & Cloud */}
        <div className="bg-[#1f1f1f] light:bg-white border border-[#383838] light:border-neutral-200 rounded-xl p-5 shadow-sm space-y-4">
          <div className="font-bold text-sm text-white light:text-neutral-900">
            {lang === 'ar' ? 'البيانات الأساسية والربط السحابي' : 'Basic & Cloud Configuration'}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-neutral-300 light:text-neutral-700">
              {lang === 'ar' ? 'اسم الصيدلية أو المركز السريري' : 'Pharmacy / Clinic Brand Name'}
            </label>
            <input
              type="text"
              value={formData.pharmacyName}
              onChange={e => setFormData({ ...formData, pharmacyName: e.target.value })}
              className="w-full bg-[#141414] light:bg-neutral-50 border border-[#383838] light:border-neutral-300 text-white light:text-neutral-900 text-xs rounded-lg p-2.5 outline-none focus:border-blue-500"
              required
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-neutral-300 light:text-neutral-700">
                {lang === 'ar' ? 'رابط Google Apps Script Web App URL' : 'Google Apps Script Web App URL'}
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowScriptModal(true)}
                  className="text-[11px] font-bold text-amber-400 hover:text-amber-300 hover:underline flex items-center gap-1 px-2 py-0.5 rounded bg-amber-950/40 border border-amber-800/40"
                >
                  <Code className="w-3 h-3 text-amber-400" />
                  <span>{lang === 'ar' ? 'عرض كود Apps Script' : 'Get Apps Script Code'}</span>
                </button>
                {formData.gasUrl && (
                  <button
                    type="button"
                    onClick={onTestSheetConnection}
                    className="text-[11px] font-bold text-blue-400 hover:underline flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>{lang === 'ar' ? 'اختبار الاتصال والمزامنة الآن' : 'Test Sync'}</span>
                  </button>
                )}
              </div>
            </div>
            <input
              type="url"
              value={formData.gasUrl}
              onChange={e => setFormData({ ...formData, gasUrl: e.target.value })}
              placeholder="https://script.google.com/macros/s/.../exec"
              className="w-full bg-[#141414] light:bg-neutral-50 border border-[#383838] light:border-neutral-300 text-white light:text-neutral-900 text-xs rounded-lg p-2.5 font-mono outline-none focus:border-blue-500"
            />
            <div className="text-[11px] text-neutral-400">
              {lang === 'ar'
                ? 'يتيح المزامنة اللحظية ثنائية الاتجاه مع Google Sheets وحفظ صور التحاليل والوصفات الطبية في Google Drive.'
                : 'Enables 2-way sync with Google Sheets and prescription storage in Google Drive.'}
            </div>
          </div>
        </div>

        {/* Messaging Templates */}
        <div className="bg-[#1f1f1f] light:bg-white border border-[#383838] light:border-neutral-200 rounded-xl p-5 shadow-sm space-y-4">
          <div className="font-bold text-sm text-white light:text-neutral-900">
            {lang === 'ar' ? 'قوالب الرسائل المخصصة (WhatsApp & SMS Templates)' : 'Automated Messaging Templates'}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-neutral-300 light:text-neutral-700">
              {lang === 'ar' ? 'قالب تذكير صرف العلاج المزمن (WhatsApp)' : 'Chronic Refill Reminder Template (WhatsApp)'}
            </label>
            <textarea
              rows={3}
              value={formData.waTemplate}
              onChange={e => setFormData({ ...formData, waTemplate: e.target.value })}
              className="w-full bg-[#141414] light:bg-neutral-50 border border-[#383838] light:border-neutral-300 text-white light:text-neutral-900 text-xs rounded-lg p-2.5 outline-none focus:border-blue-500"
            />
            <div className="text-[10px] text-neutral-400">
              {lang === 'ar' ? 'المتغيرات المتاحة: {name}, {pharmacy}, {drug}, {date}' : 'Variables: {name}, {pharmacy}, {drug}, {date}'}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-neutral-300 light:text-neutral-700">
              {lang === 'ar' ? 'قالب متابعة كورس المضاد الحيوي (Antibiotic Stewardship Check-in)' : 'Antibiotic Stewardship Check-in'}
            </label>
            <textarea
              rows={3}
              value={formData.waAbxTemplate}
              onChange={e => setFormData({ ...formData, waAbxTemplate: e.target.value })}
              className="w-full bg-[#141414] light:bg-neutral-50 border border-[#383838] light:border-neutral-300 text-white light:text-neutral-900 text-xs rounded-lg p-2.5 outline-none focus:border-blue-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-neutral-300 light:text-neutral-700">
              {lang === 'ar' ? 'قالب متابعة العلاج المزمن الجديد (Chronic Milestones Check-in)' : 'Chronic Therapy Milestone Check-in'}
            </label>
            <textarea
              rows={3}
              value={formData.waChronicFollowTemplate}
              onChange={e => setFormData({ ...formData, waChronicFollowTemplate: e.target.value })}
              className="w-full bg-[#141414] light:bg-neutral-50 border border-[#383838] light:border-neutral-300 text-white light:text-neutral-900 text-xs rounded-lg p-2.5 outline-none focus:border-blue-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-neutral-300 light:text-neutral-700">
              {lang === 'ar' ? 'قالب الرسائل النصية القصيرة (SMS Reminder Template)' : 'SMS Text Template'}
            </label>
            <textarea
              rows={2}
              value={formData.smsTemplate}
              onChange={e => setFormData({ ...formData, smsTemplate: e.target.value })}
              className="w-full bg-[#141414] light:bg-neutral-50 border border-[#383838] light:border-neutral-300 text-white light:text-neutral-900 text-xs rounded-lg p-2.5 outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-between flex-wrap gap-4 pt-2">
          <button
            type="submit"
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#0f6cbd] hover:bg-[#115ea3] text-white font-bold text-xs shadow-md transition-colors cursor-pointer"
          >
            {savedSuccess ? <Check className="w-4 h-4 text-emerald-300" /> : <Save className="w-4 h-4" />}
            <span>{savedSuccess ? (lang === 'ar' ? 'تم الحفظ بنجاح!' : 'Saved!') : (lang === 'ar' ? 'حفظ كافة الإعدادات' : 'Save Settings')}</span>
          </button>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={onExportBackup}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 text-xs font-semibold transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{lang === 'ar' ? 'تصدير نسخة احتياطية (JSON)' : 'Export JSON Backup'}</span>
            </button>

            <label className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 text-xs font-semibold transition-colors cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              <span>{lang === 'ar' ? 'استيراد نسخة احتياطية' : 'Import JSON'}</span>
              <input
                type="file"
                accept=".json"
                onChange={onImportBackup}
                className="hidden"
              />
            </label>

            <button
              type="button"
              onClick={onResetDatabase}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 text-xs font-semibold transition-colors"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{lang === 'ar' ? 'إعادة ضبط البيانات الافتراضية' : 'Reset Seed Data'}</span>
            </button>
          </div>
        </div>

        {/* Netlify Deployment Section */}
        <div className="bg-[#1f1f1f] light:bg-white border border-[#383838] light:border-neutral-200 rounded-xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-teal-500/10 border border-teal-500/30 text-teal-400">
                <Cloud className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-white light:text-neutral-900">
                  {lang === 'ar' ? 'استضافة ونشر الموقع على Netlify' : 'Host & Deploy on Netlify'}
                </h3>
                <p className="text-xs text-neutral-400 light:text-neutral-500">
                  {lang === 'ar'
                    ? 'استضف الموقع مجاناً برابط دائم وشهادة SSL عبر Netlify بالسحب والإفلات أو ربط مستودع GitHub.'
                    : 'Deploy this web application for free on Netlify via 1-click Drag & Drop or GitHub CI/CD.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <a
                href="/download/dist.zip"
                download="pharmpulse-netlify-dist.zip"
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold shadow-sm transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>{lang === 'ar' ? 'تحميل حزمة النشر (dist.zip)' : 'Download dist.zip'}</span>
              </a>

              <button
                type="button"
                onClick={() => setShowNetlifyModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 text-xs font-semibold transition-colors cursor-pointer"
              >
                <HelpCircle className="w-4 h-4 text-amber-400" />
                <span>{lang === 'ar' ? 'دليل خطوات الاستضافة' : 'Hosting Guide'}</span>
              </button>

              <a
                href="https://app.netlify.com/drop"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#141414] hover:bg-neutral-800 text-blue-400 border border-blue-900/40 text-xs font-semibold transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>app.netlify.com/drop</span>
              </a>
            </div>
          </div>
        </div>
      </form>

      {/* Google Apps Script Code Modal */}
      {showScriptModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1f1f1f] border border-[#383838] rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-[#383838] flex items-center justify-between bg-[#191919]">
              <div className="flex items-center gap-2">
                <Code className="w-5 h-5 text-amber-400" />
                <span className="font-bold text-sm text-white">
                  {lang === 'ar' ? 'كود Google Apps Script لقاعدة بيانات Google Sheet' : 'Google Apps Script Backend Code (Code.gs)'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowScriptModal(false)}
                className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-3 overflow-y-auto flex-1 text-xs">
              <div className="p-3 bg-blue-950/40 border border-blue-800/40 rounded-xl space-y-1 text-neutral-300">
                <div className="font-bold text-blue-300">
                  {lang === 'ar' ? '⚡ خطوات الإعداد السريعة:' : '⚡ Setup Instructions:'}
                </div>
                <ol className="list-decimal list-inside space-y-0.5 text-[11px]">
                  <li>{lang === 'ar' ? 'افتح جدول بيانات Google Sheet جديد.' : 'Open a new Google Sheet.'}</li>
                  <li>{lang === 'ar' ? 'اضغط من القائمة العلوية على: الإضافات (Extensions) > Apps Script.' : 'Go to Extensions > Apps Script.'}</li>
                  <li>{lang === 'ar' ? 'احذف الكود القديم والصق الكود الموجود أدناه بالكامل.' : 'Delete existing code and paste the script below.'}</li>
                  <li>{lang === 'ar' ? 'اضغط على نشر (Deploy) > نشر جديد (New deployment) > اختر نوع "تطبيق ويب" (Web app).' : 'Click Deploy > New deployment > Web app.'}</li>
                  <li>{lang === 'ar' ? 'حدد "Execute as: Me" و "Who has access: Anyone".' : 'Set "Execute as: Me" and "Who has access: Anyone".'}</li>
                  <li>{lang === 'ar' ? 'انسخ رابط Web App URL المنتهي بـ /exec وضعه في خانة رابط Apps Script أعلاه.' : 'Copy the Web App URL (ends with /exec) into the settings field.'}</li>
                </ol>
              </div>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(APPS_SCRIPT_CODE);
                    setCopiedCode(true);
                    setTimeout(() => setCopiedCode(false), 2500);
                  }}
                  className="absolute top-3 right-3 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition-colors"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCode ? (lang === 'ar' ? 'تم النسخ!' : 'Copied!') : (lang === 'ar' ? 'نسخ الكود بالكامل' : 'Copy Code')}</span>
                </button>

                <pre className="p-4 bg-[#141414] border border-[#383838] rounded-xl text-[11px] font-mono text-emerald-400 overflow-x-auto max-h-[350px] leading-relaxed">
                  {APPS_SCRIPT_CODE}
                </pre>
              </div>
            </div>

            <div className="p-3 bg-[#191919] border-t border-[#383838] flex justify-end">
              <button
                type="button"
                onClick={() => setShowScriptModal(false)}
                className="px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold"
              >
                {lang === 'ar' ? 'إغلاق' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Netlify Step-by-Step Guide Modal */}
      {showNetlifyModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1f1f1f] border border-[#383838] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-[#383838] flex items-center justify-between bg-[#191919]">
              <div className="flex items-center gap-2">
                <Cloud className="w-5 h-5 text-teal-400" />
                <span className="font-bold text-sm text-white">
                  {lang === 'ar' ? 'طريقة استضافة ونشر الموقع على Netlify' : 'How to Deploy PharmPulse on Netlify'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowNetlifyModal(false)}
                className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-5 overflow-y-auto flex-1 text-xs">
              {/* Method 1: Netlify Drop (Fastest, 30 seconds) */}
              <div className="p-4 bg-teal-950/30 border border-teal-800/40 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-teal-300 text-sm flex items-center gap-1.5">
                    <span>⚡</span>
                    <span>{lang === 'ar' ? 'الطريقة 1: السحب والإفلات المباشر (Netlify Drop - الأسهل والأسرع خلال 30 ثانية)' : 'Method 1: Netlify Drop (Instant Drag & Drop - 30 seconds)'}</span>
                  </span>
                  <span className="px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 text-[10px] font-bold">موصى به</span>
                </div>
                <p className="text-neutral-300 leading-relaxed">
                  {lang === 'ar'
                    ? 'لا تحتاج إلى تثبيت أي برامج أو كتابة أوامر برمجية. تم تجهيز ملفات الموقع بالكامل داخل ملف مضغوط جاهز للنشر مباشرة.'
                    : 'No terminal, node, or git required. The application build has been pre-packaged and ready.'}
                </p>
                <ol className="space-y-2 text-neutral-200 list-decimal list-inside">
                  <li>
                    <strong className="text-white">{lang === 'ar' ? 'حمّل حزمة النشر:' : 'Download the zip package:'} </strong>
                    <a
                      href="/download/dist.zip"
                      download="pharmpulse-netlify-dist.zip"
                      className="text-teal-400 underline font-semibold hover:text-teal-300 ml-1"
                    >
                      {lang === 'ar' ? 'اضغط هنا لتحميل pharmpulse-netlify-dist.zip' : 'Click here to download dist.zip'}
                    </a>
                  </li>
                  <li>
                    {lang === 'ar'
                      ? 'قم بفك ضغط الملف المضغوط على جهازك لينتج لك مجلد باسم (dist) يحتوي على ملفات الموقع.'
                      : 'Unzip the downloaded file on your computer; you will see the (dist) folder.'}
                  </li>
                  <li>
                    {lang === 'ar' ? 'افتح صفحة Netlify Drop على الرابط: ' : 'Open Netlify Drop: '}
                    <a
                      href="https://app.netlify.com/drop"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 underline font-semibold hover:text-blue-300 inline-flex items-center gap-1 ml-1"
                    >
                      <span>https://app.netlify.com/drop</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </li>
                  <li>
                    {lang === 'ar'
                      ? 'قم بسحب مجلد (dist) وإسقاطه داخل الدائرة المخصصة في صفحة Netlify Drop.'
                      : 'Drag and drop the (dist) folder directly into the Netlify Drop area.'}
                  </li>
                  <li>
                    <strong className="text-emerald-400">{lang === 'ar' ? 'مبروك!' : 'Done!'} </strong>
                    {lang === 'ar'
                      ? 'سيمنحك Netlify رابطاً فورياً مجانياً (مثل your-app.netlify.app) وسيعمل الموقع كاملاً مع شهادة أمان SSL مجانية.'
                      : 'Netlify gives you an active public URL (e.g. your-app.netlify.app) with free SSL!'}
                  </li>
                </ol>
              </div>

              {/* Method 2: Git / GitHub Continuous Deployment */}
              <div className="p-4 bg-neutral-900 border border-neutral-700/60 rounded-xl space-y-3">
                <span className="font-bold text-white text-sm flex items-center gap-1.5">
                  <span>🔄</span>
                  <span>{lang === 'ar' ? 'الطريقة 2: الربط بمستودع GitHub (للتحديثات التلقائية المستمرة)' : 'Method 2: Connect via GitHub (Continuous Deployment)'}</span>
                </span>
                <p className="text-neutral-400 leading-relaxed">
                  {lang === 'ar'
                    ? 'إذا كان لديك الكود على GitHub، سجّل دخولك إلى app.netlify.com واختر "Add new site" > "Import an existing project":'
                    : 'If you push your code to GitHub, choose "Add new site" > "Import an existing project":'}
                </p>
                <div className="bg-[#141414] p-3 rounded-lg border border-neutral-800 space-y-1.5 font-mono text-[11px]">
                  <div className="flex items-center justify-between text-neutral-300">
                    <span className="text-neutral-500">Build command:</span>
                    <span className="text-amber-400 font-bold">npm run build</span>
                  </div>
                  <div className="flex items-center justify-between text-neutral-300">
                    <span className="text-neutral-500">Publish directory:</span>
                    <span className="text-emerald-400 font-bold">dist</span>
                  </div>
                </div>
                <p className="text-[11px] text-neutral-400">
                  {lang === 'ar'
                    ? '✅ قمنا بتهيئة ملف netlify.toml وملف _redirects مسبقاً لضمان عمل كافة الروابط والصفحات دون أية أخطاء 404.'
                    : '✅ netlify.toml and _redirects are already pre-configured to handle SPA routing perfectly without 404 errors.'}
                </p>
              </div>
            </div>

            <div className="p-3 bg-[#191919] border-t border-[#383838] flex items-center justify-between">
              <a
                href="https://app.netlify.com/drop"
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs flex items-center gap-1.5"
              >
                <span>{lang === 'ar' ? 'فتح Netlify Drop الآن' : 'Open Netlify Drop'}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <button
                type="button"
                onClick={() => setShowNetlifyModal(false)}
                className="px-4 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold"
              >
                {lang === 'ar' ? 'إغلاق' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
