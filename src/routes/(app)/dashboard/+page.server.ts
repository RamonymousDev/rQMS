import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch, locals }) => {
    const user = (locals && (locals as any).user) || null;

    // fetch accessible lines (requires login)
    const linesRes = await fetch('/api/inspect/lines');
    const lines = linesRes.ok ? await linesRes.json() : [];

    // fetch recent inspections (limit handled by server if supported)
    const insRes = await fetch('/api/inspections?limit=5');
    const inspections = insRes.ok ? await insRes.json() : [];

    return { user, lines, inspections };
};
