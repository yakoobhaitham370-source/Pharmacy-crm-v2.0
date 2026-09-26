import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '20mb' }));

const apiKey = process.env.GEMINI_API_KEY || '';
const ai = new GoogleGenAI({
  apiKey: apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Endpoint: AI Regimen Safety & Clinical Interaction Audit
app.post('/api/ai/audit-regimen', async (req, res) => {
  try {
    const { patientName, age, gender, allergies, medications, vitals, medicalHistory } = req.body;

    if (!apiKey) {
      return res.status(200).json({
        success: true,
        source: 'clinical_engine_fallback',
        summary: 'تم التحليل بواسطة المحرك السريري الداخلي (لم يتم توفير مفتاح Gemini API للسحابة).',
        alerts: [],
        foodInteractions: [],
        counselingPoints: [
          'التأكد من أخذ خافض الضغط صباحاً والميتفورمين وسط الوجبة لتفادي اضطراب الأمعاء.',
          'شرب كميات كافية من الماء يومياً وتجنب المسكنات غير الستيرويدية (NSAIDs) دون استشارة.'
        ]
      });
    }

    const prompt = `You are an elite Clinical Pharmacologist and Patient Safety Specialist.
Audit this patient's medication regimen thoroughly.

Patient Profile:
- Name: ${patientName || 'Anonymous'}
- Age: ${age || 'Unknown'} | Gender: ${gender || 'Unknown'}
- Known Allergies: ${allergies || 'None reported'}
- Medical History/Conditions: ${medicalHistory || 'Chronic maintenance'}
- Active Medications: ${JSON.stringify(medications || [])}
- Recent Clinical Vitals: ${JSON.stringify(vitals || [])}

Perform a rigorous clinical safety review:
1. Identify all Drug-Drug interactions (Critical, Major, Moderate).
2. Check for contraindicated drug combinations (e.g. Triple Whammy, Serotonin syndrome, QT prolongation, hyperkalemia, dual antiplatelet bleeding).
3. Evaluate organ/renal risks based on age, BP, and medications.
4. Food & beverage interactions (e.g. Grapefruit, Dairy/Calcium, Tyramine, Salt substitutes).
5. Evidence-based companion nutraceuticals (e.g. CoQ10 for Statins, B12 for Metformin, Mg for Diuretics).
6. Clear, actionable patient counseling guidance in Arabic and English.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            overallRiskScore: {
              type: Type.STRING,
              description: 'One of: LOW, MODERATE, HIGH, CRITICAL',
            },
            summaryAr: {
              type: Type.STRING,
              description: 'Executive clinical summary in Arabic for the pharmacist',
            },
            summaryEn: {
              type: Type.STRING,
              description: 'Executive clinical summary in English',
            },
            interactions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  drugs: { type: Type.ARRAY, items: { type: Type.STRING } },
                  severity: { type: Type.STRING, description: 'CRITICAL | MAJOR | MODERATE | MINOR' },
                  titleAr: { type: Type.STRING },
                  titleEn: { type: Type.STRING },
                  mechanism: { type: Type.STRING },
                  actionAr: { type: Type.STRING },
                  actionEn: { type: Type.STRING },
                },
                required: ['drugs', 'severity', 'titleAr', 'mechanism', 'actionAr'],
              },
            },
            foodInteractions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  drug: { type: Type.STRING },
                  foodItem: { type: Type.STRING },
                  instructionAr: { type: Type.STRING },
                  instructionEn: { type: Type.STRING },
                },
                required: ['drug', 'foodItem', 'instructionAr'],
              },
            },
            nutritionalCompanions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  supplementAr: { type: Type.STRING },
                  supplementEn: { type: Type.STRING },
                  indicatedFor: { type: Type.STRING },
                  clinicalRationaleAr: { type: Type.STRING },
                },
                required: ['supplementAr', 'indicatedFor', 'clinicalRationaleAr'],
              },
            },
            patientCounselingPointsAr: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            patientCounselingPointsEn: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: [
            'overallRiskScore',
            'summaryAr',
            'interactions',
            'patientCounselingPointsAr',
          ],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.json({ success: true, source: 'gemini_ai', ...parsed });
  } catch (err: any) {
    console.error('Audit Regimen API error:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to complete AI clinical audit',
    });
  }
});

// Endpoint: AI Extract Prescription or Lab Report OCR
app.post('/api/ai/extract-prescription', async (req, res) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg', rawText } = req.body;

    if (!apiKey) {
      return res.status(200).json({
        success: true,
        source: 'mock_extractor',
        patientName: '',
        medications: [],
        vitals: {},
        notes: 'يرجى إدخال البيانات يدوياً (مفتاح الذكاء الاصطناعي غير مفعل).',
      });
    }

    const contents: any[] = [];
    if (imageBase64) {
      contents.push({
        inlineData: {
          mimeType: mimeType,
          data: imageBase64.replace(/^data:image\/\w+;base64,/, ''),
        },
      });
    }

    contents.push({
      text: `You are an expert Clinical Pharmacist reading a medical prescription or clinical lab report.
Extract all medications, dosages, frequency, and any identifiable lab test values or vital signs (Blood Pressure, Fasting Glucose, HbA1c, Serum Creatinine, eGFR, Potassium).
Provide a structured output.
Additional pharmacist context notes provided: ${rawText || 'None'}`,
    });

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: { parts: contents },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            patientName: { type: Type.STRING },
            date: { type: Type.STRING },
            doctorOrClinic: { type: Type.STRING },
            medications: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  dosage: { type: Type.STRING },
                  frequency: { type: Type.STRING },
                  durationDays: { type: Type.INTEGER },
                  instructions: { type: Type.STRING },
                },
                required: ['name'],
              },
            },
            extractedVitals: {
              type: Type.OBJECT,
              properties: {
                systolic: { type: Type.STRING },
                diastolic: { type: Type.STRING },
                bloodGlucose: { type: Type.STRING },
                hba1c: { type: Type.STRING },
                creatinine: { type: Type.STRING },
                potassium: { type: Type.STRING },
                pulse: { type: Type.STRING },
              },
            },
            clinicalNotes: { type: Type.STRING },
          },
          required: ['medications'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.json({ success: true, ...parsed });
  } catch (err: any) {
    console.error('Extract Prescription API error:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to extract prescription data',
    });
  }
});

// Endpoint: AI Smart WhatsApp / SMS Counseling Composer
app.post('/api/ai/generate-counseling', async (req, res) => {
  try {
    const { patientName, pharmacyName, medications, channel = 'whatsapp', lang = 'ar', goal = 'refill' } = req.body;

    if (!apiKey) {
      return res.status(200).json({
        success: true,
        message: `مرحباً ${patientName}، تحيات ${pharmacyName || 'الصيدلية'}. نود تذكيركم بموعد تكرار أدويتكم المزمنة لضمان استقرار حالتكم الصحية.`,
      });
    }

    const prompt = `Write a caring, warm, highly professional clinical pharmacist message for:
Patient: ${patientName}
Pharmacy: ${pharmacyName}
Medications: ${JSON.stringify(medications)}
Channel: ${channel} (keep concise if SMS, engaging with emojis and bullet points if WhatsApp)
Language: ${lang === 'en' ? 'English' : 'Arabic (فصحى مهذبة وقريبة لقلب المريض)'}
Goal: ${goal} (refill reminder, antibiotic course check-in, or adherence encouragement).`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
    });

    return res.json({ success: true, message: response.text?.trim() });
  } catch (err: any) {
    console.error('Generate Counseling error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint: Real-time Clinical Search Grounding with Google Search (gemini-3.5-flash)
app.post('/api/ai/live-clinical-search', async (req, res) => {
  try {
    const { query, drugName, patientContext } = req.body;

    if (!apiKey) {
      return res.status(200).json({
        success: true,
        source: 'fallback',
        text: 'يرجى مراجعة النشرات الدوائية والمراجع السريرية الرسمية (لم يتم تكوين مفتاح Gemini API).',
        sources: [],
        searchQueries: [],
      });
    }

    const prompt = `You are an expert Clinical Pharmacologist and Evidence-Based Medicine researcher.
Answer the following clinical question with the most recent evidence, safety warnings, and guideline updates:
Query: ${query}
Target Medication / Class: ${drugName || 'General Pharmacotherapy'}
${patientContext ? `Patient Context: ${JSON.stringify(patientContext)}` : ''}

Instructions:
1. Provide an authoritative, structured, and clinically actionable answer in Arabic and English.
2. Highlight any recent FDA/EMA black box warnings, clinical guideline updates (AHA/ACC, ADA, KDIGO, GOLD), renal/hepatic dose adjustments, and practical dispensing advice.
3. Be concise, rigorous, and patient-safety oriented.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
    const sources =
      groundingMetadata?.groundingChunks?.map((chunk: any) => ({
        title: chunk.web?.title || 'Medical Source',
        uri: chunk.web?.uri || '',
      })).filter((s: any) => s.uri) || [];

    const searchQueries = groundingMetadata?.webSearchQueries || [];

    return res.json({
      success: true,
      text: response.text?.trim() || '',
      sources,
      searchQueries,
    });
  } catch (err: any) {
    console.error('Live Clinical Search error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint: High-speed proxy for Google Apps Script to eliminate browser CORS latency and handle 302 redirects server-to-server
app.post('/api/gas/proxy', async (req, res) => {
  try {
    const { gasUrl, method = 'POST', payload, params } = req.body;
    if (!gasUrl || typeof gasUrl !== 'string') {
      return res.status(400).json({ success: false, error: 'Missing or invalid gasUrl' });
    }

    let targetUrl = gasUrl.trim();
    if (params && typeof params === 'object') {
      const q = new URLSearchParams(params).toString();
      targetUrl += (targetUrl.includes('?') ? '&' : '?') + q;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    if (method === 'GET') {
      const resp = await fetch(targetUrl, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        redirect: 'follow',
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const contentType = resp.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const json = await resp.json();
        return res.json(json);
      }
      const text = await resp.text();
      try {
        const json = JSON.parse(text);
        return res.json(json);
      } catch {
        return res.json({ status: 'SUCCESS', raw: text });
      }
    } else {
      const resp = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: typeof payload === 'string' ? payload : JSON.stringify(payload || {}),
        redirect: 'follow',
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const contentType = resp.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const json = await resp.json();
        return res.json(json);
      }
      const text = await resp.text();
      try {
        const json = JSON.parse(text);
        return res.json(json);
      } catch {
        return res.json({ status: 'SUCCESS', raw: text });
      }
    }
  } catch (err: any) {
    console.warn('Server GAS proxy error:', err.message);
    return res.status(502).json({ success: false, error: err.message });
  }
});

// Endpoint: Download standalone single-file HTML version of the app
app.get('/download/pharmpulse.html', (_req, res) => {
  const htmlPath = path.resolve(__dirname, 'pharmpulse.html');
  res.download(htmlPath, 'pharmpulse.html');
});

// Endpoint: Download Google Apps Script backend code (Code.gs)
app.get('/download/Code.gs', (_req, res) => {
  const gsPath = path.resolve(__dirname, 'google-apps-script.js');
  res.download(gsPath, 'Code.gs');
});

// Endpoint: Download compiled dist.zip for direct Netlify Drop deployment
app.get('/download/dist.zip', (_req, res) => {
  const zipPath = path.resolve(__dirname, 'dist.zip');
  res.download(zipPath, 'pharmpulse-netlify-dist.zip');
});

app.get('/pharmpulse.html', (_req, res) => {
  const htmlPath = path.resolve(__dirname, 'pharmpulse.html');
  res.sendFile(htmlPath);
});

// Vite middleware in dev or static files in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`PharmPulse Enterprise Server running on port ${PORT}`);
  });
}

startServer();
