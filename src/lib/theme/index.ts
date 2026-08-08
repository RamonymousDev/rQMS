export const THEME_KEY = 'qms-theme';

export function getInitialTheme(): 'dark' | 'light' {
	if (typeof window === 'undefined') return 'light';
	const stored = localStorage.getItem(THEME_KEY);
	if (stored === 'dark' || stored === 'light') return stored;
	return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(theme: 'dark' | 'light'): void {
	if (typeof document === 'undefined') return;
	const root = document.documentElement;
	if (theme === 'dark') {
		root.classList.add('dark');
	} else {
		root.classList.remove('dark');
	}
}

export function toggleTheme(): 'dark' | 'light' {
	const current = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
	const next = current === 'dark' ? 'light' : 'dark';
	applyTheme(next);
	localStorage.setItem(THEME_KEY, next);
	return next;
}
