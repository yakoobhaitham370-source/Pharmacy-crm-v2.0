export interface Medication {
  id?: string;
  name: string;
  lastDispenseDate: string;
  daysSupply: number;
  dosage?: string;
  timing?: 'morning' | 'noon' | 'evening' | 'bedtime' | 'bid' | 'tid' | 'qid';
  mealRelation?: 'before_meal' | 'with_meal' | 'after_meal' | 'empty_stomach' | 'anytime';
  prescriber?: string;
  genericClass?: string;
}

export interface VitalsEntry {
  id?: string;
  date: string;
  bp: string;
  systolic?: number;
  diastolic?: number;
  sugar: string;
  glucose?: number;
  hba1c?: string;
  misc: string;
  assessment?: string;
}

export interface LabScan {
  id?: string;
  date: string;
  title?: string;
  dataUrl: string;
  driveUrl?: string;
  extractedNotes?: string;
}

export interface Patient {
  id: string;
  name: string;
  phone: string;
  dob?: string;
  age?: number;
  gender?: 'M' | 'F' | 'Other';
  familyTag?: string;
  loyaltyPoints: number;
  allergies?: string;
  notes?: string;
  medications: Medication[];
  vitals?: VitalsEntry[];
  scans?: LabScan[];
  isArchived?: boolean;
  archivedDate?: string;
  archiveReason?: string;
  lastReminderSent?: string;
  createdAt: string;
}

export type FollowUpType = 'ANTIBIOTIC' | 'CHRONIC_INIT' | 'TITRATION' | 'SIDE_EFFECT';

export interface FollowUpEntry {
  id: string;
  patientId: string;
  patientName: string;
  phone: string;
  type: FollowUpType;
  drug: string;
  startDate: string;
  dueDate: string;
  daysOffset: number;
  notes: string;
  resolved: boolean;
  createdAt: string;
  resolvedAt?: string;
  // Clinical adherence rate & vitals recorded during milestone follow-up
  adherenceRate?: number; // e.g. 50-100%
  systolic?: number;      // e.g. 110-180 mmHg
  diastolic?: number;     // e.g. 60-110 mmHg
  bloodGlucose?: number;  // e.g. 70-300 mg/dL
  heartRate?: number;     // e.g. 55-110 bpm
  milestoneTitle?: string;// e.g. "Day 0 - Initial", "Day 3 - Check-in", "Day 14 - Titration"
}

export interface Settings {
  pharmacyName: string;
  gasUrl: string;
  waTemplate: string;
  waAbxTemplate: string;
  waChronicFollowTemplate: string;
  smsTemplate: string;
  waDropoutTemplate: string;
  autoCloudSync?: boolean;
}

export interface InteractionAlert {
  type: 'danger' | 'warning' | 'info';
  title: string;
  detail: string;
  drugs?: string[];
  mechanism?: string;
  recommendation?: string;
}

export interface NutritionalCompanion {
  title: string;
  rationale: string;
  category?: string;
}

export interface InventoryForecastItem {
  drugName: string;
  genericClass: string;
  activePatientsCount: number;
  demand7Days: number;
  demand14Days: number;
  demand30Days: number;
  estimatedBoxesNeeded: number;
  status: 'critical' | 'warning' | 'stable';
}

export interface HouseholdMemberAlignment {
  patientId: string;
  patientName: string;
  phone: string;
  medName: string;
  currentExpiry: string;
  daysRemaining: number;
  neededTablets: number;
  targetDateStr: string;
}
