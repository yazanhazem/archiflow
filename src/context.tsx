import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import type { Lang } from './types';
import type { StudioController } from './useStudio';
import type { Theme } from './theme';

export type AppContextValue = {
  studio: StudioController; lang: Lang; setLang: (lang: Lang) => void; t: (text: string) => string;
  navigate: (path: string) => void; params: URLSearchParams; busy: boolean;
  theme: Theme; setTheme: (theme: Theme) => void;
  openModal: (title: string, body: ReactNode) => void; closeModal: () => void;
  run: (action: () => Promise<unknown> | unknown, message?: string, close?: boolean) => Promise<boolean>;
};
export const AppContext = createContext<AppContextValue | null>(null);
export function useApp() { const value = useContext(AppContext); if (!value) throw new Error('Missing workspace context'); return value; }
