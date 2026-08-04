import { DarkMode } from '../types';

export const NEXT_MODE: Record<DarkMode, DarkMode> = { light: 'dark', dark: 'auto', auto: 'light' };
export const MODE_LABEL: Record<DarkMode, string> = { light: 'light', dark: 'dark', auto: 'auto' };
export const DARK_MODE_CYCLE: DarkMode[] = ['light', 'dark', 'auto'];

export function resolveDark(mode: DarkMode): boolean {
  if (mode === 'dark') return true;
  if (mode === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function applyTheme(mode: DarkMode): void {
  document.documentElement.classList.toggle('dark', resolveDark(mode));
}
