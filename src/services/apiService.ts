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

export async function syncPushToGoogleSheet(gasUrl: string, patients: Patient[], followUps: FollowUpEntry[]) {
  if (!gasUrl) return { success: false, reason: 'NO_GAS_URL' };

  try {
    const payload = JSON.stringify({
      action: 'SYNC_UPSTREAM',
      patients,
      followUps,
    });

    const response = await fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: payload,
    });

    return { success: response.ok };
  } catch (err: any) {
    console.warn('Google Sheet push error:', err);
    return { success: false, error: err.message };
  }
}

export function fetchFromGoogleSheetJSONP(gasUrl: string): Promise<{ patients?: Patient[]; followUps?: FollowUpEntry[] }> {
  return new Promise((resolve, reject) => {
    if (!gasUrl) {
      return reject(new Error('NO_GAS_URL'));
    }

    const callbackName = 'jsonp_sync_' + Date.now();
    const delimiter = gasUrl.includes('?') ? '&' : '?';
    const scriptUrl = `${gasUrl}${delimiter}action=FETCH_ALL&callback=${callbackName}&_cacheBust=${Date.now()}`;

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
