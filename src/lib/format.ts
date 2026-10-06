/** Timestamp disimpan UTC; tampilkan dalam waktu Jakarta (id-ID, pendek). */
export function formatDateTime(value: string | Date): string {
	return new Date(value).toLocaleString('id-ID', {
		timeZone: 'Asia/Jakarta',
		dateStyle: 'short',
		timeStyle: 'short'
	});
}
