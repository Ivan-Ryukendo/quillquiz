import { getDB } from './db';
import type { AppSettings } from '../markdown/types';

const SETTINGS_KEY = 'app-settings';

const DEFAULT_SETTINGS: AppSettings = {
  useDemoMode: true,
};

export async function getSettings(): Promise<AppSettings> {
  const db = await getDB();
  const record = await db.get('settings', SETTINGS_KEY);
  return record?.data ?? DEFAULT_SETTINGS;
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const db = await getDB();
  await db.put('settings', { key: SETTINGS_KEY, data: settings });
}
