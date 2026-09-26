import { InteractionAlert, NutritionalCompanion } from '../types/pharmacy';

export const REGIONAL_BRAND_MAP: Record<string, string> = {
  // Diabetes - Metformin & Combinations
  glucophage: 'metformin',
  diaphage: 'metformin',
  formit: 'metformin',
  glucomin: 'metformin',
  cidophage: 'metformin',
  janumet: 'metformin+sitagliptin',
  eucreas: 'metformin+vildagliptin',
  galvumet: 'metformin+vildagliptin',
  jardiance_duo: 'metformin+empagliflozin',
  synjardy: 'metformin+empagliflozin',
  xigduo: 'metformin+dapagliflozin',

  // Diabetes - Sulfonylureas
  glemax: 'glimepiride',
  amaryl: 'glimepiride',
  diapride: 'glimepiride',
  glimer: 'glimepiride',
  diamicron: 'gliclazide',
  daonil: 'glibenclamide',

  // Diabetes - SGLT2i & DPP4i
  jardiance: 'empagliflozin',
  forxiga: 'dapagliflozin',
  invokana: 'canagliflozin',
  januvia: 'sitagliptin',
  galvus: 'vildagliptin',
  tradjenta: 'linagliptin',

  // Statins & Lipid Lowering
  lipitor: 'atorvastatin',
  torvacol: 'atorvastatin',
  ator: 'atorvastatin',
  lipirex: 'atorvastatin',
  tovacor: 'atorvastatin',
  crestor: 'rosuvastatin',
  rovista: 'rosuvastatin',
  zocor: 'simvastatin',
  ezetrol: 'ezetimibe',
  inegy: 'simvastatin+ezetimibe',

  // Beta Blockers
  concor: 'bisoprolol',
  bisocor: 'bisoprolol',
  cardilol: 'carvedilol',
  dilatrend: 'carvedilol',
  tenormin: 'atenolol',
  normiten: 'atenolol',
  inderal: 'propranolol',
  betaloc: 'metoprolol',
  nebilet: 'nebivolol',

  // Calcium Channel Blockers
  norvasc: 'amlodipine',
  amlocard: 'amlodipine',
  adalat: 'nifedipine',
  plendil: 'felodipine',
  isoptin: 'verapamil',
  dilzem: 'diltiazem',

  // ARBs & ACE Inhibitors
  diovan: 'valsartan',
  exforge: 'amlodipine+valsartan',
  co_diovan: 'valsartan+hctz',
  micardis: 'telmisartan',
  micardis_plus: 'telmisartan+hctz',
  atacand: 'candesartan',
  cozaar: 'losartan',
  hyzaar: 'losartan+hctz',
  renitec: 'enalapril',
  zestril: 'lisinopril',
  coversyl: 'perindopril',
  capoten: 'captopril',

  // Diuretics
  lasix: 'furosemide',
  fusid: 'furosemide',
  edemex: 'bumetanide',
  natrilix: 'indapamide',
  aldactone: 'spironolactone',
  esidrex: 'hydrochlorothiazide',

  // PPIs & GI
  nexium: 'esomeprazole',
  controloc: 'pantoprazole',
  losec: 'omeprazole',
  omez: 'omeprazole',
  pariet: 'rabeprazole',
  dexilant: 'dexlansoprazole',
  gasec: 'omeprazole',

  // Antiplatelets & Anticoagulants
  plavix: 'clopidogrel',
  clopilet: 'clopidogrel',
  aspirin: 'aspirin',
  aspicot: 'aspirin',
  jusprin: 'aspirin',
  xarelto: 'rivaroxaban',
  eliquis: 'apixaban',
  pradaxa: 'dabigatran',
  clexane: 'enoxaparin',
  marevan: 'warfarin',

  // Respiratory & Inhalers
  symbicort: 'budesonide+formoterol',
  foster: 'beclomethasone+formoterol',
  seretide: 'fluticasone+salmeterol',
  ventolin: 'salbutamol',
  spiriva: 'tiotropium',
  singulair: 'montelukast',

  // Antibiotics & Anti-infectives
  augmentin: 'amoxicillin+clavulanate',
  curam: 'amoxicillin+clavulanate',
  amoclan: 'amoxicillin+clavulanate',
  zithromax: 'azithromycin',
  azimax: 'azithromycin',
  klacid: 'clarithromycin',
  cipro: 'ciprofloxacin',
  ciflox: 'ciprofloxacin',
  tavanic: 'levofloxacin',
  flagyl: 'metronidazole',

  // NSAIDs & Analgesics
  voltaren: 'diclofenac',
  cataflam: 'diclofenac_potassium',
  profid: 'ketoprofen',
  brufen: 'ibuprofen',
  celebrex: 'celecoxib',
  arcoxia: 'etoricoxib',
  panadol: 'paracetamol',
  tramal: 'tramadol',
};

export function normalizeDrugString(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/\b(\d+(\.\d+)?)\s*(mg|mcg|g|ml|iu|u)\b/gi, '')
    .replace(/[^a-z0-9\s-]/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function resolveGenericDrug(brandName: string, customMap: Record<string, string> = {}): string {
  const clean = normalizeDrugString(brandName);
  if (customMap[clean]) return customMap[clean];
  if (REGIONAL_BRAND_MAP[clean]) return REGIONAL_BRAND_MAP[clean];

  // Stem based heuristics
  if (clean.includes('statin')) return 'statin';
  if (clean.includes('sartan')) return 'sartan';
  if (clean.includes('pril')) return 'pril';
  if (clean.includes('dipine')) return 'dipine';
  if (clean.includes('olol')) return 'olol';
  if (clean.includes('prazole')) return 'prazole';
  if (clean.includes('flozin')) return 'gliflozin';
  if (clean.includes('gliptin')) return 'gliptin';
  if (clean.includes('furosemide') || clean.includes('indapamide') || clean.includes('hydrochlorothiazide')) return 'diuretic';
  if (clean.includes('spironolactone')) return 'spironolactone';
  if (clean.includes('aspirin') || clean.includes('clopidogrel') || clean.includes('rivaroxaban') || clean.includes('warfarin') || clean.includes('apixaban')) {
    return 'anticoagulant';
  }
  if (clean.includes('diclofenac') || clean.includes('ibuprofen') || clean.includes('ketoprofen') || clean.includes('celecoxib') || clean.includes('meloxicam')) {
    return 'nsaid';
  }
  if (clean.includes('clarithromycin') || clean.includes('erythromycin') || clean.includes('azithromycin')) return 'macrolide';
  if (clean.includes('ciprofloxacin') || clean.includes('levofloxacin') || clean.includes('moxifloxacin')) return 'fluoroquinolone';

  return clean;
}

export function evaluateClinicalSafetyRadar(medications: { name: string }[]): InteractionAlert[] {
  const alerts: InteractionAlert[] = [];
  const resolvedList = medications.map(m => ({
    raw: m.name,
    generic: resolveGenericDrug(m.name),
  }));

  const generics = resolvedList.map(r => r.generic);

  const hasACEorARB = generics.some(c => c === 'pril' || c === 'sartan' || c.includes('enalapril') || c.includes('valsartan') || c.includes('losartan') || c.includes('perindopril'));
  const hasDiuretic = generics.some(c => c === 'diuretic' || c.includes('furosemide') || c.includes('indapamide') || c.includes('hctz'));
  const hasNSAID = generics.some(c => c === 'nsaid' || c.includes('diclofenac') || c.includes('ibuprofen') || c.includes('ketoprofen') || c.includes('celecoxib'));
  const hasSpironolactone = generics.some(c => c === 'spironolactone');
  const hasAnticoagulant = generics.some(c => c === 'anticoagulant' || c.includes('clopidogrel') || c.includes('aspirin') || c.includes('rivaroxaban') || c.includes('warfarin') || c.includes('apixaban'));
  const hasPPI = generics.some(c => c === 'prazole' || c.includes('omeprazole') || c.includes('pantoprazole') || c.includes('esomeprazole'));
  const hasStatin = generics.some(c => c === 'statin' || c.includes('atorvastatin') || c.includes('rosuvastatin') || c.includes('simvastatin'));
  const hasMacrolide = generics.some(c => c === 'macrolide' || c.includes('clarithromycin') || c.includes('erythromycin'));
  const hasClopidogrel = generics.some(c => c.includes('clopidogrel'));
  const hasOmeprazole = generics.some(c => c.includes('omeprazole') || c.includes('esomeprazole'));
  const hasBetaBlocker = generics.some(c => c === 'olol' || c.includes('bisoprolol') || c.includes('carvedilol') || c.includes('metoprolol'));
  const hasNonDHP_CCB = generics.some(c => c.includes('verapamil') || c.includes('diltiazem'));

  // 1. Triple Whammy
  if (hasACEorARB && hasDiuretic && hasNSAID) {
    alerts.push({
      type: 'danger',
      title: 'تحذير سريري حرج: متلازمة الضربة الثلاثية (Triple Whammy)',
      detail: 'التزامن بين (خافض ضغط ACEi/ARB + مدر بول + مسكن NSAID) يؤدي لهبوط تروية الكبيبات الكلوية وخطر الفشل الكلوي الحاد (AKI). استبدل المسكن بالباراسيتامول فوراً.',
      mechanism: 'Afferent arteriole constriction (NSAID) + Efferent arteriole dilation (ACEi/ARB) + Hypovolemia (Diuretic) = Acute drop in GFR',
      recommendation: 'Stop NSAID immediately, use Paracetamol for analgesia, monitor serum Creatinine and eGFR.',
    });
  }

  // 2. Severe Bleeding Risk without gastroprotection
  if (hasAnticoagulant && hasNSAID && !hasPPI) {
    alerts.push({
      type: 'danger',
      title: 'خطر النزيف الهضمي الحاد (Severe GI Bleeding Hazard)',
      detail: 'الجمع بين مميع/مضاد صفيحات ومسكن NSAID دون حماية هضمية بمثبطات مضخة البروتون (PPI) يرفع معدل التقرح والنزيف الهضمي بمقدار 4 أضعاف.',
      mechanism: 'Platelet COX-1 inhibition + gastric mucosa prostaglandin depletion',
      recommendation: 'Add PPI (e.g. Pantoprazole) or discontinue NSAID.',
    });
  }

  // 3. Clopidogrel + Omeprazole CYP2C19 interaction
  if (hasClopidogrel && hasOmeprazole) {
    alerts.push({
      type: 'warning',
      title: 'تداخل استقلابي: بلاديفكس مع أوميبرازول (CYP2C19 Inhibition)',
      detail: 'أوميبرازول وإيزوميبرازول يثبطان إنزيم CYP2C19 الكبدي المسؤول عن تحويل كلوبيدوجريل (Plavix) لصورته الفعالة، مما يقلل فعاليته المضادة للجلطات.',
      mechanism: 'CYP2C19 competitive inhibition reduces clopidogrel active metabolite by up to 45%',
      recommendation: 'Switch to Pantoprazole (Controloc) which has minimal CYP2C19 affinity.',
    });
  }

  // 4. Statin + Macrolide Rhabdomyolysis Risk
  if (hasStatin && hasMacrolide) {
    alerts.push({
      type: 'danger',
      title: 'خطر انحلال العضلات المخططة (Statin-Macrolide Rhabdomyolysis)',
      detail: 'المضادات الحيوية الماكروليدية (خاصة Clarithromycin/Erythromycin) تثبط استقلاب الستاتين عبر CYP3A4 رافعة تركيزه بالدم لدرجات سمية عضلية حادة.',
      mechanism: 'Potent CYP3A4 inhibition elevates statin AUC up to 10-fold',
      recommendation: 'Temporarily withhold Statin during antibiotic course or use Azithromycin.',
    });
  }

  // 5. Hyperkalemia Hazard: ACEi/ARB + Spironolactone
  if (hasACEorARB && hasSpironolactone) {
    alerts.push({
      type: 'warning',
      title: 'تنبيه سريري: خطر فرط بوتاسيوم الدم (Hyperkalemia Hazard)',
      detail: 'الجمع بين حاصرات الرينين ومدر البول الحافظ للبوتاسيوم (Spironolactone) يتطلب متابعة البوتاسيوم المصلي لتفادي اضطراب نظم القلب.',
      mechanism: 'Dual blockade of aldosterone and potassium secretion',
      recommendation: 'Check serum K+ within 1-2 weeks; educate patient on avoiding potassium salt substitutes.',
    });
  }

  // 6. Beta Blocker + Non-DHP CCB
  if (hasBetaBlocker && hasNonDHP_CCB) {
    alerts.push({
      type: 'danger',
      title: 'خطر إحصار القلب وبطء النبض الشديد (Severe Bradycardia / Heart Block)',
      detail: 'الجمع بين حاصرات بيتا وفيراباميل أو دلتيازيم يضاعف التأثير السلبي على العقدة الجيبية الأذينية والأذينية البطينية.',
      mechanism: 'Additive negative inotropic and chronotropic suppression',
      recommendation: 'Avoid combination unless under intensive electrophysiological monitoring.',
    });
  }

  return alerts;
}

export function getEvidenceBasedCompanion(genericOrClass: string): NutritionalCompanion | null {
  const g = genericOrClass.toLowerCase();

  if (g.includes('metformin')) {
    return {
      title: 'فيتامين B12 عالي الامتصاص (Sublingual B12)',
      rationale: 'استخدام الميتفورمين المزمن يقلل امتصاص فيتامين B12 في الأمعاء بنسبة 30% مسبباً اعتلال الأعصاب المحيطية وفقر الدم.',
      category: 'Metabolic & Nerve Support',
    };
  }

  if (g.includes('statin') || g.includes('atorvastatin') || g.includes('rosuvastatin') || g.includes('simvastatin')) {
    return {
      title: 'مساعد إنزيم كيو 10 النشط (CoQ10 Ubiquinol)',
      rationale: 'الستاتينات تثبط الإنزيم المسؤول عن اصطناع الكوليسترول والـ CoQ10 معاً في خلايا العضلات، ومكمل CoQ10 يخفف آلام العضلات (SAMS).',
      category: 'Mitochondrial Muscle Protection',
    };
  }

  if (g.includes('diuretic') || g.includes('furosemide') || g.includes('indapamide') || g.includes('hctz')) {
    return {
      title: 'مكمل توازن المغنيسيوم والبوتاسيوم (Mg/K Balance)',
      rationale: 'المدرات تزيد الطرح الكلوي للكهارل؛ يعالج المغنيسيوم تشنجات الساقين الليلية ويحافظ على استقرار نظم القلب الكهربائي.',
      category: 'Electrolyte Balance',
    };
  }

  if (g.includes('glimepiride') || g.includes('gliclazide') || g.includes('glibenclamide')) {
    return {
      title: 'أقراص جلوكوز سريعة الامتصاص + شرائط فحص سكر منزلية',
      rationale: 'محفزات إفراز الأنسولين تنطوي على مخاطر هبوط سكر مفاجئ يستلزم تدخل إسعافي سريع برفع السكر الفوري.',
      category: 'Hypoglycemia Rescue Kit',
    };
  }

  if (g.includes('sartan') || g.includes('pril') || g.includes('olol') || g.includes('dipine')) {
    return {
      title: 'جهاز ضغط رقمي ذراعي معتمد سريرياً',
      rationale: 'توصي الإرشادات العالمية بمراقبة الضغط المنزلي المنتظمة (HBPM) لضبط الجرعات والتأكد من الوصول للهدف العلاجي < 130/80.',
      category: 'Home Monitoring Vital',
    };
  }

  if (g.includes('budesonide') || g.includes('beclomethasone') || g.includes('fluticasone') || g.includes('salbutamol')) {
    return {
      title: 'مفساح استنشاق صمامي (AeroChamber Spacer)',
      rationale: 'يرفع نسبة وصول الستيرويد إلى الرئتين بنسبة تفوق 70% ويمنع ترسبه في الحلق لتجنب الفطريات الفموية وبحة الصوت.',
      category: 'Inhalation Technique Optimization',
    };
  }

  if (g.includes('prazole') || g.includes('esomeprazole') || g.includes('pantoprazole') || g.includes('omeprazole')) {
    return {
      title: 'سترات الكالسيوم + فيتامين D3 + مغنيسيوم',
      rationale: 'تثبيط حموضة المعدة المزمن يقلل امتصاص الكالسيوم والمغنيسيوم مما يهدد الكثافة العظمية بمرور الوقت.',
      category: 'Bone Mineral Density',
    };
  }

  return null;
}

export function getDrugScheduleSuggestion(drugName: string): {
  timing: 'morning' | 'noon' | 'evening' | 'bedtime' | 'bid';
  mealRelation: 'before_meal' | 'with_meal' | 'after_meal' | 'empty_stomach' | 'anytime';
  instructionsAr: string;
} {
  const g = resolveGenericDrug(drugName);

  if (g.includes('metformin')) {
    return {
      timing: 'bid',
      mealRelation: 'with_meal',
      instructionsAr: 'مع وجبة الطعام أو بعدها مباشرة لتقليل الاضطراب المعوي.',
    };
  }

  if (g.includes('prazole')) {
    return {
      timing: 'morning',
      mealRelation: 'before_meal',
      instructionsAr: 'على معدة فارغة قبل الفطور بـ 30-60 دقيقة.',
    };
  }

  if (g.includes('statin')) {
    return {
      timing: 'bedtime',
      mealRelation: 'anytime',
      instructionsAr: 'مساءً قبل النوم حيث يبلغ تصنيع الكوليسترول الكبدي ذروته ليلاً.',
    };
  }

  if (g.includes('glimepiride') || g.includes('gliclazide')) {
    return {
      timing: 'morning',
      mealRelation: 'before_meal',
      instructionsAr: 'قبل وجبة الإفطار أو أول وجبة رئيسية في اليوم مباشرة.',
    };
  }

  if (g.includes('diuretic')) {
    return {
      timing: 'morning',
      mealRelation: 'after_meal',
      instructionsAr: 'صباحاً لتجنب التبول الليلي المتكرر واضطراب النوم.',
    };
  }

  if (g.includes('nsaid')) {
    return {
      timing: 'bid',
      mealRelation: 'after_meal',
      instructionsAr: 'بعد وجبة طعام كاملة مع كوب ماء وفير.',
    };
  }

  return {
    timing: 'morning',
    mealRelation: 'anytime',
    instructionsAr: 'يؤخذ بانتظام في نفس الوقت يومياً.',
  };
}
