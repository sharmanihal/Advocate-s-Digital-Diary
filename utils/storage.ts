
import { DiaryData, LegalCase } from '../types';

const STORAGE_KEY = 'advocate_diary_data';
const BACKUP_REMINDER_KEY = 'last_backup_prompt_ts';

export const saveDiaryData = (data: DiaryData) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

export const loadDiaryData = (): DiaryData => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    return {
      cases: [],
      lastBackupDate: null,
      advocateName: 'Counsel'
    };
  }
  try {
    return JSON.parse(stored);
  } catch (e) {
    console.error("Failed to parse stored diary data", e);
    return {
      cases: [],
      lastBackupDate: null,
      advocateName: 'Counsel'
    };
  }
};

export const exportToJson = (data: DiaryData) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `diary_backup_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  
  // Update last backup date
  const newData = { ...data, lastBackupDate: new Date().toISOString() };
  saveDiaryData(newData);
  return newData;
};

export const importFromJson = (jsonStr: string): DiaryData | null => {
  try {
    const data = JSON.parse(jsonStr);
    if (data && Array.isArray(data.cases)) {
      return data as DiaryData;
    }
    return null;
  } catch (e) {
    console.error("Failed to import JSON", e);
    return null;
  }
};

export const shouldShowBackupReminder = (): boolean => {
  const lastPrompt = localStorage.getItem(BACKUP_REMINDER_KEY);
  if (!lastPrompt) return true;
  
  const lastPromptTs = parseInt(lastPrompt, 10);
  const now = Date.now();
  const twentyFourHours = 24 * 60 * 60 * 1000;
  
  return (now - lastPromptTs) > twentyFourHours;
};

export const markBackupReminderAsShown = () => {
  localStorage.setItem(BACKUP_REMINDER_KEY, Date.now().toString());
};
