import { useEffect, useState } from 'react';

export type Theme = 'system' | 'light' | 'dark';
const key = 'studio-theme';
const deviceTheme = '(prefers-color-scheme: dark)';

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved === 'light' || saved === 'dark') return saved;
    } catch { /* The device theme also works with browser storage disabled. */ }
    return 'system';
  });

  useEffect(() => {
    const device = matchMedia(deviceTheme);
    const apply = () => {
      const resolved = theme === 'system' ? (device.matches ? 'dark' : 'light') : theme;
      document.documentElement.dataset.theme = resolved;
      document.documentElement.style.colorScheme = resolved;
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolved === 'dark' ? '#141b23' : '#f3f6f9');
    };
    apply();
    try { localStorage.setItem(key, theme); } catch { /* Keep the active choice for this visit. */ }
    if (theme !== 'system') return;
    device.addEventListener('change', apply);
    return () => device.removeEventListener('change', apply);
  }, [theme]);

  return { theme, setTheme };
}
