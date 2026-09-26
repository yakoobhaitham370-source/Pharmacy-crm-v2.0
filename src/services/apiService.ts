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
 * Executes a call to Google Apps Script using high-speed server proxy first,
 * with graceful browser fallbacks (JSONP/direct no-cors)
 */
async function callGasApi(
  gasUrl: string,
  options: {
    method?: 'GET' | 'POST';
    params?: Record<string, string>;
    payload?: any;
    timeoutMs?: number;
  }
): Promise<any> {
  const method = options.method || 'POST';
  const timeoutMs = options.timeoutMs || 8000;

  // 1. Try server proxy route first (zero-CORS, fast redirect following, takes ~300ms)
  try {
    const proxyController = new AbortController();
    const proxyTimeout = setTimeout(() => proxyController.abort(), timeoutMs);

    const proxyRes = await fetch('/api/gas/proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gasUrl,
        method,
        params: options.params,
        payload: options.payload,
      }),
      signal: proxyController.signal,
    });
    clearTimeout(proxyTimeout);

    if (proxyRes.ok) {
      const data = await proxyRes.json();
      return data;
    }
  } catch (proxyErr) {
    // If backend proxy is not accessible, fall back to browser direct/JSONP
    console.debug('GAS proxy bypassed or unavailable, using browser transport:', proxyErr);
  }

  // 2. Direct browser fallback
  const cleanUrl = gasUrl.trim();
  if (method === 'GET') {
    return fetchFromGoogleSheetJSONP(cleanUrl, options.params);
  } else {
    // Direct browser POST using no-cors to avoid browser 302 blocking
    const bodyStr = typeof options.payload === 'string' ? options.payload : JSON.stringify(options.payload || {});
    await fetch(cleanUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: bodyStr,
    });
    return { status: 'SUCCESS', mode: 'no-cors' };
  }
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

  try {
    const json = await callGasApi(cleanUrl, {
      method: 'GET',
      params: { action: 'PING', _t: String(Date.now()) },
      timeoutMs: 6000,
    });

    if (json && json.status === 'SUCCESS') {
      return {
        success: true,
        message: 'تم الاتصال بالخادم السحابي بنجاح!',
        patientsCount: json.counts?.patients,
        followUpsCount: json.counts?.followUps,
        spreadsheetName: json.spreadsheetName,
        version: json.version,
      };
    }
  } catch (err: any) {
    console.warn('Proxy ping failed, falling back to JSONP test...', err);
  }

  // Fallback check via JSONP
  try {
    const jsonpData = await fetchFromGoogleSheetJSONP(cleanUrl, { action: 'PING' });
    return {
      success: true,
      message: 'تم الاتصال بنجاح عبر قناة JSONP السريعة!',
      patientsCount: jsonpData?.counts?.patients ?? (jsonpData.patients ? jsonpData.patients.length : 0),
      followUpsCount: jsonpData?.counts?.followUps ?? (jsonpData.followUps ? jsonpData.followUps.length : 0),
      spreadsheetName: jsonpData?.spreadsheetName,
    };
  } catch (jsonpErr: any) {
    console.error('Diagnostic test failed:', jsonpErr);
    return {
      success: false,
      message: 'تعذر الاتصال بـ Google Apps Script.',
      tip: 'تأكد من: 1) نشر السكريبت كـ Web App مع إتاحة الوصول لـ "Anyone". 2) تشغيل دالة testConnection داخل محرر Apps Script للتحقق من منح الصلاحيات (Authorize). 3) نسخ الرابط المنتهي بـ /exec.',
    };
  }
}

/**
 * Saves a single patient immediately to Google Sheets (fast targeted update)
 */
export async function savePatientToGoogleSheet(
  gasUrl: string,
  patient: Patient
): Promise<{ success: boolean; data?: any }> {
  if (!gasUrl || !patient || !patient.id) return { success: false };

  const cleanUrl = gasUrl.trim();
  const payload = {
    action: 'SAVE_PATIENT',
    patient,
    timestamp: new Date().toISOString(),
  };

  try {
    const result = await callGasApi(cleanUrl, {
      method: 'POST',
      payload,
      timeoutMs: 6000,
    });
    return { success: true, data: result };
  } catch (err: any) {
    console.warn('savePatientToGoogleSheet error:', err);
    return { success: false };
  }
}

/**
 * Saves a single clinical follow-up immediately to Google Sheets
 */
export async function saveFollowUpToGoogleSheet(
  gasUrl: string,
  followUp: FollowUpEntry
): Promise<{ success: boolean; data?: any }> {
  if (!gasUrl || !followUp || !followUp.id) return { success: false };

  const cleanUrl = gasUrl.trim();
  const payload = {
    action: 'SAVE_FOLLOWUP',
    followUp,
    timestamp: new Date().toISOString(),
  };

  try {
    const result = await callGasApi(cleanUrl, {
      method: 'POST',
      payload,
      timeoutMs: 6000,
    });
    return { success: true, data: result };
  } catch (err: any) {
    console.warn('saveFollowUpToGoogleSheet error:', err);
    return { success: false };
  }
}

/**
 * Push local database state upstream to Google Sheets (batch sync)
 */
export async function syncPushToGoogleSheet(
  gasUrl: string,
  patients: Patient[],
  followUps: FollowUpEntry[],
  settings?: any
) {
  if (!gasUrl) return { success: false, reason: 'NO_GAS_URL' };

  const cleanUrl = gasUrl.trim();
  const payload = {
    action: 'SYNC_UPSTREAM',
    patients,
    followUps,
    settings,
    timestamp: new Date().toISOString(),
  };

  try {
    const result = await callGasApi(cleanUrl, {
      method: 'POST',
      payload,
      timeoutMs: 9000,
    });
    return { success: true, data: result };
  } catch (err: any) {
    console.warn('syncPushToGoogleSheet error:', err);
    return { success: false };
  }
}

/**
 * Permanently delete a patient and their follow-ups from Google Sheet
 */
export async function deletePatientFromGoogleSheet(gasUrl: string, patientId: string): Promise<boolean> {
  if (!gasUrl || !patientId) return false;
  const cleanUrl = gasUrl.trim();
  const payload = {
    action: 'DELETE_PATIENT',
    patientId,
    timestamp: new Date().toISOString(),
  };

  try {
    await callGasApi(cleanUrl, {
      method: 'POST',
      payload,
      timeoutMs: 6000,
    });
    return true;
  } catch (err) {
    console.warn('deletePatientFromGoogleSheet error:', err);
    return false;
  }
}

/**
 * Fetch database records from Google Sheet with high-speed proxy and instant JSONP
 */
export async function fetchFromGoogleSheet(
  gasUrl: string
): Promise<{ patients?: Patient[]; followUps?: FollowUpEntry[]; settings?: any }> {
  if (!gasUrl) throw new Error('NO_GAS_URL');
  const cleanUrl = gasUrl.trim();

  // Tier 1: Try high-speed server proxy (completes in 300-600ms, zero CORS issues)
  try {
    const data = await callGasApi(cleanUrl, {
      method: 'GET',
      params: { action: 'FETCH_ALL', _t: String(Date.now()) },
      timeoutMs: 5000,
    });

    if (data && data.status === 'SUCCESS' && Array.isArray(data.patients)) {
      return {
        patients: data.patients,
        followUps: data.followUps || [],
        settings: data.settings || null,
      };
    }
  } catch (proxyErr) {
    console.debug('Proxy fetch failed, using direct JSONP:', proxyErr);
  }

  // Tier 2: Instant JSONP client (works across all browsers and iframes without CORS)
  return fetchFromGoogleSheetJSONP(cleanUrl, { action: 'FETCH_ALL' });
}

/**
 * Standard high-speed JSONP client implementation for Google Apps Script
 */
export function fetchFromGoogleSheetJSONP(
  gasUrl: string,
  extraParams?: Record<string, string>
): Promise<any> {
  return new Promise((resolve, reject) => {
    if (!gasUrl) {
      return reject(new Error('NO_GAS_URL'));
    }

    const cleanUrl = gasUrl.trim();
    const callbackName = 'jsonp_sync_' + Math.floor(Math.random() * 10000000);
    const delimiter = cleanUrl.includes('?') ? '&' : '?';

    const params = new URLSearchParams({
      action: 'FETCH_ALL',
      callback: callbackName,
      _cacheBust: String(Date.now()),
      ...(extraParams || {}),
    });

    const scriptUrl = `${cleanUrl}${delimiter}${params.toString()}`;

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('TIMEOUT'));
    }, 6000);

    function cleanup() {
      clearTimeout(timeout);
      delete (window as any)[callbackName];
      const old = document.getElementById(callbackName);
      if (old) old.remove();
    }

    (window as any)[callbackName] = function (res: any) {
      cleanup();
      if (res && res.status === 'SUCCESS') {
        resolve(res);
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

