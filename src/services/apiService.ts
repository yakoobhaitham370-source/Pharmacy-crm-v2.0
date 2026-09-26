import { Patient, FollowUpEntry } from '../types/pharmacy';

export async function auditRegimenWithAI(patientData: {
  patientName: string;
  age?: number;
  gender?: string;
  allergies?: string;
  medicalHistory?: string;
  medications: any[];
  vitals?: any[];
}) {
  try {
    const res = await fetch('/api/ai/audit-regimen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patientData),
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (err: any) {
    console.warn('AI Audit Regimen fallback:', err);
    return {
      success: false,
      error: err.message,
    };
  }
}

export async function extractPrescriptionWithAI(imageBase64: string, rawText?: string) {
  try {
    const res = await fetch('/api/ai/extract-prescription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64, rawText }),
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (err: any) {
    console.warn('AI Extract Prescription fallback:', err);
    return {
      success: false,
      error: err.message,
    };
  }
}

export async function generateSmartCounselingMessage(params: {
  patientName: string;
  pharmacyName: string;
  medications: any[];
  channel: 'whatsapp' | 'sms';
  lang: 'ar' | 'en';
  goal: string;
}) {
  try {
    const res = await fetch('/api/ai/generate-counseling', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (err: any) {
    console.warn('AI Counseling fallback:', err);
    return {
      success: false,
      error: err.message,
    };
  }
}

export async function searchClinicalGroundingWithAI(params: {
  query: string;
  drugName?: string;
  patientContext?: any;
}): Promise<{
  success: boolean;
  text?: string;
  sources?: { title: string; uri: string }[];
  searchQueries?: string[];
  error?: string;
}> {
  try {
    const res = await fetch('/api/ai/live-clinical-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (err: any) {
    console.warn('Live Clinical Search fallback:', err);
    return {
      success: false,
      error: err.message,
      sources: [],
    };
  }
}

export interface GasUrlValidationResult {
  isValid: boolean;
  normalizedUrl: string;
  error?: string;
  warning?: string;
  tip?: string;
}

/**
 * Validates the user-entered Google Apps Script Web App URL
 */
export function validateGasUrl(rawUrl: string): GasUrlValidationResult {
  if (!rawUrl || !rawUrl.trim()) {
    return {
      isValid: false,
      normalizedUrl: '',
      error: 'الرابط فارغ. يرجى إدخال رابط Web App URL المنتهي بـ /exec',
    };
  }

  let url = rawUrl.trim();

  // Common user mistake: pasting Google Sheet URL directly
  if (url.includes('docs.google.com/spreadsheets')) {
    return {
      isValid: false,
      normalizedUrl: url,
      error: 'الرابط المدخل هو رابط جدول Google Sheets نفسه وليس رابط تطبيق الويب (Web App)!',
      tip: 'افتح الشيت > اضغط على الامتدادات (Extensions) > Apps Script > ثم في أعلى اليمين اضغط نشر (Deploy) > نشر جديد (New deployment) > تطبيق ويب (Web app) > انسخ الرابط.',
    };
  }

  // Common user mistake: pasting script editor URL
  if (url.includes('script.google.com/d/') && url.includes('/edit')) {
    return {
      isValid: false,
      normalizedUrl: url,
      error: 'الرابط المدخل هو رابط محرر الأكواد (Script Editor) وليس رابط تطبيق الويب المنشور!',
      tip: 'اضغط على زر نشر (Deploy) بالأعلى > New deployment > اختر Web app وانسخ الرابط المنتهي بـ /exec.',
    };
  }

  // Common user mistake: using /dev test deployment URL
  if (url.endsWith('/dev') || url.includes('/dev?')) {
    const fixedUrl = url.replace(/\/dev(\b|\?|$)/, '/exec$1');
    return {
      isValid: false,
      normalizedUrl: fixedUrl,
      warning: 'الرابط ينتهي بـ /dev (وضع التطوير الذي يتطلب تسجيل الدخول ولا يعمل مع المواقع الخارجية).',
      tip: 'يجب استخدام الرابط المنتهي بـ /exec. يمكنك الضغط على "إصلاح تلقائي" لتحويله إلى /exec.',
    };
  }

  if (!url.startsWith('https://script.google.com/macros/s/')) {
    return {
      isValid: false,
      normalizedUrl: url,
      warning: 'الرابط لا يبدأ بالصيغة المعتادة لـ Google Apps Script (https://script.google.com/macros/s/...)',
      tip: 'تأكد من أن الرابط منسوخ من نافذة النشر (New Deployment) كـ Web App.',
    };
  }

  if (!url.includes('/exec')) {
    return {
      isValid: false,
      normalizedUrl: url,
      warning: 'رابط تطبيق الويب يجب أن ينتهي بـ /exec.',
      tip: 'تأكد من اختيار Web App أثناء النشر.',
    };
  }

  return {
    isValid: true,
    normalizedUrl: url,
  };
}

export interface GasDiagnosticResult {
  success: boolean;
  message: string;
  tip?: string;
  statusCode?: number;
  patientsCount?: number;
  followUpsCount?: number;
  spreadsheetName?: string;
  version?: string;
}

/**
 * Runs a comprehensive diagnostic check against the Google Apps Script endpoint
 */
export async function testSheetConnectionDetailed(gasUrl: string): Promise<GasDiagnosticResult> {
  const validation = validateGasUrl(gasUrl);
  if (!validation.isValid && validation.error) {
    return {
      success: false,
      message: validation.error,
      tip: validation.tip,
    };
  }

  const cleanUrl = validation.normalizedUrl;

  // 1. Test via standard fetch (PING)
  const delimiter = cleanUrl.includes('?') ? '&' : '?';
  const pingUrl = `${cleanUrl}${delimiter}action=PING&_t=${Date.now()}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    const res = await fetch(pingUrl, {
      method: 'GET',
      mode: 'cors',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    // Check if redirected to Google Accounts login page
    if (res.url && res.url.includes('accounts.google.com')) {
      return {
        success: false,
        message: 'تم التحويل إلى صفحة تسجيل الدخول في Google!',
        tip: 'السبب: تم ضبط إذن الوصول على "Only myself" أو "Anyone with Google account". الحل: افتح Apps Script > اضغط Deploy > Manage deployments > عدل الـ Web app واجعل "Who has access" على "Anyone" (أي شخص) ثم اضغط Save.',
      };
    }

    if (res.ok) {
      const text = await res.text();
      try {
        const json = JSON.parse(text);
        if (json.status === 'SUCCESS') {
          return {
            success: true,
            message: 'تم الاتصال بالخادم السحابي بنجاح!',
            patientsCount: json.counts?.patients,
            followUpsCount: json.counts?.followUps,
            spreadsheetName: json.spreadsheetName,
            version: json.version,
          };
        }
      } catch (parseErr) {
        if (text.includes('Google Accounts') || text.includes('ServiceLogin')) {
          return {
            success: false,
            message: 'السكريبت يتطلب صلاحية تسجيل الدخول.',
            tip: 'يجب تغيير خيار "Who has access" في النشر إلى "Anyone" (أي شخص).',
          };
        }
      }
    }
  } catch (err: any) {
    console.warn('Fetch PING failed, falling back to JSONP test...', err);
  }

  // 2. Fallback check via JSONP
  try {
    const jsonpData = await fetchFromGoogleSheetJSONP(cleanUrl);
    return {
      success: true,
      message: 'تم الاتصال بنجاح عبر قناة JSONP الآمنة!',
      patientsCount: jsonpData.patients ? jsonpData.patients.length : 0,
      followUpsCount: jsonpData.followUps ? jsonpData.followUps.length : 0,
    };
  } catch (jsonpErr: any) {
    console.error('Diagnostic test completely failed:', jsonpErr);
    return {
      success: false,
      message: 'تعذر الاتصال بـ Google Apps Script.',
      tip: 'تأكد من: 1) نشر السكريبت كـ Web App مع إتاحة الوصول لـ "Anyone". 2) تشغيل دالة testConnection داخل محرر Apps Script للتحقق من منح الصلاحيات (Authorize). 3) نسخ الرابط المنتهي بـ /exec.',
    };
  }
}

/**
 * Push local database state upstream to Google Sheets
 */
export async function syncPushToGoogleSheet(
  gasUrl: string,
  patients: Patient[],
  followUps: FollowUpEntry[],
  settings?: any
) {
  if (!gasUrl) return { success: false, reason: 'NO_GAS_URL' };

  const cleanUrl = gasUrl.trim();
  const payload = JSON.stringify({
    action: 'SYNC_UPSTREAM',
    patients,
    followUps,
    settings,
    timestamp: new Date().toISOString(),
  });

  try {
    const response = await fetch(cleanUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: payload,
    });

    if (response.ok) {
      try {
        const json = await response.json();
        return { success: json.status === 'SUCCESS', data: json };
      } catch (e) {
        return { success: true };
      }
    }
    return { success: false, status: response.status };
  } catch (err: any) {
    console.warn('Google Sheet standard POST error, attempting fallback beacon:', err);
    // If strict CORS or network policy blocks redirect reading, send in no-cors mode to ensure persistence
    try {
      await fetch(cleanUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: payload,
      });
      return { success: true, mode: 'no-cors' };
    } catch (e2: any) {
      return { success: false, error: err.message };
    }
  }
}

/**
 * Permanently delete a patient and their follow-ups from Google Sheet
 */
export async function deletePatientFromGoogleSheet(gasUrl: string, patientId: string): Promise<boolean> {
  if (!gasUrl || !patientId) return false;
  const cleanUrl = gasUrl.trim();
  const payload = JSON.stringify({
    action: 'DELETE_PATIENT',
    patientId,
    timestamp: new Date().toISOString(),
  });

  try {
    const res = await fetch(cleanUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: payload,
    });
    return res.ok;
  } catch (err) {
    console.warn('deletePatientFromGoogleSheet error, attempting beacon mode:', err);
    try {
      await fetch(cleanUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: payload,
      });
      return true;
    } catch (e2) {
      return false;
    }
  }
}

/**
 * Fetch database records from Google Sheet with Dual-Fetch (Fetch first, JSONP fallback)
 */
export async function fetchFromGoogleSheet(
  gasUrl: string
): Promise<{ patients?: Patient[]; followUps?: FollowUpEntry[]; settings?: any }> {
  if (!gasUrl) throw new Error('NO_GAS_URL');
  const cleanUrl = gasUrl.trim();

  // Tier 1: Try modern CORS fetch with 10s timeout
  try {
    const delimiter = cleanUrl.includes('?') ? '&' : '?';
    const fetchUrl = `${cleanUrl}${delimiter}action=FETCH_ALL&_t=${Date.now()}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(fetchUrl, {
      method: 'GET',
      mode: 'cors',
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (data && data.status === 'SUCCESS' && Array.isArray(data.patients)) {
        return {
          patients: data.patients,
          followUps: data.followUps || [],
          settings: data.settings || null,
        };
      }
    }
  } catch (fetchErr) {
    console.warn('Fetch failed, falling back to JSONP:', fetchErr);
  }

  // Tier 2: Fallback to JSONP (works in all cross-domain environments)
  return fetchFromGoogleSheetJSONP(cleanUrl);
}

/**
 * Standard JSONP client implementation for Google Apps Script
 */
export function fetchFromGoogleSheetJSONP(gasUrl: string): Promise<{ patients?: Patient[]; followUps?: FollowUpEntry[]; settings?: any }> {
  return new Promise((resolve, reject) => {
    if (!gasUrl) {
      return reject(new Error('NO_GAS_URL'));
    }

    const cleanUrl = gasUrl.trim();
    const callbackName = 'jsonp_sync_' + Date.now();
    const delimiter = cleanUrl.includes('?') ? '&' : '?';
    const scriptUrl = `${cleanUrl}${delimiter}action=FETCH_ALL&callback=${callbackName}&_cacheBust=${Date.now()}`;

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('TIMEOUT'));
    }, 15000);

    function cleanup() {
      clearTimeout(timeout);
      delete (window as any)[callbackName];
      const old = document.getElementById(callbackName);
      if (old) old.remove();
    }

    (window as any)[callbackName] = function (res: any) {
      cleanup();
      if (res && res.status === 'SUCCESS' && Array.isArray(res.patients)) {
        resolve({
          patients: res.patients,
          followUps: res.followUps || [],
          settings: res.settings || null,
        });
      } else {
        reject(new Error('INVALID_DATA'));
      }
    };

    const script = document.createElement('script');
    script.id = callbackName;
    script.src = scriptUrl;
    script.onerror = function () {
      cleanup();
      reject(new Error('SCRIPT_LOAD_ERROR'));
    };
    document.body.appendChild(script);
  });
}

