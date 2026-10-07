<script lang="ts">
	import { beforeNavigate, goto } from '$app/navigation';
	import { base, resolve } from '$app/paths';
	import type { ResolvedPathname } from '$app/types';
	import { onMount, onDestroy } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { getShift } from '$lib/shift.js';
	import { Progress } from '$lib/components/ui/progress/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { QrScanner } from '$lib/components/ui/qr-scanner/index.js';
	import * as ToggleGroup from '$lib/components/ui/toggle-group/index.js';
	import StatusBadge from '$lib/components/status-badge.svelte';
	import { cn } from '$lib/utils.js';
	import CheckIcon from '@lucide/svelte/icons/check';
	import ClockIcon from '@lucide/svelte/icons/clock';
	import CircleCheckIcon from '@lucide/svelte/icons/circle-check';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';

	type Line = { id: string; code: string; name: string; process?: { name: string } };

	type FormSpec = {
		configId: string;
		partNo: string;
		partName: string;
		lineCode: string;
		lineName: string;
		stage: 'START' | 'MIDDLE' | 'END';
		shift: 'DAY' | 'NIGHT';
		hasSpot: boolean;
		spotStandard: number | null;
		hasPoint: boolean;
		points: { pointNo: string }[];
		hasHardware: boolean;
		hardwares: {
			/** id baris part_line_hardwares — kunci jawaban per titik. */
			id: string;
			hwNo: string;
			hwName: string;
			checkType: 'TORQUE' | 'HAMMER';
			qty: number;
			standardValue: number;
			unit: string;
		}[];
		hasLength: boolean;
		lengths: { lengthNo: string; standardMm: number }[];
		hasVisual: boolean;
		requiresRecheckConfirm: boolean;
		lastInspection: {
			overallStatus: 'OK' | 'NG';
			operatorName: string;
			inspectedAt: string;
		} | null;
	};

	const STAGES = ['START', 'MIDDLE', 'END'] as const;

	let lines: Line[] = $state([]);
	let loadingLines = $state(true);

	let selectedLine: Line | null = $state(null);
	let partNo = $state('');
	let stage: 'START' | 'MIDDLE' | 'END' | null = $state(null);
	let spec: FormSpec | null = $state(null);
	let preparing = $state(false);
	let submitting = $state(false);
	let recheckDialogOpen = $state(false);
	let recheckConfirmed = $state(false);
	let inputMode: 'qr' | 'manual' = $state('manual');

	let pointAnswers: Record<string, { status: 'OK' | 'NG' | null; remarks: string }> = $state({});
	let spotActual = $state('');
	let hardwareAnswers: Record<string, { actualValue: string; remarks: string }> = $state({});
	let lengthAnswers: Record<string, { actualMm: string; remarks: string }> = $state({});
	let visualStatus: 'OK' | 'NG' | null = $state(null);
	let visualRemarks = $state('');

	let isDirty = $state(false);
	let navDialogOpen = $state(false);
	let pendingNavigation = $state<ResolvedPathname>('' as unknown as ResolvedPathname);
	let currentStep = $derived.by(() => {
		if (!selectedLine) return 1;
		if (!spec) return 2;
		return 3;
	});

	const activeShift = $derived(getShift());

	/**
	 * Hitung progress: berapa item wajib sudah diisi vs total.
	 * Item wajib = semua point, spot (kalau hasSpot), hardware, length, visual.
	 */
	const progress = $derived.by(() => {
		if (!spec) return { filled: 0, total: 0, pct: 0 };
		let total = 0;
		let filled = 0;

		if (spec.hasPoint) {
			for (const p of spec.points) {
				total++;
				if (pointAnswers[p.pointNo]?.status) filled++;
			}
		}
		if (spec.hasSpot) {
			total++;
			if (spotActual !== '') filled++;
		}
		if (spec.hasHardware) {
			for (const hw of spec.hardwares) {
				for (let checkNo = 1; checkNo <= hw.qty; checkNo++) {
					total++;
					if (hardwareAnswers[hwKey(hw.id, checkNo)]?.actualValue !== '') filled++;
				}
			}
		}
		if (spec.hasLength) {
			for (const l of spec.lengths) {
				total++;
				if (lengthAnswers[l.lengthNo]?.actualMm !== '') filled++;
			}
		}
		if (spec.hasVisual) {
			total++;
			if (visualStatus) filled++;
		}

		return { filled, total, pct: total === 0 ? 100 : Math.round((filled / total) * 100) };
	});

	const STORAGE_KEY = 'inspect-draft';

	function saveDraft() {
		if (!isDirty) return;
		const draft = {
			partNo,
			inputMode,
			pointAnswers,
			spotActual,
			hardwareAnswers,
			lengthAnswers,
			visualStatus,
			visualRemarks
		};
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
		} catch {
			// ignore storage errors
		}
	}

	function restoreDraft() {
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			if (!raw) return;
			const draft = JSON.parse(raw);
			if (draft.partNo) partNo = draft.partNo;
			if (draft.inputMode) inputMode = draft.inputMode;
			if (draft.pointAnswers) pointAnswers = draft.pointAnswers;
			if (draft.spotActual) spotActual = draft.spotActual;
			if (draft.hardwareAnswers) hardwareAnswers = draft.hardwareAnswers;
			if (draft.lengthAnswers) lengthAnswers = draft.lengthAnswers;
			if (draft.visualStatus) visualStatus = draft.visualStatus;
			if (draft.visualRemarks) visualRemarks = draft.visualRemarks;
			isDirty = true;
		} catch {
			// ignore parse errors
		}
	}

	function clearDraft() {
		try {
			localStorage.removeItem(STORAGE_KEY);
		} catch {
			// ignore
		}
		isDirty = false;
	}

	onMount(async () => {
		try {
			const res = await fetch('/api/inspect/lines');
			if (!res.ok) {
				toast.error('Gagal memuat daftar line.');
				return;
			}
			lines = (await res.json()).data ?? [];
			restoreDraft();
		} finally {
			loadingLines = false;
		}
	});

	function markDirty() {
		isDirty = true;
		saveDraft();
	}

	function resetFlow() {
		spec = null;
		stage = null;
		recheckConfirmed = false;
		pointAnswers = {};
		spotActual = '';
		hardwareAnswers = {};
		lengthAnswers = {};
		visualStatus = null;
		visualRemarks = '';
		partNo = '';
		inputMode = 'manual';
		clearDraft();
	}

	function resetForm() {
		spec = null;
		stage = null;
		recheckConfirmed = false;
		pointAnswers = {};
		spotActual = '';
		hardwareAnswers = {};
		lengthAnswers = {};
		visualStatus = null;
		visualRemarks = '';
		markDirty();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			if (recheckDialogOpen) {
				recheckDialogOpen = false;
				return;
			}
			if (spec) {
				resetFlow();
			}
		}
		if (e.key === 'Enter' && !e.shiftKey) {
			if (spec && !submitting) {
				e.preventDefault();
				submit();
			}
		}
	}

	$effect(() => {
		window.addEventListener('keydown', handleKeydown);
		return () => window.removeEventListener('keydown', handleKeydown);
	});

	beforeNavigate(({ cancel, to }) => {
		if (!isDirty) return;
		cancel();
		if (!to) return;
		pendingNavigation = (to.url.pathname.replace(base, '') + to.url.search) as ResolvedPathname;
		navDialogOpen = true;
	});

	function confirmDiscardDraft() {
		navDialogOpen = false;
		clearDraft();
		if (pendingNavigation) goto(pendingNavigation);
	}

	function selectLine(line: Line) {
		selectedLine = line;
		resetForm();
	}

	function statusFor(
		actual: string | number,
		standard: number,
		mode: 'min' | 'exact' = 'min'
	): 'OK' | 'NG' | null {
		if (actual === '' || actual === null || actual === undefined) return null;
		const value = Number(actual);
		if (!Number.isFinite(value)) return null;
		return mode === 'exact' ? (value === standard ? 'OK' : 'NG') : value >= standard ? 'OK' : 'NG';
	}

	/** Label tipe pengecekan untuk ditampilkan ke operator. */
	function checkTypeLabel(type: 'TORQUE' | 'HAMMER') {
		return type === 'TORQUE' ? 'Torque' : 'Hammer';
	}

	/** Kunci jawaban per titik pengecekan: id baris config + nomor titik. */
	function hwKey(id: string, checkNo: number) {
		return `${id}:${checkNo}`;
	}

	/** Hardware + daftar nomor titiknya (1..qty) untuk render. */
	const hardwareGroups = $derived.by(() =>
		(spec?.hardwares ?? []).map((hw) => ({
			...hw,
			checks: Array.from({ length: hw.qty }, (_, i) => i + 1)
		}))
	);

	async function prepare(nextStage: 'START' | 'MIDDLE' | 'END') {
		if (!selectedLine || !partNo.trim()) {
			toast.error('Pilih line dan isi Part No terlebih dahulu.');
			return;
		}
		preparing = true;
		try {
			const res = await fetch('/api/inspect/prepare', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					lineId: selectedLine.id,
					partNo: partNo.trim(),
					stage: nextStage
				})
			});
			const payload = await res.json();
			if (!res.ok) {
				resetFlow();
				toast.error(payload?.message ?? 'Gagal menyiapkan form inspeksi.');
				return;
			}

			const data: FormSpec = payload.data;
			stage = nextStage;
			spec = data;

			pointAnswers = Object.fromEntries(
				data.points.map((p) => [p.pointNo, { status: null, remarks: '' }])
			);
			hardwareAnswers = Object.fromEntries(
				data.hardwares.flatMap((h) =>
					Array.from({ length: h.qty }, (_, i) => [
						hwKey(h.id, i + 1),
						{ actualValue: '', remarks: '' }
					])
				)
			);
			lengthAnswers = Object.fromEntries(
				data.lengths.map((l) => [l.lengthNo, { actualMm: '', remarks: '' }])
			);
			spotActual = '';
			visualStatus = null;
			visualRemarks = '';
			markDirty();

			if (data.requiresRecheckConfirm) recheckDialogOpen = true;
		} finally {
			preparing = false;
		}
	}

	function buildPayload(confirmRecheck: boolean) {
		if (!spec || !selectedLine || !stage) return null;
		return {
			lineId: selectedLine.id,
			partNo: spec.partNo,
			stage,
			confirmRecheck,
			spotActual: spec.hasSpot ? Number(spotActual) : null,
			points: spec.hasPoint
				? spec.points.map((p) => ({
						pointNo: p.pointNo,
						status: pointAnswers[p.pointNo]?.status,
						remarks: pointAnswers[p.pointNo]?.remarks || null
					}))
				: [],
			hardwares: spec.hasHardware
				? spec.hardwares.flatMap((hw) =>
						Array.from({ length: hw.qty }, (_, i) => {
							const answer = hardwareAnswers[hwKey(hw.id, i + 1)];
							return {
								id: hw.id,
								checkNo: i + 1,
								actualValue: Number(answer?.actualValue),
								remarks: answer?.remarks || null
							};
						})
					)
				: [],
			lengths: spec.hasLength
				? spec.lengths.map((l) => ({
						lengthNo: l.lengthNo,
						actualMm: Number(lengthAnswers[l.lengthNo]?.actualMm),
						remarks: lengthAnswers[l.lengthNo]?.remarks || null
					}))
				: [],
			visualStatus: spec.hasVisual ? visualStatus : null,
			visualRemarks: spec.hasVisual ? visualRemarks || null : null
		};
	}

	function validate(): string | null {
		if (!spec) return 'Form belum siap.';

		if (spec.hasPoint) {
			for (const point of spec.points) {
				const answer = pointAnswers[point.pointNo];
				if (!answer?.status) return `Point "${point.pointNo}" belum diisi.`;
				if (answer.status === 'NG' && !answer.remarks.trim()) {
					return `Remarks wajib diisi untuk Point "${point.pointNo}" yang NG.`;
				}
			}
		}
		if (spec.hasSpot) {
			const spotValue = spotActual === '' ? null : Number(spotActual);
			if (spotValue === null || !Number.isFinite(spotValue)) return 'Spot actual belum diisi.';
		}

		if (spec.hasHardware) {
			for (const hw of spec.hardwares) {
				for (let checkNo = 1; checkNo <= hw.qty; checkNo++) {
					const answer = hardwareAnswers[hwKey(hw.id, checkNo)];
					if (!answer?.actualValue) return `Hardware "${hw.hwNo}" titik ${checkNo} belum diisi.`;
					if (statusFor(answer.actualValue, hw.standardValue) === 'NG' && !answer.remarks.trim()) {
						return `Remarks wajib diisi untuk Hardware "${hw.hwNo}" titik ${checkNo} yang NG.`;
					}
				}
			}
		}
		if (spec.hasLength) {
			for (const length of spec.lengths) {
				const answer = lengthAnswers[length.lengthNo];
				if (!answer?.actualMm) return `Length "${length.lengthNo}" belum diisi.`;
				if (
					statusFor(answer.actualMm, length.standardMm, 'min') === 'NG' &&
					!answer.remarks.trim()
				) {
					return `Remarks wajib diisi untuk Length "${length.lengthNo}" yang NG.`;
				}
			}
		}
		if (spec.hasVisual) {
			if (!visualStatus) return 'Visual belum diisi.';
			if (visualStatus === 'NG' && !visualRemarks.trim()) {
				return 'Remarks wajib diisi untuk Visual yang NG.';
			}
		}
		return null;
	}

	async function submit() {
		const problem = validate();
		if (problem) {
			toast.error(problem);
			return;
		}
		const payload = buildPayload(recheckConfirmed);
		if (!payload) return;

		submitting = true;
		try {
			const res = await fetch('/api/inspect/submit', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(payload)
			});
			const body = await res.json();
			if (res.status === 409) {
				recheckDialogOpen = true;
				return;
			}
			if (!res.ok) {
				toast.error(body?.message ?? 'Gagal menyimpan inspeksi.');
				return;
			}

			const spotOk =
				payload.spotActual !== null &&
				statusFor(payload.spotActual, spec!.spotStandard ?? 0, 'exact') === 'OK';
			const spotNg =
				payload.spotActual !== null &&
				statusFor(payload.spotActual, spec!.spotStandard ?? 0, 'exact') === 'NG';

			const okCount =
				(payload.points?.filter((p) => p.status === 'OK').length ?? 0) +
				(payload.hardwares?.filter(
					(h) =>
						statusFor(h.actualValue, spec!.hardwares.find((x) => x.id === h.id)!.standardValue) ===
						'OK'
				).length ?? 0) +
				(payload.lengths?.filter(
					(l) =>
						statusFor(
							l.actualMm,
							spec!.lengths.find((x) => x.lengthNo === l.lengthNo)!.standardMm,
							'min'
						) === 'OK'
				).length ?? 0) +
				(spotOk ? 1 : 0) +
				(payload.visualStatus === 'OK' ? 1 : 0);
			const ngCount =
				(payload.points?.filter((p) => p.status === 'NG').length ?? 0) +
				(payload.hardwares?.filter(
					(h) =>
						statusFor(h.actualValue, spec!.hardwares.find((x) => x.id === h.id)!.standardValue) ===
						'NG'
				).length ?? 0) +
				(payload.lengths?.filter(
					(l) =>
						statusFor(
							l.actualMm,
							spec!.lengths.find((x) => x.lengthNo === l.lengthNo)!.standardMm,
							'min'
						) === 'NG'
				).length ?? 0) +
				(spotNg ? 1 : 0) +
				(payload.visualStatus === 'NG' ? 1 : 0);

			toast.success(
				`Inspeksi tersimpan. Overall: ${body.data.overallStatus}. Detail: ${okCount} OK, ${ngCount} NG.`
			);
			const nextPartNo = spec!.partNo;
			resetFlow();
			partNo = nextPartNo;
		} finally {
			submitting = false;
		}
	}

	function confirmRecheck() {
		recheckDialogOpen = false;
		recheckConfirmed = true;
		if (!validate()) submit();
	}

	function cancelRecheck() {
		recheckDialogOpen = false;
		resetFlow();
		goto(resolve('/dashboard'));
	}

	// Status "terpilih" untuk tombol OK/NG manual (points & visual).
	// Hijau/red TIDAK boleh dipakai sebagai warna brand di sini — warna ini
	// reserved untuk status hasil inspeksi (lihat design-system/rqms/MASTER.md).
	const okBtnClass =
		'bg-status-ok text-white hover:bg-status-ok/90 focus-visible:ring-status-ok/50 border-status-ok';
	const ngBtnClass =
		'bg-status-ng text-white hover:bg-status-ng/90 focus-visible:ring-status-ng/50 border-status-ng';

	onDestroy(() => {
		clearDraft();
	});
</script>

<svelte:window on:beforeunload={() => (isDirty ? '' : undefined)} />

<div class="grid gap-4">
	<!-- Stepper: sekarang fungsional — kartu di bawah hanya merender langkah aktif. -->
	<ol class="flex items-center gap-2" aria-label="Tahapan inspeksi">
		{#each [{ n: 1, label: 'Pilih Line' }, { n: 2, label: 'Scan Part' }, { n: 3, label: 'Isi Form' }] as step (step.n)}
			<li class="flex min-w-0 items-center gap-2">
				<span
					aria-current={currentStep === step.n ? 'step' : undefined}
					class={cn(
						'flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors duration-150',
						currentStep >= step.n
							? 'border-primary bg-primary text-primary-foreground'
							: 'border-muted text-muted-foreground'
					)}
				>
					{#if currentStep > step.n}
						<CheckIcon class="size-4" aria-hidden="true" />
					{:else}
						{step.n}
					{/if}
				</span>
				<span
					class={cn(
						'truncate text-sm font-medium',
						currentStep === step.n ? 'text-foreground' : 'text-muted-foreground'
					)}
				>
					{step.label}
				</span>
			</li>
			{#if step.n < 3}
				<li class="h-0.5 min-w-4 flex-1" aria-hidden="true">
					<div
						class={cn(
							'h-full rounded-full transition-colors duration-150',
							currentStep > step.n ? 'bg-primary' : 'bg-muted'
						)}
					></div>
				</li>
			{/if}
		{/each}
	</ol>

	<!--
		Langkah 1 — pilih line.
		Tombol full-width per line (bukan chip yang membungkus) supaya target
		sentuhnya lebar dan operator tidak perlu membidik chip kecil di antara
		banyak baris.
	-->
	{#if currentStep === 1}
		<Card>
			<CardHeader>
				<CardTitle>1. Pilih Line</CardTitle>
				<CardDescription>Hanya line yang sesuai permission Anda yang ditampilkan.</CardDescription>
			</CardHeader>
			<CardContent>
				{#if loadingLines}
					<div class="grid gap-2 sm:grid-cols-2">
						{#each [0, 1, 2, 3] as idx (idx)}
							<Skeleton class="h-14 w-full" />
						{/each}
					</div>
				{:else if lines.length === 0}
					<p class="text-sm text-muted-foreground">
						Tidak ada line yang bisa Anda akses. Hubungi admin untuk mendapatkan permission.
					</p>
				{:else}
					<div class="grid gap-2 sm:grid-cols-2">
						{#each lines as line (line.id)}
							{@const isSelected = selectedLine?.id === line.id}
							<button
								type="button"
								aria-pressed={isSelected}
								onclick={() => selectLine(line)}
								class={cn(
									'flex min-h-14 cursor-pointer items-center gap-3 rounded-lg border p-3 text-left transition-colors duration-150',
									isSelected
										? 'border-primary bg-primary/5 ring-1 ring-primary'
										: 'border-input bg-background hover:bg-accent'
								)}
							>
								<span
									class={cn(
										'flex size-9 shrink-0 items-center justify-center rounded-md font-mono text-sm font-bold',
										isSelected
											? 'bg-primary text-primary-foreground'
											: 'bg-muted text-muted-foreground'
									)}
								>
									{line.code}
								</span>
								<span class="min-w-0 flex-1">
									<span class="block truncate text-sm font-medium">{line.name}</span>
									{#if line.process?.name}
										<span class="block truncate text-xs text-muted-foreground">
											{line.process.name}
										</span>
									{/if}
								</span>
								{#if isSelected}
									<CircleCheckIcon class="size-5 shrink-0 text-primary" aria-hidden="true" />
								{/if}
							</button>
						{/each}
					</div>
				{/if}
			</CardContent>
		</Card>
	{/if}

	<!-- Langkah 2 — scan part & pilih stage -->
	{#if currentStep === 2 && selectedLine}
		<Card>
			<CardHeader>
				<div class="flex items-start justify-between gap-3">
					<div class="min-w-0">
						<CardTitle>2. Scan Part &amp; Pilih Stage</CardTitle>
						<CardDescription>
							Line aktif: <span class="font-mono font-medium">{selectedLine.code}</span>
							· {selectedLine.name}
						</CardDescription>
					</div>
					<!--
						Shift dihitung server (WIB) dan dikirim lewat prepare — jangan
						hitung di client, timezone browser operator bisa berbeda.
					-->
					<Badge variant={activeShift === 'DAY' ? 'secondary' : 'outline'} class="shrink-0 gap-1.5">
						<ClockIcon class="size-3.5" aria-hidden="true" />
						Shift {activeShift}
					</Badge>
				</div>
			</CardHeader>
			<CardContent class="grid gap-4">
				<div class="grid gap-2">
					<div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
						<Label for="partNo">Part No</Label>
						<ToggleGroup.Root
							type="single"
							bind:value={inputMode}
							variant="outline"
							class="h-8 rounded-md"
						>
							<ToggleGroup.Item value="manual" class="h-7 px-2 text-xs">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="14"
									height="14"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
									class="lucide lucide-keyboard"
								>
									<path d="M4 4h16v16H4z" />
									<path d="M8 12h.01" />
									<path d="M12 12h.01" />
									<path d="M16 12h.01" />
								</svg>
								Manual
							</ToggleGroup.Item>
							<ToggleGroup.Item value="qr" class="h-7 px-2 text-xs">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="14"
									height="14"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
									class="lucide lucide-camera"
								>
									<path
										d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"
									/>
									<circle cx="12" cy="13" r="3" />
								</svg>
								QR Scan
							</ToggleGroup.Item>
						</ToggleGroup.Root>
					</div>
					{#if inputMode === 'qr'}
						<QrScanner bind:value={partNo} scan={true} disabled={preparing} />
					{:else}
						<Input
							id="partNo"
							placeholder="Scan atau ketik part no..."
							class="h-12 font-mono uppercase"
							bind:value={partNo}
							oninput={markDirty}
						/>
					{/if}
				</div>
				<div class="grid gap-1.5">
					<Label for="stage">Stage</Label>
					<div class="grid grid-cols-3 gap-2">
						{#each STAGES as option (option)}
							<Button
								id="stage"
								size="lg"
								variant={stage === option ? 'default' : 'outline'}
								disabled={preparing || !partNo.trim()}
								onclick={() => prepare(option)}
							>
								{option}
							</Button>
						{/each}
					</div>
					{#if preparing}
						<p class="flex items-center gap-2 text-sm text-muted-foreground">
							<Skeleton class="h-3.5 w-32" />
							Memuat konfigurasi inspeksi…
						</p>
					{:else}
						<p class="text-xs text-muted-foreground">
							Pilih stage untuk memuat standar inspeksi. Stage yang sama pada shift berjalan yang
							sudah <span class="font-medium text-foreground">OK</span> akan meminta konfirmasi re-check.
						</p>
					{/if}
				</div>
			</CardContent>
		</Card>
	{/if}

	<!-- Langkah 3 — form dinamis -->
	{#if currentStep === 3 && spec}
		<Card>
			<CardHeader>
				<div class="flex items-start justify-between gap-4">
					<div>
						<CardTitle>3. Form Inspeksi</CardTitle>
						<CardDescription>
							<span class="font-mono">{spec.partNo}</span>
							— {spec.partName} · Line {spec.lineCode} · Stage {spec.stage} · Shift
							{spec.shift}
						</CardDescription>
					</div>
					<div class="shrink-0 text-right">
						<span class="text-sm font-semibold tabular-nums">
							{progress.filled}/{progress.total}
						</span>
						<p class="text-xs text-muted-foreground">item diisi</p>
					</div>
				</div>
				<Progress value={progress.pct} class="mt-3 h-2" />
			</CardHeader>
			<CardContent class="grid gap-6">
				{#if spec.hasPoint}
					<div class="grid gap-3">
						<h3 class="text-sm font-semibold">Points</h3>
						{#each spec.points as point (point.pointNo)}
							<div class="grid gap-2 rounded-lg border p-3">
								<span class="text-sm font-medium">{point.pointNo}</span>
								<div class="grid grid-cols-2 gap-2">
									<Button
										size="lg"
										variant={pointAnswers[point.pointNo]?.status === 'OK' ? 'default' : 'outline'}
										class={pointAnswers[point.pointNo]?.status === 'OK' ? okBtnClass : ''}
										aria-pressed={pointAnswers[point.pointNo]?.status === 'OK'}
										onclick={() => {
											pointAnswers[point.pointNo].status = 'OK';
											markDirty();
										}}
									>
										<CircleCheckIcon class="size-5" aria-hidden="true" />
										OK
									</Button>
									<Button
										size="lg"
										variant={pointAnswers[point.pointNo]?.status === 'NG'
											? 'destructive'
											: 'outline'}
										class={pointAnswers[point.pointNo]?.status === 'NG' ? ngBtnClass : ''}
										aria-pressed={pointAnswers[point.pointNo]?.status === 'NG'}
										onclick={() => {
											pointAnswers[point.pointNo].status = 'NG';
											markDirty();
										}}
									>
										<TriangleAlertIcon class="size-5" aria-hidden="true" />
										NG
									</Button>
								</div>
								{#if pointAnswers[point.pointNo]?.status === 'NG'}
									<div class="grid gap-1.5">
										<Label
											for="point-remark-{point.pointNo}"
											class="flex items-center gap-1.5 text-status-ng"
										>
											<TriangleAlertIcon class="size-4" aria-hidden="true" />
											Remarks wajib diisi
										</Label>
										<Textarea
											id="point-remark-{point.pointNo}"
											placeholder="Jelaskan temuan NG..."
											bind:value={pointAnswers[point.pointNo].remarks}
											aria-invalid={pointAnswers[point.pointNo].remarks.trim() === ''}
											class="border-status-ng/50 bg-status-ng-fill focus-visible:ring-status-ng/40"
										/>
									</div>
								{/if}
							</div>
						{/each}
					</div>
					<Separator />
				{/if}

				{#if spec.hasSpot}
					<div class="grid gap-3">
						<h3 class="text-sm font-semibold">Spot</h3>
						<div class="grid gap-2 rounded-lg border p-3">
							<div class="flex items-center justify-between gap-3">
								<span class="text-sm text-muted-foreground">
									Standard: {spec.spotStandard}
								</span>
								<StatusBadge status={statusFor(spotActual, spec.spotStandard ?? 0, 'exact')} />
							</div>
							<Input
								type="number"
								inputmode="decimal"
								min="0"
								placeholder="Actual"
								class="h-12 tabular-nums"
								aria-label="Nilai aktual spot"
								bind:value={spotActual}
								oninput={markDirty}
							/>
						</div>
					</div>
					<Separator />
				{/if}

				{#if spec.hasHardware}
					<div class="grid gap-3">
						<h3 class="text-sm font-semibold">Hardwares</h3>
						{#each hardwareGroups as hw (hw.id)}
							{#each hw.checks as checkNo (checkNo)}
								{@const answer = hardwareAnswers[hwKey(hw.id, checkNo)]}
								{@const status = statusFor(answer?.actualValue ?? '', hw.standardValue)}
								<div class="grid gap-2 rounded-lg border p-3">
									<div class="flex flex-wrap items-center gap-2">
										<span class="font-mono text-sm font-medium">
											{hw.hwNo} ({hw.hwName}) {checkTypeLabel(hw.checkType)} #{checkNo}
										</span>
										<StatusBadge {status} class="ml-auto shrink-0" />
									</div>
									<span class="text-sm text-muted-foreground">
										Standard: <span class="tabular-nums">{hw.standardValue}</span>
										{hw.unit}
									</span>
									<Input
										type="number"
										inputmode="decimal"
										min="0"
										placeholder={`Actual (${hw.unit})`}
										class="h-12 tabular-nums"
										aria-label={`Nilai aktual hardware ${hw.hwNo} titik ${checkNo}`}
										bind:value={hardwareAnswers[hwKey(hw.id, checkNo)].actualValue}
										oninput={markDirty}
									/>
									{#if status === 'NG'}
										<div class="grid gap-1.5">
											<Label
												for="hw-remark-{hw.id}-{checkNo}"
												class="flex items-center gap-1.5 text-status-ng"
											>
												<TriangleAlertIcon class="size-4" aria-hidden="true" />
												Remarks wajib diisi
											</Label>
											<Textarea
												id="hw-remark-{hw.id}-{checkNo}"
												placeholder="Jelaskan temuan NG..."
												bind:value={hardwareAnswers[hwKey(hw.id, checkNo)].remarks}
												aria-invalid={hardwareAnswers[hwKey(hw.id, checkNo)].remarks.trim() === ''}
												class="border-status-ng/50 bg-status-ng-fill focus-visible:ring-status-ng/40"
											/>
										</div>
									{/if}
								</div>
							{/each}
						{/each}
					</div>
					<Separator />
				{/if}

				{#if spec.hasLength}
					<div class="grid gap-3">
						<h3 class="text-sm font-semibold">Lengths</h3>
						{#each spec.lengths as length (length.lengthNo)}
							{@const status = statusFor(
								lengthAnswers[length.lengthNo]?.actualMm ?? '',
								length.standardMm,
								'min'
							)}
							<div class="grid gap-2 rounded-lg border p-3">
								<div class="flex flex-wrap items-center gap-2">
									<span class="font-mono text-sm font-medium">{length.lengthNo}</span>
									<StatusBadge {status} class="ml-auto shrink-0" />
								</div>
								<span class="text-sm text-muted-foreground">
									Standard: <span class="tabular-nums">{length.standardMm}</span> mm
								</span>
								<Input
									type="number"
									inputmode="decimal"
									min="0"
									placeholder="Actual (mm)"
									class="h-12 tabular-nums"
									aria-label={`Nilai aktual panjang ${length.lengthNo}`}
									bind:value={lengthAnswers[length.lengthNo].actualMm}
									oninput={markDirty}
								/>
								{#if status === 'NG'}
									<div class="grid gap-1.5">
										<Label
											for="len-remark-{length.lengthNo}"
											class="flex items-center gap-1.5 text-status-ng"
										>
											<TriangleAlertIcon class="size-4" aria-hidden="true" />
											Remarks wajib diisi
										</Label>
										<Textarea
											id="len-remark-{length.lengthNo}"
											placeholder="Jelaskan temuan NG..."
											bind:value={lengthAnswers[length.lengthNo].remarks}
											aria-invalid={lengthAnswers[length.lengthNo].remarks.trim() === ''}
											class="border-status-ng/50 bg-status-ng-fill focus-visible:ring-status-ng/40"
										/>
									</div>
								{/if}
							</div>
						{/each}
					</div>
					<Separator />
				{/if}

				{#if spec.hasVisual}
					<div class="grid gap-3">
						<h3 class="text-sm font-semibold">Visual</h3>
						<div class="grid gap-2 rounded-lg border p-3">
							<div class="grid grid-cols-2 gap-2">
								<Button
									size="lg"
									variant={visualStatus === 'OK' ? 'default' : 'outline'}
									class={visualStatus === 'OK' ? okBtnClass : ''}
									aria-pressed={visualStatus === 'OK'}
									onclick={() => {
										visualStatus = 'OK';
										markDirty();
									}}
								>
									<CircleCheckIcon class="size-5" aria-hidden="true" />
									OK
								</Button>
								<Button
									size="lg"
									variant={visualStatus === 'NG' ? 'destructive' : 'outline'}
									class={visualStatus === 'NG' ? ngBtnClass : ''}
									aria-pressed={visualStatus === 'NG'}
									onclick={() => {
										visualStatus = 'NG';
										markDirty();
									}}
								>
									<TriangleAlertIcon class="size-5" aria-hidden="true" />
									NG
								</Button>
							</div>
							{#if visualStatus === 'NG'}
								<div class="grid gap-1.5">
									<Label for="visual-remark" class="flex items-center gap-1.5 text-status-ng">
										<TriangleAlertIcon class="size-4" aria-hidden="true" />
										Remarks wajib diisi
									</Label>
									<Textarea
										id="visual-remark"
										placeholder="Jelaskan temuan NG..."
										bind:value={visualRemarks}
										aria-invalid={visualRemarks.trim() === ''}
										class="border-status-ng/50 bg-status-ng-fill focus-visible:ring-status-ng/40"
									/>
								</div>
							{/if}
						</div>
					</div>
				{/if}

				<div class="h-24"></div>
			</CardContent>
		</Card>
	{/if}
</div>

<!-- Footer lengket — hanya saat langkah 3 (form aktif) -->
{#if currentStep === 3 && spec}
	<div
		class="fixed inset-x-0 bottom-0 z-10 border-t bg-background/95 px-4 py-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80"
	>
		<div class="mx-auto max-w-2xl">
			<div class="mb-2 flex items-center justify-between gap-3">
				<div class="flex items-center gap-2 text-sm">
					<span class="font-medium text-foreground tabular-nums"
						>{progress.filled}/{progress.total}</span
					>
					<span class="text-muted-foreground">item diisi</span>
				</div>
				<span
					class={progress.pct === 100
						? 'text-xs font-semibold text-status-ok tabular-nums'
						: 'text-xs text-muted-foreground tabular-nums'}
				>
					{progress.pct}%
				</span>
			</div>
			<Progress
				value={progress.pct}
				class={progress.pct === 100 ? 'h-1.5 [&>div]:bg-status-ok' : 'h-1.5'}
			/>
			<div class="mt-3 flex gap-2">
				<Button
					variant="outline"
					class="flex-1"
					onclick={() => {
						resetFlow();
						goto(resolve('/dashboard'));
					}}
				>
					Batal
				</Button>
				<Button class="flex-[2]" disabled={submitting} onclick={() => submit()}>
					{submitting
						? 'Menyimpan...'
						: progress.pct === 100
							? '✓ Submit Inspeksi'
							: `Submit (${progress.filled}/${progress.total})`}
				</Button>
			</div>
		</div>
	</div>
{/if}

<Dialog.Root bind:open={recheckDialogOpen}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Konfirmasi Re-check</Dialog.Title>
			<Dialog.Description>
				Inspection untuk Stage ini sudah OK. Apakah anda yakin ingin melakukan re-check?
			</Dialog.Description>
		</Dialog.Header>
		{#if spec?.lastInspection}
			<p class="text-sm text-muted-foreground">
				Terakhir diinspeksi oleh {spec.lastInspection.operatorName} — hasil
				{spec.lastInspection.overallStatus}.
			</p>
		{/if}
		<Dialog.Footer>
			<Button variant="outline" onclick={cancelRecheck}>Batal</Button>
			<Button onclick={confirmRecheck}>Ya, Re-check</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={navDialogOpen}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Buang Draft Inspeksi?</Dialog.Title>
			<Dialog.Description>
				Ada data inspeksi yang belum disimpan. Jika Anda meninggalkan halaman ini, draft akan
				dihapus.
			</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer>
			<Button variant="outline" onclick={() => (navDialogOpen = false)}>Tetap di Sini</Button>
			<Button variant="destructive" onclick={confirmDiscardDraft}>Buang Draft &amp; Lanjut</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
