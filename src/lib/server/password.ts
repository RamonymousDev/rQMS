import argon2 from 'argon2';

export function hashPassword(password: string): Promise<string> {
	return argon2.hash(password);
}

export function verifyPassword(hash: string, password: string): Promise<boolean> {
	return argon2.verify(hash, password);
}

export function validatePasswordStrength(password: string): { valid: boolean; message: string } {
	if (password.length < 8) {
		return { valid: false, message: 'Password minimal 8 karakter.' };
	}
	if (!/[A-Z]/.test(password)) {
		return { valid: false, message: 'Password harus mengandung huruf besar.' };
	}
	if (!/[a-z]/.test(password)) {
		return { valid: false, message: 'Password harus mengandung huruf kecil.' };
	}
	if (!/[0-9]/.test(password)) {
		return { valid: false, message: 'Password harus mengandung angka.' };
	}
	if (!/[^A-Za-z0-9]/.test(password)) {
		return { valid: false, message: 'Password harus mengandung simbol.' };
	}
	return { valid: true, message: '' };
}

export function isPasswordReused(newPassword: string, history: string[]): Promise<boolean> {
	// We cannot directly compare hashes because argon2 uses random salts.
	// We verify against each historical hash instead.
	return Promise.all(history.map((hash) => verifyPassword(hash, newPassword))).then((results) =>
		results.some(Boolean)
	);
}
