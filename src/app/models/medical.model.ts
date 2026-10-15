import { Language } from './settings.model';
import { StaffRole } from './staff.model';

export type AllergySeverity = 'SEVERE' | 'MODERATE' | 'MILD' | 'UNKNOWN';

export interface AuditStamp {
  createdAt: string;
  createdByName: string | null;
  updatedAt: string;
  updatedByName: string | null;
}

export interface Allergy extends AuditStamp { id: number; substance: string; severity: AllergySeverity; reaction: string | null }
export interface Medication extends AuditStamp { id: number; name: string; dose: string | null; frequency: string | null; startDate: string | null }
export interface Procedure extends AuditStamp { id: number; name: string; performedOn: string; surgeonStaffId: number | null; surgeonName: string | null }
export interface Diagnosis extends AuditStamp { id: number; description: string; icd10Code: string | null; diagnosedOn: string | null }

export interface PatientMedical {
  patientId: number;
  dateOfBirth: string | null;
  healthNumberMasked: string | null;
  allergies: Allergy[];
  medications: Medication[];
  procedures: Procedure[];
  diagnoses: Diagnosis[];
}

export interface AllergyRequest { substance: string; severity: AllergySeverity; reaction: string | null }
export interface MedicationRequest { name: string; dose: string | null; frequency: string | null; startDate: string | null }
export interface ProcedureRequest { name: string; performedOn: string; surgeonStaffId: number | null; surgeonName: string | null }
export interface DiagnosisRequest { description: string; icd10Code: string | null; diagnosedOn: string | null }

export type MedicalList = 'allergies' | 'medications' | 'procedures' | 'diagnoses';

export interface HealthNumberRequest { healthNumber: string }
export interface HealthNumberMasked { healthNumberMasked: string }
export interface RevealRequest { reason: string }
export interface HealthNumberReveal { healthNumber: string; healthNumberMasked: string; revealedAt: string }

export interface EmergencyContactRequest { name: string; relationship: string; phone: string; preferredLanguage: Language }
export interface EmergencyContact extends AuditStamp {
  id: number; name: string; relationship: string; phone: string; preferredLanguage: Language;
}

export interface CareTeamAssignRequest { staffId: number; role: StaffRole | null }
export interface CareTeamMember {
  assignmentId: number; staffId: number; displayName: string; role: StaffRole; active: boolean;
  assignedAt: string; assignedByName: string | null;
}
