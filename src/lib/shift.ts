const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_SHIFT_START = 7 * 60 + 30;
const DAY_SHIFT_END = 20 * 60;

function toJakarta(at: Date): Date {
	return new Date(at.getTime() + JAKARTA_OFFSET_MS);
}

export function getShift(at: Date = new Date()): 'DAY' | 'NIGHT' {
	const jakarta = toJakarta(at);
	const minutes = jakarta.getUTCHours() * 60 + jakarta.getUTCMinutes();
	return minutes >= DAY_SHIFT_START && minutes < DAY_SHIFT_END ? 'DAY' : 'NIGHT';
}
