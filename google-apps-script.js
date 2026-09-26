/**
 * PharmPulse Enterprise - Google Apps Script Backend (Code.gs)
 * -------------------------------------------------------------
 * Instructions:
 * 1. Open your Google Sheet.
 * 2. Go to Extensions > Apps Script.
 * 3. Delete any code in Code.gs and paste this entire file.
 * 4. Click "Deploy" > "New deployment".
 * 5. Select type: "Web app".
 * 6. Set Description: "PharmPulse CRM API".
 * 7. Set "Execute as": "Me".
 * 8. Set "Who has access": "Anyone" (crucial for client-side CRM sync).
 * 9. Click "Deploy" and authorize the script.
 * 10. Copy the Web App URL (ends with /exec) and paste it into PharmPulse Settings.
 */

const SHEET_PATIENTS = "Patients_DB";
const SHEET_FOLLOWUPS = "Clinical_FollowUps";
const SHEET_AUDIT_LOG = "Audit_Log";
const DRIVE_FOLDER_NAME = "PharmPulse_Prescriptions_Labs";

/**
 * Handle HTTP GET Requests (Fetch Data via JSONP or direct JSON)
 */
function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || "FETCH_ALL";
    const callback = e && e.parameter && e.parameter.callback;

    let result = {};

    if (action === "FETCH_ALL" || action === "GET_DATA") {
      initDatabaseSheetsIfMissing();
      const patients = getAllPatientsFromSheet();
      const followUps = getAllFollowUpsFromSheet();

      result = {
        status: "SUCCESS",
        timestamp: new Date().toISOString(),
        patients: patients,
        followUps: followUps,
      };
    } else if (action === "PING") {
      result = { status: "SUCCESS", message: "PharmPulse Google Sheet API Online" };
    } else {
      result = { status: "ERROR", message: "Unknown GET action: " + action };
    }

    const jsonString = JSON.stringify(result);

    // Support JSONP for seamless cross-origin browser reads without CORS blocking
    if (callback) {
      return ContentService.createTextOutput(callback + "(" + jsonString + ")")
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }

    return ContentService.createTextOutput(jsonString)
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    const errorResponse = JSON.stringify({ status: "ERROR", message: err.toString() });
    if (e && e.parameter && e.parameter.callback) {
      return ContentService.createTextOutput(e.parameter.callback + "(" + errorResponse + ")")
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return ContentService.createTextOutput(errorResponse).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Handle HTTP POST Requests (Push updates from CRM into Google Sheets & Drive)
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
      return jsonResponse({ status: "ERROR", message: "Invalid JSON payload: " + parseErr });
    }

    const action = payload.action || "SYNC_UPSTREAM";

    if (action === "SYNC_UPSTREAM" || action === "SAVE_ALL") {
      const patients = payload.patients || [];
      const followUps = payload.followUps || [];

      if (Array.isArray(patients)) {
        savePatientsToSheet(patients);
      }
      if (Array.isArray(followUps)) {
        saveFollowUpsToSheet(followUps);
      }

      logAudit("FULL_SYNC", "Synchronized " + patients.length + " patients & " + followUps.length + " follow-ups.");

      return jsonResponse({
        status: "SUCCESS",
        message: "Successfully synchronized database",
        patientsCount: patients.length,
        followUpsCount: followUps.length,
        timestamp: new Date().toISOString()
      });
    }

    if (action === "UPLOAD_SCAN" || action === "UPLOAD_IMAGE") {
      const fileUrl = saveBase64ImageToDrive(payload.patientId, payload.title, payload.base64Data);
      return jsonResponse({
        status: "SUCCESS",
        fileUrl: fileUrl
      });
    }

    return jsonResponse({ status: "ERROR", message: "Unhandled action: " + action });

  } catch (err) {
    logAudit("ERROR", err.toString());
    return jsonResponse({ status: "ERROR", message: err.toString() });
  }
}

/**
 * Helper to return JSON response with CORS headers
 */
function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Initialize Sheets and Column Headers if they do not exist
 */
function initDatabaseSheetsIfMissing() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. Patients DB Sheet
  let pSheet = ss.getSheetByName(SHEET_PATIENTS);
  if (!pSheet) {
    pSheet = ss.insertSheet(SHEET_PATIENTS);
    const headers = [
      "Patient ID",
      "Full Name",
      "Phone",
      "Age",
      "Gender",
      "Family Tag",
      "Diagnosis / Notes",
      "Allergies",
      "Loyalty Points",
      "Medications (JSON)",
      "Vitals (JSON)",
      "Scans (JSON)",
      "Is Archived",
      "Last Updated"
    ];
    pSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    pSheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#0f6cbd").setFontColor("#ffffff");
    pSheet.setFrozenRows(1);
  }

  // 2. Clinical FollowUps Sheet
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
      "Adherence Score (%)",
      "Systolic BP",
      "Diastolic BP",
      "Blood Glucose",
      "Notes",
      "Resolved",
      "Last Updated"
    ];
    fSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    fSheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#1e3a5f").setFontColor("#ffffff");
    fSheet.setFrozenRows(1);
  }

  // 3. Audit Log Sheet
  let lSheet = ss.getSheetByName(SHEET_AUDIT_LOG);
  if (!lSheet) {
    lSheet = ss.insertSheet(SHEET_AUDIT_LOG);
    lSheet.getRange(1, 1, 1, 3).setValues([["Timestamp", "Action", "Details"]]);
    lSheet.getRange(1, 1, 1, 3).setFontWeight("bold").setBackground("#292929").setFontColor("#ffffff");
    lSheet.setFrozenRows(1);
  }
}

/**
 * Save array of patients into Patients_DB sheet
 */
function savePatientsToSheet(patients) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_PATIENTS);
  if (!sheet) return;

  const nowStr = new Date().toISOString();

  // Read existing IDs to update or insert
  const data = sheet.getDataRange().getValues();
  const idToRowMap = {};
  for (let r = 1; r < data.length; r++) {
    const id = data[r][0];
    if (id) {
      idToRowMap[id] = r + 1; // 1-based row index
    }
  }

  const rowsToAppend = [];

  patients.forEach(p => {
    const rowValues = [
      p.id || "",
      p.name || "",
      p.phone || "",
      p.age || "",
      p.gender || "",
      p.familyTag || "",
      p.diagnosis || "",
      p.allergies || "",
      p.loyaltyPoints || 0,
      JSON.stringify(p.medications || []),
      JSON.stringify(p.vitals || []),
      JSON.stringify(p.scans || []),
      p.isArchived ? "TRUE" : "FALSE",
      nowStr
    ];

    if (p.id && idToRowMap[p.id]) {
      // Update existing row
      sheet.getRange(idToRowMap[p.id], 1, 1, rowValues.length).setValues([rowValues]);
    } else {
      // New row to append
      rowsToAppend.push(rowValues);
    }
  });

  if (rowsToAppend.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rowsToAppend.length, rowsToAppend[0].length).setValues(rowsToAppend);
  }
}

/**
 * Save array of clinical follow-ups into Clinical_FollowUps sheet
 */
function saveFollowUpsToSheet(followUps) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_FOLLOWUPS);
  if (!sheet) return;

  const nowStr = new Date().toISOString();
  const data = sheet.getDataRange().getValues();
  const idToRowMap = {};
  for (let r = 1; r < data.length; r++) {
    const id = data[r][0];
    if (id) {
      idToRowMap[id] = r + 1;
    }
  }

  const rowsToAppend = [];

  followUps.forEach(f => {
    const rowValues = [
      f.id || "",
      f.patientId || "",
      f.patientName || "",
      f.phone || "",
      f.type || "",
      f.drug || "",
      f.startDate || "",
      f.dueDate || "",
      f.daysOffset || 0,
      f.adherenceScore !== undefined ? f.adherenceScore : "",
      f.systolic || "",
      f.diastolic || "",
      f.glucose || "",
      f.notes || "",
      f.resolved ? "TRUE" : "FALSE",
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
 * Retrieve all patients formatted for CRM
 */
function getAllPatientsFromSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
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

    try { medications = row[9] ? JSON.parse(row[9]) : []; } catch (e) {}
    try { vitals = row[10] ? JSON.parse(row[10]) : []; } catch (e) {}
    try { scans = row[11] ? JSON.parse(row[11]) : []; } catch (e) {}

    patients.push({
      id: String(row[0]),
      name: String(row[1] || ""),
      phone: String(row[2] || ""),
      age: row[3] ? Number(row[3]) : undefined,
      gender: String(row[4] || ""),
      familyTag: row[5] ? String(row[5]) : undefined,
      diagnosis: String(row[6] || ""),
      allergies: String(row[7] || ""),
      loyaltyPoints: Number(row[8] || 0),
      medications: medications,
      vitals: vitals,
      scans: scans,
      isArchived: String(row[12]).toUpperCase() === "TRUE"
    });
  }

  return patients;
}

/**
 * Retrieve all follow-ups formatted for CRM
 */
function getAllFollowUpsFromSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
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
      type: String(row[4] || "CHRONIC_INITIATION"),
      drug: String(row[5] || ""),
      startDate: String(row[6] || ""),
      dueDate: String(row[7] || ""),
      daysOffset: Number(row[8] || 0),
      adherenceScore: row[9] !== "" ? Number(row[9]) : undefined,
      systolic: row[10] !== "" ? Number(row[10]) : undefined,
      diastolic: row[11] !== "" ? Number(row[11]) : undefined,
      glucose: row[12] !== "" ? Number(row[12]) : undefined,
      notes: String(row[13] || ""),
      resolved: String(row[14]).toUpperCase() === "TRUE"
    });
  }

  return followUps;
}

/**
 * Upload base64 prescription or lab scan image directly to Google Drive
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
  const blob = Utilities.newBlob(decoded, "image/jpeg", (patientId || "Scan") + "_" + (fileName || "rx.jpg"));
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  return file.getUrl();
}

/**
 * Log activities in the Audit_Log sheet
 */
function logAudit(action, details) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_AUDIT_LOG);
    if (sheet) {
      sheet.appendRow([new Date(), action, details]);
    }
  } catch (e) {}
}
