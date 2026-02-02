
export interface Hearing {
  id: string;
  date: string;
  note: string;
}

export enum CaseStatus {
  ONGOING = 'Ongoing',
  DISPOSED = 'Disposed',
  STAYED = 'Stayed',
  APPEALED = 'Appealed',
  DISMISSED = 'Dismissed'
}

export interface LegalCase {
  id: string;
  title: string;
  referenceNumber: string;
  courtName: string;
  description: string;
  status: CaseStatus;
  nextHearingDate: string;
  history: Hearing[];
  createdAt: string;
}

export interface DiaryData {
  cases: LegalCase[];
  lastBackupDate: string | null;
  advocateName: string;
}

export type View = 'dashboard' | 'cases' | 'calendar' | 'settings';
