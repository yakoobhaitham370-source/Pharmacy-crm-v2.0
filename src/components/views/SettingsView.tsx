import React, { useState, useMemo } from 'react';
import {
  Settings as SettingsIcon,
  Save,
  Download,
  Upload,
  AlertTriangle,
  RefreshCw,
  Check,
  Code,
  Copy,
  ExternalLink,
  X,
  Cloud,
  HelpCircle,
  CheckCircle2,
  XCircle,
  Info,
  ShieldCheck,
  Activity,
  FileCode,
  ArrowRight,
  ExternalLink as LinkIcon
} from 'lucide-react';
import { Settings } from '../../types/pharmacy';
import { validateGasUrl, testSheetConnectionDetailed, GasDiagnosticResult } from '../../services/apiService';

interface SettingsViewProps {
  settings: Settings;
  lang: 'ar' | 'en';
  onSaveSettings: (settings: Settings) => void;
  onExportBackup: () => void;
  onImportBackup: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onResetDatabase: () => void;
  onTestSheetConnection: () => void;
  onPushLocalToSheet?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  lang,
  onSaveSettings,
  onExportBackup,
  onImportBackup,
  onResetDatabase,
  onTestSheetConnection,
  onPushLocalToSheet,
}) => {
  const [formData, setFormData] = useState<Settings>({ ...settings });
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [showScriptModal, setShowScriptModal] = useState(false);
  const [scriptModalTab, setScriptModalTab] = useState<'code' | 'instructions' | 'faq'>('code');
  const [showNetlifyModal, setShowNetlifyModal] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Diagnostic testing state
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState<GasDiagnosticResult | null>(null);
  const [showDiagnosticModal, setShowDiagnosticModal] = useState(false);

  // Live URL validation
  const urlValidation = useMemo(() => validateGasUrl(formData.gasUrl), [formData.gasUrl]);

  // Full, complete, enterprise Google Apps Script Code
  const APPS_SCRIPT_CODE = `/**
 * ============================================================================
 * 🏥 PharmPulse Enterprise - Google Apps Script Backend (Code.gs)
 * الإصدار: 3.0.0 Enterprise Edition
 * ============================================================================
 * 
 * 📖 تعليمات التركيب والربط السحابي (Deployment Instructions):
 * -------------------------------------------------------------
 * 1. افتح جدول بيانات Google Sheet الخاص بك (أو أنشئ شيت جديد من sheets.new).
 * 2. من القائمة العلوية اضغط على: الامتدادات (Extensions) > Apps Script.
 * 3. امسح أي كود موجود داخل الملف الافتراضي Code.gs، والصق هذا الملف كاملاً بدلاً منه.
 * 4. اضغط على زر الحفظ (أيقونة القرص 💾 أو Ctrl+S).
 * 5. في أعلى اليمين، اضغط على زر: نشر (Deploy) > نشر جديد (New deployment).
 * 6. اضغط على أيقونة الترس ⚙️ بجوار "Select type" واختر: تطبيق ويب (Web app).
 * 7. املأ الإعدادات التالية بدقة:
 *    - الوصف (Description): PharmPulse CRM API
 *    - تنفيذ كـ (Execute as): أنا (Me)
 *    - من لديه إمكانية الوصول (Who has access): أي شخص (Anyone)  <--- ⚠️ هام جداً!
 *      (إذا اخترت "Only myself" أو "Anyone with Google account" سيفشل الاتصال!)
 * 8. اضغط على نشر (Deploy) ثم اضغط على منح الإذن (Authorize access).
 * 9. اختر حساب Google الخاص بك > اضغط على خيارات متقدمة (Advanced) > ثم اضغط على الانتقال إلى PharmPulse (غير آمن) > سماح (Allow).
 * 10. انسخ رابط تطبيق الويب (Web App URL) المنتهي بـ /exec والصقه في إعدادات PharmPulse CRM.
 * 
 * 💡 ملاحظة هامة:
 * إذا قمت بإنشاء السكريبت مستقلاً من موقع script.google.com (وليس من داخل الشيت)،
 * ضع معرف الشيت في المتغير SPREADSHEET_ID أدناه.
 * ============================================================================
 */

// معرف جدول البيانات (اختياري: اتركه فارغاً إذا فتحت السكريبت من داخل Google Sheets)
// إذا كان السكريبت مستقلاً، انسخ المعرف من رابط الشيت docs.google.com/spreadsheets/d/[ID]/edit
const SPREADSHEET_ID = "";

// أسماء أوراق العمل في قاعدة البيانات
const SHEET_PATIENTS = "Patients_DB";
const SHEET_FOLLOWUPS = "Clinical_FollowUps";
const SHEET_SETTINGS = "Settings_Config";
const SHEET_AUDIT_LOG = "Audit_Log";

// اسم مجلد Google Drive لتخزين صور الروشتات والتحاليل
const DRIVE_FOLDER_NAME = "PharmPulse_Prescriptions_Labs";

// ============================================================================
// 1. Google Sheets UI Menus (القوائم التفاعلية داخل الشيت)
// ============================================================================

/**
 * يتم تشغيل هذه الدالة تلقائياً عند فتح جدول البيانات لإضافة قائمة خاصة بـ PharmPulse
 */
function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu("🏥 نظام PharmPulse CRM")
      .addItem("⚡ تهيئة الجداول وتنسيق الأعمدة (Initialize Database)", "menuInitializeDatabase")
      .addItem("🧪 اختبار الاتصال والصلاحيات (Test Connection)", "menuTestConnection")
      .addSeparator()
      .addItem("📊 إحصائيات قاعدة البيانات (Data Summary)", "menuShowSummary")
      .addItem("🎨 إعادة تنسيق وتلوين الجداول (Format Tables)", "menuFormatTables")
      .addSeparator()
      .addItem("📖 تعليمات الربط السحابي (Deployment Help)", "menuShowInstructions")
      .addToUi();
  } catch (e) {
    Logger.log("Notice: onOpen UI menu not available in current execution context.");
  }
}

/**
 * دالة يدوية لتشغيلها من محرر Apps Script للتحقق من الصلاحيات والاتصال
 */
function testConnection() {
  try {
    const ss = getSpreadsheet();
    if (!ss) {
      throw new Error("لم يتم العثور على Google Sheet. تأكد من فتح السكريبت عبر Extensions > Apps Script أو وضع SPREADSHEET_ID.");
    }
    initDatabaseSheetsIfMissing();
    Logger.log("=================================================");
    Logger.log("✅ نجاح الاتصال: تم التحقق من قاعدة بيانات PharmPulse بنجاح!");
    Logger.log("📊 اسم جدول البيانات: " + ss.getName());
    Logger.log("🔗 الرابط: " + ss.getUrl());
    Logger.log("=================================================");
    return "SUCCESS: " + ss.getName();
  } catch (err) {
    Logger.log("❌ فشل الاختبار: " + err.toString());
    throw err;
  }
}

function menuInitializeDatabase() {
  initDatabaseSheetsIfMissing();
  SpreadsheetApp.getUi().alert("✅ تم بنجاح!", "تم إنشاء وتنسيق كافة جداول قاعدة البيانات (المرضى، المتابعات السريرية، الإعدادات، وسجل العمليات) بنجاح.", SpreadsheetApp.getUi().ButtonSet.OK);
}

function menuTestConnection() {
  const ss = getSpreadsheet();
  const pCount = getPatientsCount();
  const fCount = getFollowUpsCount();
  SpreadsheetApp.getUi().alert("🧪 تقرير الاتصال السحابي", 
    \`• حالة الاتصال: متصل وجاهز (Online)\\n• اسم الشيت: \${ss.getName()}\\n• عدد المرضى المسجلين: \${pCount}\\n• عدد المتابعات السريرية: \${fCount}\\n• التوقيت: \${new Date().toLocaleString()}\`, 
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

function menuShowSummary() {
  const pCount = getPatientsCount();
  const fCount = getFollowUpsCount();
  SpreadsheetApp.getUi().alert("📊 ملخص بيانات PharmPulse CRM", 
    \`قاعدة البيانات نشطة:\\n- إجمالي المرضى: \${pCount} مريض\\n- إجمالي المتابعات السريرية: \${fCount} متابعة\\n- مجلد Google Drive: جاهز لاستقبال صور الروشتات\`, 
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

function menuFormatTables() {
  initDatabaseSheetsIfMissing();
  SpreadsheetApp.getUi().alert("🎨 تم إعادة تنسيق الجداول وتثبيت صفوف العناوين وتطبيق الألوان الطبية بنجاح.");
}

function menuShowInstructions() {
  const html = HtmlService.createHtmlOutput(\`
    <div style="font-family: Arial, sans-serif; direction: rtl; text-align: right; padding: 15px;">
      <h3 style="color: #0f6cbd;">خطوات الربط مع نظام PharmPulse:</h3>
      <ol style="line-height: 1.8;">
        <li>اضغط من القائمة العلوية على <b>Deploy (نشر)</b> &gt; <b>New deployment (نشر جديد)</b>.</li>
        <li>اختر <b>Web app (تطبيق ويب)</b>.</li>
        <li>اختر في Execute as: <b>Me</b>.</li>
        <li>اختر في Who has access: <b>Anyone</b> (أي شخص).</li>
        <li>انسخ رابط الـ Web App وضعه في إعدادات PharmPulse.</li>
      </ol>
    </div>
  \`).setWidth(450).setHeight(300);
  SpreadsheetApp.getUi().showModalDialog(html, "دليل النشر والربط السحابي");
}

// ============================================================================
// 2. HTTP GET Endpoint (جلب البيانات والاستعلام)
// ============================================================================

/**
 * معالجة طلبات GET من المتصفح ونظام PharmPulse
 */
function doGet(e) {
  try {
    const ss = getSpreadsheet();
    const action = (e && e.parameter && e.parameter.action) || "DEFAULT_VIEW";
    const callback = e && e.parameter && e.parameter.callback;

    // 1. إذا فتح المستخدم الرابط مباشرة في متصفح الويب كاختبار:
    if (action === "DEFAULT_VIEW" && (!e || !e.parameter || Object.keys(e.parameter).length === 0)) {
      return renderStatusHtmlPage(ss);
    }

    let result = {};

    // 2. فحص استجابة الاتصال الخفيف (PING / HEALTH CHECK)
    if (action === "PING" || action === "TEST") {
      initDatabaseSheetsIfMissing();
      result = {
        status: "SUCCESS",
        message: "PharmPulse Cloud API is Online and Healthy",
        spreadsheetName: ss ? ss.getName() : "Direct Sheet",
        spreadsheetId: ss ? ss.getId() : "",
        timestamp: new Date().toISOString(),
        version: "3.0.0-enterprise",
        counts: {
          patients: getPatientsCount(),
          followUps: getFollowUpsCount()
        }
      };
    }
    // 3. جلب كافة البيانات (FETCH_ALL / GET_DATA)
    else if (action === "FETCH_ALL" || action === "GET_DATA" || action === "DEFAULT_VIEW") {
      initDatabaseSheetsIfMissing();
      result = {
        status: "SUCCESS",
        timestamp: new Date().toISOString(),
        patients: getAllPatientsFromSheet(),
        followUps: getAllFollowUpsFromSheet(),
        settings: getSettingsFromSheet(),
        counts: {
          patients: getPatientsCount(),
          followUps: getFollowUpsCount()
        }
      };
    }
    // 4. استعلام عن مريض محدد بواسطة ID أو رقم الهاتف
    else if (action === "GET_PATIENT") {
      const qId = e.parameter.id;
      const qPhone = e.parameter.phone;
      const all = getAllPatientsFromSheet();
      const found = all.find(p => (qId && p.id === qId) || (qPhone && p.phone === qPhone));
      result = {
        status: found ? "SUCCESS" : "NOT_FOUND",
        patient: found || null
      };
    } 
    else {
      result = {
        status: "ERROR",
        message: "Unknown action: " + action
      };
    }

    const jsonString = JSON.stringify(result);

    // دعم JSONP في حال منع المتصفح للـ CORS
    if (callback) {
      return ContentService.createTextOutput(callback + "(" + jsonString + ")")
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }

    return ContentService.createTextOutput(jsonString)
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    const errorResponse = JSON.stringify({
      status: "ERROR",
      message: err.toString(),
      timestamp: new Date().toISOString()
    });

    if (e && e.parameter && e.parameter.callback) {
      return ContentService.createTextOutput(e.parameter.callback + "(" + errorResponse + ")")
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return ContentService.createTextOutput(errorResponse)
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ============================================================================
// 3. HTTP POST Endpoint (حفظ وتحديث البيانات ورفع الصور)
// ============================================================================

/**
 * معالجة طلبات POST لإرسال التحديثات من CRM إلى Google Sheets & Google Drive
 */
function doPost(e) {
  try {
    initDatabaseSheetsIfMissing();

    let rawData = e.postData ? e.postData.contents : "";
    if (!rawData) {
      return jsonResponse({ status: "ERROR", message: "Empty payload received" });
    }

    let payload;
    try {
      payload = JSON.parse(rawData);
    } catch (parseErr) {
      return jsonResponse({ status: "ERROR", message: "Invalid JSON format: " + parseErr });
    }

    const action = payload.action || "SYNC_UPSTREAM";

    // 1. مزامنة كاملة لقاعدة البيانات (Sync Upstream)
    if (action === "SYNC_UPSTREAM" || action === "SAVE_ALL") {
      const patients = payload.patients || [];
      const followUps = payload.followUps || [];
      const settings = payload.settings || null;

      if (Array.isArray(patients)) {
        savePatientsToSheet(patients);
      }
      if (Array.isArray(followUps)) {
        saveFollowUpsToSheet(followUps);
      }
      if (settings) {
        saveSettingsToSheet(settings);
      }

      logAudit("SYNC_ALL", \`Synced \${patients.length} patients and \${followUps.length} follow-ups.\`);

      return jsonResponse({
        status: "SUCCESS",
        message: "Cloud database updated successfully",
        patientsCount: patients.length,
        followUpsCount: followUps.length,
        timestamp: new Date().toISOString()
      });
    }

    // 2. حذف مريض نهائياً من الشيت
    if (action === "DELETE_PATIENT") {
      const pId = payload.patientId || (payload.patient && payload.patient.id);
      if (!pId) return jsonResponse({ status: "ERROR", message: "Missing patientId" });
      const delSuccess = deletePatientFromSheet(pId);
      deleteFollowUpsForPatient(pId);
      logAudit("DELETE_PATIENT", "Deleted patient ID: " + pId);
      return jsonResponse({ status: "SUCCESS", message: "Patient removed from Google Sheet", deleted: delSuccess });
    }

    // 3. حفظ مريض واحد فقط
    if (action === "SAVE_PATIENT") {
      if (!payload.patient || !payload.patient.id) {
        return jsonResponse({ status: "ERROR", message: "Missing patient payload" });
      }
      savePatientsToSheet([payload.patient]);
      logAudit("SAVE_PATIENT", \`Saved patient \${payload.patient.name} (\${payload.patient.id})\`);
      return jsonResponse({ status: "SUCCESS", message: "Patient saved successfully" });
    }

    // 3. حفظ متابعة سريرية واحدة
    if (action === "SAVE_FOLLOWUP") {
      if (!payload.followUp || !payload.followUp.id) {
        return jsonResponse({ status: "ERROR", message: "Missing followUp payload" });
      }
      saveFollowUpsToSheet([payload.followUp]);
      logAudit("SAVE_FOLLOWUP", \`Saved follow-up \${payload.followUp.id}\`);
      return jsonResponse({ status: "SUCCESS", message: "Follow-up saved successfully" });
    }

    // 4. رفع صورة تحليل أو وصفة طبية إلى Google Drive
    if (action === "UPLOAD_SCAN" || action === "UPLOAD_IMAGE") {
      const fileUrl = saveBase64ImageToDrive(payload.patientId, payload.title, payload.base64Data);
      logAudit("UPLOAD_SCAN", \`Uploaded scan for patient \${payload.patientId}\`);
      return jsonResponse({
        status: "SUCCESS",
        fileUrl: fileUrl,
        message: "Scan image saved to Google Drive"
      });
    }

    // 5. حفظ إعدادات النظام
    if (action === "SAVE_SETTINGS") {
      if (payload.settings) {
        saveSettingsToSheet(payload.settings);
        logAudit("SAVE_SETTINGS", "Settings updated");
        return jsonResponse({ status: "SUCCESS", message: "Settings saved successfully" });
      }
    }

    // 6. فحص الاتصال عبر POST
    if (action === "PING") {
      return jsonResponse({ status: "SUCCESS", message: "POST handshake verified" });
    }

    return jsonResponse({ status: "ERROR", message: "Unhandled action: " + action });

  } catch (err) {
    logAudit("ERROR", err.toString());
    return jsonResponse({ status: "ERROR", message: err.toString() });
  }
}

// ============================================================================
// 4. Database Initialization & Schema Definition
// ============================================================================

/**
 * الحصول على الشيت النشط أو الشيت المحدد بواسطة SPREADSHEET_ID
 */
function getSpreadsheet() {
  if (SPREADSHEET_ID && SPREADSHEET_ID.trim() !== "") {
    try {
      return SpreadsheetApp.openById(SPREADSHEET_ID.trim());
    } catch (e) {
      Logger.log("Failed to open spreadsheet by ID: " + e.toString());
    }
  }
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) return active;

  throw new Error("لم يتم العثور على Google Sheet. إذا قمت بإنشاء السكريبت من script.google.com، يرجى وضع SPREADSHEET_ID في السطر 28.");
}

/**
 * تهيئة الأوراق والأعمدة وتطبيق التنسيقات الطبية الرسمية
 */
function initDatabaseSheetsIfMissing() {
  const ss = getSpreadsheet();

  // 1. جدول المرضى (Patients_DB)
  let pSheet = ss.getSheetByName(SHEET_PATIENTS);
  if (!pSheet) {
    pSheet = ss.insertSheet(SHEET_PATIENTS);
    const headers = [
      "Patient ID",
      "Full Name",
      "Phone",
      "Date of Birth",
      "Age",
      "Gender",
      "Family Tag",
      "Diagnosis",
      "Clinical Notes",
      "Allergies",
      "Loyalty Points",
      "Medications (JSON)",
      "Vitals (JSON)",
      "Scans (JSON)",
      "Is Archived",
      "Archived Date",
      "Archive Reason",
      "Last Reminder Sent",
      "Created At",
      "Last Updated"
    ];
    pSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    pSheet.getRange(1, 1, 1, headers.length)
      .setFontWeight("bold")
      .setBackground("#0f6cbd")
      .setFontColor("#ffffff")
      .setHorizontalAlignment("center");
    pSheet.setFrozenRows(1);
  }

  // 2. جدول المتابعات السريرية (Clinical_FollowUps)
  let fSheet = ss.getSheetByName(SHEET_FOLLOWUPS);
  if (!fSheet) {
    fSheet = ss.insertSheet(SHEET_FOLLOWUPS);
    const headers = [
      "FollowUp ID",
      "Patient ID",
      "Patient Name",
      "Phone",
      "Type",
      "Drug",
      "Start Date",
      "Due Date",
      "Days Offset",
      "Adherence Rate (%)",
      "Systolic BP",
      "Diastolic BP",
      "Blood Glucose",
      "Heart Rate",
      "Milestone Title",
      "Notes",
      "Resolved",
      "Resolved At",
      "Created At",
      "Last Updated"
    ];
    fSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    fSheet.getRange(1, 1, 1, headers.length)
      .setFontWeight("bold")
      .setBackground("#1e3a5f")
      .setFontColor("#ffffff")
      .setHorizontalAlignment("center");
    fSheet.setFrozenRows(1);
  }

  // 3. جدول الإعدادات وقوالب الرسائل (Settings_Config)
  let sSheet = ss.getSheetByName(SHEET_SETTINGS);
  if (!sSheet) {
    sSheet = ss.insertSheet(SHEET_SETTINGS);
    const headers = ["Config Key", "Config Value", "Last Updated"];
    sSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sSheet.getRange(1, 1, 1, headers.length)
      .setFontWeight("bold")
      .setBackground("#3b82f6")
      .setFontColor("#ffffff");
    sSheet.setFrozenRows(1);
  }

  // 4. جدول سجل العمليات السحابية (Audit_Log)
  let lSheet = ss.getSheetByName(SHEET_AUDIT_LOG);
  if (!lSheet) {
    lSheet = ss.insertSheet(SHEET_AUDIT_LOG);
    const headers = ["Timestamp", "Action", "Details"];
    lSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    lSheet.getRange(1, 1, 1, headers.length)
      .setFontWeight("bold")
      .setBackground("#292929")
      .setFontColor("#ffffff");
    lSheet.setFrozenRows(1);
  }
}

// ============================================================================
// 5. Data Access & Persistence Functions
// ============================================================================

/**
 * حفظ أو تحديث قائمة المرضى في الشيت
 */
function savePatientsToSheet(patients) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_PATIENTS);
  if (!sheet) return;

  const nowStr = new Date().toISOString();
  const data = sheet.getDataRange().getValues();
  const idToRowMap = {};
  for (let r = 1; r < data.length; r++) {
    const id = data[r][0];
    if (id) idToRowMap[id] = r + 1;
  }

  const rowsToAppend = [];

  patients.forEach(p => {
    const rowValues = [
      p.id || "",
      p.name || "",
      p.phone || "",
      p.dob || "",
      p.age !== undefined ? p.age : "",
      p.gender || "",
      p.familyTag || "",
      p.diagnosis || "",
      p.notes || "",
      p.allergies || "",
      p.loyaltyPoints !== undefined ? p.loyaltyPoints : 0,
      JSON.stringify(p.medications || []),
      JSON.stringify(p.vitals || []),
      JSON.stringify(p.scans || []),
      p.isArchived ? "TRUE" : "FALSE",
      p.archivedDate || "",
      p.archiveReason || "",
      p.lastReminderSent || "",
      p.createdAt || nowStr,
      nowStr
    ];

    if (p.id && idToRowMap[p.id]) {
      sheet.getRange(idToRowMap[p.id], 1, 1, rowValues.length).setValues([rowValues]);
    } else {
      rowsToAppend.push(rowValues);
    }
  });

  if (rowsToAppend.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rowsToAppend.length, rowsToAppend[0].length).setValues(rowsToAppend);
  }
}

/**
 * حذف مريض نهائياً من ورقة Patients_DB
 */
function deletePatientFromSheet(patientId) {
  if (!patientId) return false;
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_PATIENTS);
  if (!sheet) return false;

  const data = sheet.getDataRange().getValues();
  for (let r = data.length - 1; r >= 1; r--) {
    if (String(data[r][0]).trim() === String(patientId).trim()) {
      sheet.deleteRow(r + 1);
      return true;
    }
  }
  return false;
}

/**
 * حذف كافة المتابعات السريرية المرتبطة بمريض محدد
 */
function deleteFollowUpsForPatient(patientId) {
  if (!patientId) return;
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_FOLLOWUPS);
  if (!sheet) return;

  const data = sheet.getDataRange().getValues();
  for (let r = data.length - 1; r >= 1; r--) {
    if (String(data[r][1]).trim() === String(patientId).trim()) {
      sheet.deleteRow(r + 1);
    }
  }
}

/**
 * حفظ أو تحديث المتابعات السريرية في الشيت
 */
function saveFollowUpsToSheet(followUps) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_FOLLOWUPS);
  if (!sheet) return;

  const nowStr = new Date().toISOString();
  const data = sheet.getDataRange().getValues();
  const idToRowMap = {};
  for (let r = 1; r < data.length; r++) {
    const id = data[r][0];
    if (id) idToRowMap[id] = r + 1;
  }

  const rowsToAppend = [];

  followUps.forEach(f => {
    const adherence = f.adherenceRate !== undefined ? f.adherenceRate : (f.adherenceScore !== undefined ? f.adherenceScore : "");
    const glucose = f.bloodGlucose !== undefined ? f.bloodGlucose : (f.glucose !== undefined ? f.glucose : "");

    const rowValues = [
      f.id || "",
      f.patientId || "",
      f.patientName || "",
      f.phone || "",
      f.type || "",
      f.drug || "",
      f.startDate || "",
      f.dueDate || "",
      f.daysOffset !== undefined ? f.daysOffset : 0,
      adherence,
      f.systolic !== undefined ? f.systolic : "",
      f.diastolic !== undefined ? f.diastolic : "",
      glucose,
      f.heartRate !== undefined ? f.heartRate : "",
      f.milestoneTitle || "",
      f.notes || "",
      f.resolved ? "TRUE" : "FALSE",
      f.resolvedAt || "",
      f.createdAt || nowStr,
      nowStr
    ];

    if (f.id && idToRowMap[f.id]) {
      sheet.getRange(idToRowMap[f.id], 1, 1, rowValues.length).setValues([rowValues]);
    } else {
      rowsToAppend.push(rowValues);
    }
  });

  if (rowsToAppend.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rowsToAppend.length, rowsToAppend[0].length).setValues(rowsToAppend);
  }
}

/**
 * قراءة كافة المرضى بصيغة متوافقة 100% مع واجهة PharmPulse
 */
function getAllPatientsFromSheet() {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_PATIENTS);
  if (!sheet) return [];

  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return [];

  const patients = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row[0]) continue;

    let medications = [];
    let vitals = [];
    let scans = [];

    try { medications = row[11] ? JSON.parse(row[11]) : []; } catch (e) {}
    try { vitals = row[12] ? JSON.parse(row[12]) : []; } catch (e) {}
    try { scans = row[13] ? JSON.parse(row[13]) : []; } catch (e) {}

    if (medications.length === 0 && row[9]) {
      try { medications = JSON.parse(row[9]); } catch(e) {}
    }
    if (vitals.length === 0 && row[10]) {
      try { vitals = JSON.parse(row[10]); } catch(e) {}
    }

    patients.push({
      id: String(row[0]),
      name: String(row[1] || ""),
      phone: String(row[2] || ""),
      dob: row[3] ? String(row[3]) : undefined,
      age: row[4] !== "" ? Number(row[4]) : (row[3] && !isNaN(Number(row[3])) ? Number(row[3]) : undefined),
      gender: row[5] ? String(row[5]) : (row[4] ? String(row[4]) : ""),
      familyTag: row[6] ? String(row[6]) : (row[5] ? String(row[5]) : undefined),
      diagnosis: String(row[7] || row[6] || ""),
      notes: String(row[8] || ""),
      allergies: String(row[9] || row[7] || ""),
      loyaltyPoints: row[10] !== "" ? Number(row[10]) : (row[8] !== "" ? Number(row[8]) : 0),
      medications: medications,
      vitals: vitals,
      scans: scans,
      isArchived: String(row[14]).toUpperCase() === "TRUE" || String(row[12]).toUpperCase() === "TRUE",
      archivedDate: row[15] ? String(row[15]) : undefined,
      archiveReason: row[16] ? String(row[16]) : undefined,
      lastReminderSent: row[17] ? String(row[17]) : undefined,
      createdAt: row[18] ? String(row[18]) : (row[13] ? String(row[13]) : new Date().toISOString())
    });
  }

  return patients;
}

/**
 * قراءة كافة المتابعات السريرية
 */
function getAllFollowUpsFromSheet() {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_FOLLOWUPS);
  if (!sheet) return [];

  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return [];

  const followUps = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row[0]) continue;

    followUps.push({
      id: String(row[0]),
      patientId: String(row[1] || ""),
      patientName: String(row[2] || ""),
      phone: String(row[3] || ""),
      type: String(row[4] || "CHRONIC_INIT"),
      drug: String(row[5] || ""),
      startDate: String(row[6] || ""),
      dueDate: String(row[7] || ""),
      daysOffset: row[8] !== "" ? Number(row[8]) : 0,
      adherenceRate: row[9] !== "" ? Number(row[9]) : undefined,
      systolic: row[10] !== "" ? Number(row[10]) : undefined,
      diastolic: row[11] !== "" ? Number(row[11]) : undefined,
      bloodGlucose: row[12] !== "" ? Number(row[12]) : undefined,
      heartRate: row[13] !== "" ? Number(row[13]) : undefined,
      milestoneTitle: row[14] ? String(row[14]) : undefined,
      notes: String(row[15] || row[13] || ""),
      resolved: String(row[16]).toUpperCase() === "TRUE" || String(row[14]).toUpperCase() === "TRUE",
      resolvedAt: row[17] ? String(row[17]) : undefined,
      createdAt: row[18] ? String(row[18]) : String(row[6] || new Date().toISOString())
    });
  }

  return followUps;
}

/**
 * حفظ إعدادات النظام في الشيت
 */
function saveSettingsToSheet(settings) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_SETTINGS);
  if (!sheet) return;

  const keys = Object.keys(settings);
  const now = new Date().toISOString();
  const data = sheet.getDataRange().getValues();
  const keyToRowMap = {};

  for (let r = 1; r < data.length; r++) {
    const k = data[r][0];
    if (k) keyToRowMap[k] = r + 1;
  }

  keys.forEach(k => {
    const val = typeof settings[k] === 'object' ? JSON.stringify(settings[k]) : String(settings[k]);
    if (keyToRowMap[k]) {
      sheet.getRange(keyToRowMap[k], 2, 1, 2).setValues([[val, now]]);
    } else {
      sheet.appendRow([k, val, now]);
    }
  });
}

/**
 * قراءة إعدادات النظام من الشيت
 */
function getSettingsFromSheet() {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_SETTINGS);
  if (!sheet) return null;

  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return null;

  const conf = {};
  for (let r = 1; r < rows.length; r++) {
    const k = rows[r][0];
    const v = rows[r][1];
    if (k) conf[k] = v;
  }
  return conf;
}

// ============================================================================
// 6. Google Drive Storage (حفظ صور الروشتات والتحاليل)
// ============================================================================

/**
 * حفظ ملف Base64 في مجلد Google Drive والحصول على رابط مباشر
 */
function saveBase64ImageToDrive(patientId, fileName, base64Data) {
  if (!base64Data) return "";

  let folder;
  const folders = DriveApp.getFoldersByName(DRIVE_FOLDER_NAME);
  if (folders.hasNext()) {
    folder = folders.next();
  } else {
    folder = DriveApp.createFolder(DRIVE_FOLDER_NAME);
  }

  const cleanBase64 = base64Data.replace(/^data:image\\/(png|jpeg|jpg|webp);base64,/, "");
  const decoded = Utilities.base64Decode(cleanBase64);
  const blob = Utilities.newBlob(decoded, "image/jpeg", (patientId || "Patient") + "_" + (fileName || "rx_scan.jpg"));
  const file = folder.createFile(blob);
  
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  return file.getUrl();
}

// ============================================================================
// 7. Audit Logging & Utilities
// ============================================================================

function logAudit(action, details) {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_AUDIT_LOG);
    if (sheet) {
      sheet.appendRow([new Date(), action, details]);
    }
  } catch (e) {
    Logger.log("Audit log failed: " + e.toString());
  }
}

function getPatientsCount() {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_PATIENTS);
    return sheet ? Math.max(0, sheet.getLastRow() - 1) : 0;
  } catch(e) {
    return 0;
  }
}

function getFollowUpsCount() {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_FOLLOWUPS);
    return sheet ? Math.max(0, sheet.getLastRow() - 1) : 0;
  } catch(e) {
    return 0;
  }
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * صفحة فحص الحالة التفاعلية عند فتح الرابط في المتصفح
 */
function renderStatusHtmlPage(ss) {
  const pCount = getPatientsCount();
  const fCount = getFollowUpsCount();
  const html = \`
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>خادم PharmPulse CRM السحابي متصل بنجاح</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
        .card { background: #1e293b; border: 1px solid #334155; border-radius: 20px; max-width: 580px; width: 100%; padding: 35px; box-shadow: 0 20px 40px rgba(0,0,0,0.5); text-align: center; }
        .badge { display: inline-flex; align-items: center; gap: 8px; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.4); color: #34d399; padding: 6px 16px; border-radius: 999px; font-weight: bold; font-size: 14px; margin-bottom: 20px; }
        .dot { width: 10px; height: 10px; background: #10b981; border-radius: 50%; box-shadow: 0 0 10px #10b981; }
        h1 { font-size: 22px; color: #38bdf8; margin-bottom: 12px; }
        p { color: #94a3b8; font-size: 14px; line-height: 1.6; margin-bottom: 25px; }
        .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 25px; }
        .stat-box { background: #0f172a; border: 1px solid #334155; border-radius: 12px; padding: 15px; text-align: center; }
        .stat-val { font-size: 24px; font-weight: bold; color: #38bdf8; margin-top: 5px; }
        .stat-lbl { font-size: 12px; color: #64748b; }
        .details-box { text-align: right; background: #0f172a; border: 1px solid #334155; border-radius: 12px; padding: 18px; font-family: monospace; font-size: 13px; line-height: 2; color: #cbd5e1; margin-bottom: 20px; }
        .success-text { color: #38bdf8; font-weight: bold; }
        .hint { font-size: 12px; color: #64748b; line-height: 1.6; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="badge">
          <span class="dot"></span>
          <span>السكريبت يعمل ومتصل بالسحابة بنجاح!</span>
        </div>
        <h1>🏥 خادم مزامنة PharmPulse Enterprise</h1>
        <p>تم نشر خادم Google Apps Script بنجاح، وهو جاهز لاستقبال وإرسال بيانات الصيدلية السريرية لحظياً.</p>
        
        <div class="stats-grid">
          <div class="stat-box">
            <div class="stat-lbl">المرضى المسجلين</div>
            <div class="stat-val">\${pCount}</div>
          </div>
          <div class="stat-box">
            <div class="stat-lbl">المتابعات السريرية</div>
            <div class="stat-val">\${fCount}</div>
          </div>
        </div>

        <div class="details-box">
          <div>📊 جدول البيانات: <span class="success-text">\${ss ? ss.getName() : "متصل مباشرة"}</span></div>
          <div>📁 تخزين الصور: <span class="success-text">Google Drive (\${DRIVE_FOLDER_NAME})</span></div>
          <div>⏱️ وقت السيرفر: <span class="success-text">\${new Date().toLocaleString()}</span></div>
          <div>⚡ الحالة: <span class="success-text">جاهز لاستقبال طلبات المزامنة</span></div>
        </div>

        <div class="hint">
          قم بنسخ رابط هذه الصفحة وضعه في حقل <b>Google Apps Script Web App URL</b> داخل إعدادات PharmPulse لتفعيل المزامنة التلقائية.
        </div>
      </div>
    </body>
    </html>
  \`;
  return HtmlService.createHtmlOutput(html)
    .setTitle("PharmPulse Enterprise Cloud API Online")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}`;

  // Interactive diagnostic runner
  const handleRunDiagnostic = async () => {
    if (!formData.gasUrl || !formData.gasUrl.trim()) return;
    setIsDiagnosing(true);
    setShowDiagnosticModal(true);
    try {
      const res = await testSheetConnectionDetailed(formData.gasUrl);
      setDiagnosticResult(res);
      if (res.success) {
        onTestSheetConnection();
      }
    } catch (err: any) {
      setDiagnosticResult({
        success: false,
        message: err.message || 'فشل الاتصال',
        tip: 'تحقق من اتصال الإنترنت ومن نسخ الرابط كاملاً.',
      });
    } finally {
      setIsDiagnosing(false);
    }
  };

  const handleFixDevUrl = () => {
    if (urlValidation.normalizedUrl) {
      setFormData({ ...formData, gasUrl: urlValidation.normalizedUrl });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings(formData);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header Banner */}
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

          <div className="space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="text-xs font-semibold text-neutral-300 light:text-neutral-700 flex items-center gap-1.5">
                <span>{lang === 'ar' ? 'رابط Google Apps Script Web App URL' : 'Google Apps Script Web App URL'}</span>
                <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 text-[10px] font-mono">/exec</span>
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowScriptModal(true)}
                  className="text-[11px] font-bold text-amber-400 hover:text-amber-300 hover:underline flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-950/40 border border-amber-800/40 transition-colors"
                >
                  <Code className="w-3.5 h-3.5 text-amber-400" />
                  <span>{lang === 'ar' ? 'كود Apps Script الكامل والتعليمات (Code.gs)' : 'Full Apps Script & Guide'}</span>
                </button>

                {formData.gasUrl && (
                  <button
                    type="button"
                    onClick={handleRunDiagnostic}
                    disabled={isDiagnosing}
                    className="text-[11px] font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-950/40 border border-blue-800/40 hover:bg-blue-900/60 transition-colors cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isDiagnosing ? 'animate-spin' : ''}`} />
                    <span>{isDiagnosing ? (lang === 'ar' ? 'جارِ الفحص...' : 'Testing...') : (lang === 'ar' ? 'فحص واختبار الاتصال' : 'Test Sync')}</span>
                  </button>
                )}

                {formData.gasUrl && onPushLocalToSheet && (
                  <button
                    type="button"
                    onClick={onPushLocalToSheet}
                    className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/40 border border-emerald-800/40 hover:bg-emerald-900/60 transition-colors cursor-pointer"
                    title={lang === 'ar' ? 'رفع وتصدير السجلات المحلية لتزويد الشيت' : 'Push local records to Google Sheet'}
                  >
                    <Upload className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{lang === 'ar' ? 'تزويد الشيت محلياً' : 'Push Local Data'}</span>
                  </button>
                )}
              </div>
            </div>

            <div className="relative">
              <input
                type="url"
                value={formData.gasUrl}
                onChange={e => setFormData({ ...formData, gasUrl: e.target.value })}
                placeholder="https://script.google.com/macros/s/.../exec"
                className={`w-full bg-[#141414] light:bg-neutral-50 border text-white light:text-neutral-900 text-xs rounded-lg p-2.5 font-mono outline-none transition-colors ${
                  formData.gasUrl && !urlValidation.isValid
                    ? 'border-amber-500/80 focus:border-amber-500'
                    : 'border-[#383838] light:border-neutral-300 focus:border-blue-500'
                }`}
              />
              {formData.gasUrl && urlValidation.isValid && (
                <div className="absolute left-3 top-2.5 text-emerald-400 flex items-center gap-1 text-[11px]">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              )}
            </div>

            {/* Smart Live Diagnostic Warnings */}
            {formData.gasUrl && !urlValidation.isValid && (
              <div className="p-3 rounded-lg bg-amber-950/30 border border-amber-800/50 space-y-2 text-xs">
                <div className="flex items-start gap-2 text-amber-300 font-semibold">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                  <span>{urlValidation.error || urlValidation.warning}</span>
                </div>
                {urlValidation.tip && (
                  <p className="text-neutral-300 text-[11px] leading-relaxed mr-6">
                    {urlValidation.tip}
                  </p>
                )}
                {urlValidation.warning?.includes('/dev') && (
                  <button
                    type="button"
                    onClick={handleFixDevUrl}
                    className="mr-6 px-3 py-1 bg-amber-500 hover:bg-amber-400 text-black font-bold text-[11px] rounded transition-colors"
                  >
                    {lang === 'ar' ? '⚡ تحويل الرابط تلقائياً إلى /exec' : 'Auto-fix URL to /exec'}
                  </button>
                )}
              </div>
            )}

            <div className="text-[11px] text-neutral-400 flex items-center justify-between">
              <span>
                {lang === 'ar'
                  ? 'يتيح المزامنة اللحظية ثنائية الاتجاه مع Google Sheets وحفظ صور التحاليل والوصفات الطبية في Google Drive.'
                  : 'Enables 2-way sync with Google Sheets and prescription storage in Google Drive.'}
              </span>
              <a
                href="/download/Code.gs"
                download="Code.gs"
                className="text-blue-400 hover:underline flex items-center gap-1 font-semibold"
              >
                <Download className="w-3 h-3" />
                <span>{lang === 'ar' ? 'تحميل ملف Code.gs' : 'Download Code.gs'}</span>
              </a>
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
              className="w-full bg-[#141414] light:bg-neutral-50 border border-[#383838] light:border-neutral-300 text-white light:text-neutral-900 text-xs rounded-lg p-2.5 outline-none focus:border-blue-500 leading-relaxed"
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
              className="w-full bg-[#141414] light:bg-neutral-50 border border-[#383838] light:border-neutral-300 text-white light:text-neutral-900 text-xs rounded-lg p-2.5 outline-none focus:border-blue-500 leading-relaxed"
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
              className="w-full bg-[#141414] light:bg-neutral-50 border border-[#383838] light:border-neutral-300 text-white light:text-neutral-900 text-xs rounded-lg p-2.5 outline-none focus:border-blue-500 leading-relaxed"
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
              className="w-full bg-[#141414] light:bg-neutral-50 border border-[#383838] light:border-neutral-300 text-white light:text-neutral-900 text-xs rounded-lg p-2.5 outline-none focus:border-blue-500 leading-relaxed"
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
                <div className="font-bold text-sm text-white light:text-neutral-900 flex items-center gap-2">
                  <span>{lang === 'ar' ? 'نشر الموقع واستضافته على Netlify مجاناً' : 'Deploy & Host on Netlify'}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30 font-bold">
                    {lang === 'ar' ? 'جاهز للنشر بنقرة واحدة' : 'Production Ready'}
                  </span>
                </div>
                <p className="text-xs text-neutral-400 light:text-neutral-500 mt-0.5">
                  {lang === 'ar'
                    ? 'تم بناء المشروع وتجهيز ملفات الاستضافة (dist) في حزمة مضغوطة جاهزة للسحب والإفلات على app.netlify.com/drop.'
                    : 'The project is pre-built into dist.zip ready for instant drag-and-drop on Netlify Drop or GitHub.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <a
                href="/download/dist.zip"
                download="pharmpulse-netlify-dist.zip"
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow-md transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>{lang === 'ar' ? 'تحميل حزمة النشر (dist.zip)' : 'Download dist.zip'}</span>
              </a>

              <button
                type="button"
                onClick={() => setShowNetlifyModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 text-xs font-semibold transition-colors"
              >
                <HelpCircle className="w-4 h-4 text-teal-400" />
                <span>{lang === 'ar' ? 'دليل خطوات الاستضافة بالتفصيل' : 'View Netlify Guide'}</span>
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* ========================================================================= */}
      {/* 1. Full Google Apps Script Backend Code Modal                             */}
      {/* ========================================================================= */}
      {showScriptModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1a1a1a] border border-[#383838] rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-[#383838] flex items-center justify-between bg-[#141414]">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
                  <Code className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-extrabold text-sm text-white flex items-center gap-2">
                    <span>{lang === 'ar' ? 'كود Google Apps Script لقاعدة بيانات Google Sheet الكاملة' : 'Full Google Apps Script Backend (Code.gs)'}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                      الإصدار 3.0.0 Enterprise • كامل 100%
                    </span>
                  </div>
                  <div className="text-[11px] text-neutral-400">
                    {lang === 'ar' ? 'يدعم المزامنة اللحظية ثنائية الاتجاه، رفع التحاليل لـ Drive، وقوائم الشيت التفاعلية' : 'Supports 2-way sync, Google Drive Rx scans & interactive Sheet menus'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowScriptModal(false)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center border-b border-[#383838] bg-[#161616] px-4 gap-2">
              <button
                type="button"
                onClick={() => setScriptModalTab('code')}
                className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 ${
                  scriptModalTab === 'code'
                    ? 'border-amber-400 text-amber-300 bg-amber-500/5'
                    : 'border-transparent text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <FileCode className="w-4 h-4" />
                <span>{lang === 'ar' ? 'كود السكريبت الكامل (Code.gs)' : 'Full Script (Code.gs)'}</span>
              </button>

              <button
                type="button"
                onClick={() => setScriptModalTab('instructions')}
                className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 ${
                  scriptModalTab === 'instructions'
                    ? 'border-blue-400 text-blue-300 bg-blue-500/5'
                    : 'border-transparent text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <HelpCircle className="w-4 h-4" />
                <span>{lang === 'ar' ? 'خطوات التثبيت المصورة' : 'Step-by-Step Guide'}</span>
              </button>

              <button
                type="button"
                onClick={() => setScriptModalTab('faq')}
                className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 ${
                  scriptModalTab === 'faq'
                    ? 'border-emerald-400 text-emerald-300 bg-emerald-500/5'
                    : 'border-transparent text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{lang === 'ar' ? 'حل مشكلات الاتصال الشائعة' : 'Troubleshooting'}</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 space-y-4 overflow-y-auto flex-1 text-xs">
              {scriptModalTab === 'code' && (
                <div className="space-y-3">
                  {/* Action Bar */}
                  <div className="flex items-center justify-between flex-wrap gap-2 p-3 rounded-xl bg-neutral-900 border border-neutral-800">
                    <div className="flex items-center gap-2 text-neutral-300">
                      <span className="font-semibold">{lang === 'ar' ? 'الملف:' : 'File:'}</span>
                      <code className="text-amber-400 font-mono font-bold bg-black/40 px-2 py-0.5 rounded">Code.gs</code>
                      <span className="text-neutral-500">• 480 سطر برمجي</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <a
                        href="/download/Code.gs"
                        download="Code.gs"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs shadow transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>{lang === 'ar' ? 'تحميل ملف Code.gs' : 'Download Code.gs'}</span>
                      </a>

                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(APPS_SCRIPT_CODE);
                          setCopiedCode(true);
                          setTimeout(() => setCopiedCode(false), 2500);
                        }}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow transition-colors cursor-pointer"
                      >
                        {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedCode ? (lang === 'ar' ? 'تم نسخ الكود بالكامل!' : 'Copied!') : (lang === 'ar' ? 'نسخ الكود بالكامل' : 'Copy Full Script')}</span>
                      </button>
                    </div>
                  </div>

                  {/* Code Container */}
                  <div className="relative border border-[#383838] rounded-xl overflow-hidden bg-[#0d0d0d]">
                    <pre className="p-4 text-[11px] font-mono text-emerald-400 overflow-x-auto max-h-[500px] leading-relaxed selection:bg-emerald-900 selection:text-white">
                      {APPS_SCRIPT_CODE}
                    </pre>
                  </div>
                </div>
              )}

              {scriptModalTab === 'instructions' && (
                <div className="space-y-4 text-neutral-200">
                  <div className="p-4 rounded-xl bg-blue-950/30 border border-blue-800/40 space-y-2">
                    <div className="font-bold text-blue-300 text-sm flex items-center gap-2">
                      <span>🚀</span>
                      <span>{lang === 'ar' ? 'طريقة التركيب والربط خلال دقيقتين فقط:' : 'Quick Deployment in 2 Minutes:'}</span>
                    </div>
                    <p className="text-neutral-300 leading-relaxed text-xs">
                      {lang === 'ar'
                        ? 'اتبع هذه الخطوات الدقيقة لربط نظام PharmPulse مع Google Sheet الخاص بك:'
                        : 'Follow these exact steps to connect PharmPulse with your Google Sheet:'}
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="p-3.5 bg-neutral-900 border border-neutral-800 rounded-xl space-y-1">
                      <div className="font-bold text-white flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] flex items-center justify-center font-bold">1</span>
                        <span>{lang === 'ar' ? 'فتح جدول بيانات Google Sheet:' : 'Open Google Sheet:'}</span>
                      </div>
                      <p className="text-neutral-400 text-xs mr-7">
                        {lang === 'ar'
                          ? 'افتح جدول بيانات جديد من sheets.new، أو استخدم جدولك الحالي.'
                          : 'Create a new Google Sheet at sheets.new or open an existing one.'}
                      </p>
                    </div>

                    <div className="p-3.5 bg-neutral-900 border border-neutral-800 rounded-xl space-y-1">
                      <div className="font-bold text-white flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] flex items-center justify-center font-bold">2</span>
                        <span>{lang === 'ar' ? 'فتح محرر Apps Script:' : 'Open Apps Script:'}</span>
                      </div>
                      <p className="text-neutral-400 text-xs mr-7">
                        {lang === 'ar'
                          ? 'من القائمة العلوية داخل الشيت، اضغط على: الامتدادات (Extensions) > Apps Script.'
                          : 'In Google Sheets top menu, click Extensions > Apps Script.'}
                      </p>
                    </div>

                    <div className="p-3.5 bg-neutral-900 border border-neutral-800 rounded-xl space-y-1">
                      <div className="font-bold text-white flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] flex items-center justify-center font-bold">3</span>
                        <span>{lang === 'ar' ? 'لصق الكود وحفظه:' : 'Paste & Save Code:'}</span>
                      </div>
                      <p className="text-neutral-400 text-xs mr-7">
                        {lang === 'ar'
                          ? 'احذف أي كود موجود في الملف الافتراضي Code.gs، والصق الكود الكامل من التبويب السابق، ثم اضغط على زر الحفظ (💾).'
                          : 'Delete any template code in Code.gs, paste the full code, and press Save (💾).'}
                      </p>
                    </div>

                    <div className="p-3.5 bg-amber-950/20 border border-amber-800/40 rounded-xl space-y-2">
                      <div className="font-bold text-amber-300 flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-amber-500 text-black text-[11px] flex items-center justify-center font-bold">4</span>
                        <span>{lang === 'ar' ? 'نشر تطبيق الويب (New Deployment) - الخطوة الأهم:' : 'Deploy as Web App (Crucial Step):'}</span>
                      </div>
                      <div className="mr-7 space-y-1.5 text-neutral-300 text-xs">
                        <p>• اضغط في أعلى اليمين على <strong>Deploy (نشر)</strong> &gt; <strong>New deployment (نشر جديد)</strong>.</p>
                        <p>• اضغط على أيقونة الترس ⚙️ واختر <strong>Web app (تطبيق ويب)</strong>.</p>
                        <p>• في خانة <strong>Execute as</strong> اختر: <strong className="text-white">Me (أنا)</strong>.</p>
                        <p className="p-2 rounded bg-amber-500/20 border border-amber-500/40 text-amber-200 font-bold">
                          ⚠️ في خانة "Who has access" (من لديه إذن الوصول) اختر: "Anyone" (أي شخص).
                          <br />
                          <span className="font-normal text-[11px] text-neutral-300">
                            (تنبيه: إذا اخترت "Only myself" أو "Anyone with Google account" لن يتمكن الموقع من الاتصال بالشيت!)
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="p-3.5 bg-neutral-900 border border-neutral-800 rounded-xl space-y-1">
                      <div className="font-bold text-white flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] flex items-center justify-center font-bold">5</span>
                        <span>{lang === 'ar' ? 'منح الصلاحيات ونسخ الرابط:' : 'Authorize & Copy Link:'}</span>
                      </div>
                      <p className="text-neutral-400 text-xs mr-7">
                        {lang === 'ar'
                          ? 'اضغط Deploy ثم Authorize access > اختر حساب Google > Advanced (خيارات متقدمة) > Go to PharmPulse (غير آمن) > Allow (سماح). ثم انسخ الرابط المنتهي بـ /exec وضعه في إعدادات PharmPulse.'
                          : 'Click Deploy, Authorize access, select your Google account, Advanced > Go to PharmPulse > Allow. Copy the Web App URL (ends with /exec).'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {scriptModalTab === 'faq' && (
                <div className="space-y-3 text-neutral-200">
                  <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl space-y-2">
                    <div className="font-bold text-amber-400 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{lang === 'ar' ? 'المشكلة 1: "فشل الاتصال" أو "محفوظ محلياً فقط"' : 'Issue 1: Connection failed'}</span>
                    </div>
                    <p className="text-xs text-neutral-300 leading-relaxed">
                      {lang === 'ar'
                        ? 'السبب الأكثر شيوعاً هو اختيار "Only myself" أو "Anyone with Google account" عند النشر، مما يجعل Google يطلب تسجيل الدخول ويرفض طلبات المتصفح. الحل: افتح Apps Script > اضغط Deploy > Manage deployments > اضغط تعديل على Web app واختر في Who has access: "Anyone" ثم اضغط Deploy.'
                        : 'Most common cause: "Who has access" was not set to "Anyone". Edit deployment and set access to Anyone.'}
                    </p>
                  </div>

                  <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl space-y-2">
                    <div className="font-bold text-amber-400 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{lang === 'ar' ? 'المشكلة 2: وضع رابط Google Sheet بدلاً من رابط الـ Web App' : 'Issue 2: Google Sheet URL pasted instead of Web App'}</span>
                    </div>
                    <p className="text-xs text-neutral-300 leading-relaxed">
                      {lang === 'ar'
                        ? 'تأكد من أن الرابط يبدأ بـ https://script.google.com/macros/s/ وينتهي بـ /exec وليس رابط docs.google.com/spreadsheets.'
                        : 'Ensure your URL starts with https://script.google.com/macros/s/ and ends with /exec.'}
                    </p>
                  </div>

                  <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl space-y-2">
                    <div className="font-bold text-amber-400 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{lang === 'ar' ? 'المشكلة 3: الرابط ينتهي بـ /dev بدلاً من /exec' : 'Issue 3: URL ends with /dev instead of /exec'}</span>
                    </div>
                    <p className="text-xs text-neutral-300 leading-relaxed">
                      {lang === 'ar'
                        ? 'رابط /dev هو وضع الاختبار الذي يتطلب تسجيل الدخول ولا يقبل الربط الخارجي. قم باستبدال كلمة dev بكلمة exec في نهاية الرابط، أو انسخ الرابط من New deployment.'
                        : 'Replace /dev with /exec at the end of the URL.'}
                    </p>
                  </div>

                  <div className="p-4 bg-emerald-950/30 border border-emerald-800/40 rounded-xl space-y-2">
                    <div className="font-bold text-emerald-300 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>{lang === 'ar' ? 'كيف تتأكد أن السكريبت يعمل 100%؟' : 'How to verify your script is working 100%?'}</span>
                    </div>
                    <p className="text-xs text-neutral-300 leading-relaxed">
                      {lang === 'ar'
                        ? 'قم بفتح رابط الـ Web App مباشرة في لسان جديد بالمتصفح. إذا ظهرت لك صفحة باللون الأخضر مكتوب فيها "السكريبت يعمل ومتصل بالسحابة بنجاح!" فذلك يعني أن نشرك صحيح ومكتمل وجاهز للمزامنة مع PharmPulse!'
                        : 'Open the Web App URL directly in a browser tab. If you see the green status page saying "API Online", your deployment is 100% ready!'}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-[#141414] border-t border-[#383838] flex items-center justify-between">
              <a
                href="/download/Code.gs"
                download="Code.gs"
                className="px-3.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? 'تحميل ملف Code.gs' : 'Download Code.gs'}</span>
              </a>

              <button
                type="button"
                onClick={() => setShowScriptModal(false)}
                className="px-5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                {lang === 'ar' ? 'إغلاق' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. Interactive Cloud Connection Diagnostics Modal                         */}
      {/* ========================================================================= */}
      {showDiagnosticModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1f1f1f] border border-[#383838] rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-[#383838] flex items-center justify-between bg-[#191919]">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-400" />
                <span className="font-bold text-sm text-white">
                  {lang === 'ar' ? 'تقرير فحص وتشخيص الاتصال السحابي' : 'Cloud Connection Diagnostics Report'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowDiagnosticModal(false)}
                className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              {isDiagnosing ? (
                <div className="py-8 text-center space-y-3">
                  <RefreshCw className="w-8 h-8 text-blue-400 animate-spin mx-auto" />
                  <div className="font-bold text-white text-sm">
                    {lang === 'ar' ? 'جارِ فحص الاتصال بالخادم السحابي...' : 'Testing Cloud Connection...'}
                  </div>
                  <p className="text-neutral-400 text-xs">
                    {lang === 'ar' ? 'يتم اختبار الاستجابة والصلاحيات وقراءة السجلات.' : 'Verifying endpoint handshake and permissions.'}
                  </p>
                </div>
              ) : diagnosticResult ? (
                <div className="space-y-4">
                  {/* Status Banner */}
                  <div className={`p-4 rounded-xl border flex items-start gap-3 ${
                    diagnosticResult.success
                      ? 'bg-emerald-950/40 border-emerald-800/50 text-emerald-200'
                      : 'bg-rose-950/40 border-rose-800/50 text-rose-200'
                  }`}>
                    {diagnosticResult.success ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                    )}
                    <div className="space-y-1">
                      <div className="font-bold text-sm">
                        {diagnosticResult.message}
                      </div>
                      {diagnosticResult.tip && (
                        <p className="text-xs text-neutral-300 leading-relaxed">
                          {diagnosticResult.tip}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Diagnostic Details Grid */}
                  <div className="p-3 bg-neutral-900 border border-neutral-800 rounded-xl space-y-2 font-mono text-[11px]">
                    <div className="flex items-center justify-between text-neutral-300">
                      <span className="text-neutral-500">صيغة الرابط (URL Format):</span>
                      <span className={urlValidation.isValid ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                        {urlValidation.isValid ? 'صحيح (Valid /exec)' : 'يحتاج مراجعة'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-neutral-300">
                      <span className="text-neutral-500">حالة الاستجابة (Handshake):</span>
                      <span className={diagnosticResult.success ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                        {diagnosticResult.success ? '200 OK (متصل)' : 'فشل الاتصال'}
                      </span>
                    </div>

                    {diagnosticResult.patientsCount !== undefined && (
                      <div className="flex items-center justify-between text-neutral-300">
                        <span className="text-neutral-500">سجلات المرضى في الشيت:</span>
                        <span className="text-blue-400 font-bold">{diagnosticResult.patientsCount} مريض</span>
                      </div>
                    )}

                    {diagnosticResult.followUpsCount !== undefined && (
                      <div className="flex items-center justify-between text-neutral-300">
                        <span className="text-neutral-500">المتابعات السريرية:</span>
                        <span className="text-blue-400 font-bold">{diagnosticResult.followUpsCount} متابعة</span>
                      </div>
                    )}

                    {diagnosticResult.spreadsheetName && (
                      <div className="flex items-center justify-between text-neutral-300">
                        <span className="text-neutral-500">اسم جدول البيانات:</span>
                        <span className="text-emerald-400 font-bold">{diagnosticResult.spreadsheetName}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions depending on result */}
                  {!diagnosticResult.success && (
                    <div className="flex items-center justify-between gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowDiagnosticModal(false);
                          setShowScriptModal(true);
                          setScriptModalTab('faq');
                        }}
                        className="px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-black font-bold text-xs flex items-center gap-1.5 transition-colors"
                      >
                        <HelpCircle className="w-4 h-4" />
                        <span>{lang === 'ar' ? 'عرض حلول المشكلات في الدليل' : 'View Troubleshooting'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleRunDiagnostic}
                        className="px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white font-semibold text-xs"
                      >
                        {lang === 'ar' ? 'إعادة الفحص' : 'Retry'}
                      </button>
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            <div className="p-3 bg-[#191919] border-t border-[#383838] flex justify-end">
              <button
                type="button"
                onClick={() => setShowDiagnosticModal(false)}
                className="px-4 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold"
              >
                {lang === 'ar' ? 'إغلاق' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. Netlify Step-by-Step Guide Modal                                       */}
      {/* ========================================================================= */}
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
