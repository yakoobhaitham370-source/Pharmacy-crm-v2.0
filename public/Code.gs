/**
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
    `• حالة الاتصال: متصل وجاهز (Online)\n• اسم الشيت: ${ss.getName()}\n• عدد المرضى المسجلين: ${pCount}\n• عدد المتابعات السريرية: ${fCount}\n• التوقيت: ${new Date().toLocaleString()}`, 
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

function menuShowSummary() {
  const pCount = getPatientsCount();
  const fCount = getFollowUpsCount();
  SpreadsheetApp.getUi().alert("📊 ملخص بيانات PharmPulse CRM", 
    `قاعدة البيانات نشطة:\n- إجمالي المرضى: ${pCount} مريض\n- إجمالي المتابعات السريرية: ${fCount} متابعة\n- مجلد Google Drive: جاهز لاستقبال صور الروشتات`, 
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

function menuFormatTables() {
  initDatabaseSheetsIfMissing();
  SpreadsheetApp.getUi().alert("🎨 تم إعادة تنسيق الجداول وتثبيت صفوف العناوين وتطبيق الألوان الطبية بنجاح.");
}

function menuShowInstructions() {
  const html = HtmlService.createHtmlOutput(`
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
  `).setWidth(450).setHeight(300);
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

      logAudit("SYNC_ALL", `Synced ${patients.length} patients and ${followUps.length} follow-ups.`);

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
      logAudit("SAVE_PATIENT", `Saved patient ${payload.patient.name} (${payload.patient.id})`);
      return jsonResponse({ status: "SUCCESS", message: "Patient saved successfully" });
    }

    // 3. حفظ متابعة سريرية واحدة
    if (action === "SAVE_FOLLOWUP") {
      if (!payload.followUp || !payload.followUp.id) {
        return jsonResponse({ status: "ERROR", message: "Missing followUp payload" });
      }
      saveFollowUpsToSheet([payload.followUp]);
      logAudit("SAVE_FOLLOWUP", `Saved follow-up ${payload.followUp.id}`);
      return jsonResponse({ status: "SUCCESS", message: "Follow-up saved successfully" });
    }

    // 4. رفع صورة تحليل أو وصفة طبية إلى Google Drive
    if (action === "UPLOAD_SCAN" || action === "UPLOAD_IMAGE") {
      const fileUrl = saveBase64ImageToDrive(payload.patientId, payload.title, payload.base64Data);
      logAudit("UPLOAD_SCAN", `Uploaded scan for patient ${payload.patientId}`);
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
    if (!row[0]) continue; // تجاهل الصفوف الفارغة

    let medications = [];
    let vitals = [];
    let scans = [];

    try { medications = row[11] ? JSON.parse(row[11]) : []; } catch (e) {}
    try { vitals = row[12] ? JSON.parse(row[12]) : []; } catch (e) {}
    try { scans = row[13] ? JSON.parse(row[13]) : []; } catch (e) {}

    // دعم التوافقية مع التنسيقات السابقة
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

  const cleanBase64 = base64Data.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "");
  const decoded = Utilities.base64Decode(cleanBase64);
  const blob = Utilities.newBlob(decoded, "image/jpeg", (patientId || "Patient") + "_" + (fileName || "rx_scan.jpg"));
  const file = folder.createFile(blob);
  
  // جعل الرابط قابلاً للعرض من قبل أي شخص يمتلك الرابط
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
  const html = `
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
            <div class="stat-val">${pCount}</div>
          </div>
          <div class="stat-box">
            <div class="stat-lbl">المتابعات السريرية</div>
            <div class="stat-val">${fCount}</div>
          </div>
        </div>

        <div class="details-box">
          <div>📊 جدول البيانات: <span class="success-text">${ss ? ss.getName() : "متصل مباشرة"}</span></div>
          <div>📁 تخزين الصور: <span class="success-text">Google Drive (${DRIVE_FOLDER_NAME})</span></div>
          <div>⏱️ وقت السيرفر: <span class="success-text">${new Date().toLocaleString()}</span></div>
          <div>⚡ الحالة: <span class="success-text">جاهز لاستقبال طلبات المزامنة</span></div>
        </div>

        <div class="hint">
          قم بنسخ رابط هذه الصفحة وضعه في حقل <b>Google Apps Script Web App URL</b> داخل إعدادات PharmPulse لتفعيل المزامنة التلقائية.
        </div>
      </div>
    </body>
    </html>
  `;
  return HtmlService.createHtmlOutput(html)
    .setTitle("PharmPulse Enterprise Cloud API Online")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
