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
			hardwareId: string;
			hwNo: string;
			hwName: string;
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
			for (const h of spec.hardwares) {
				total++;
				if (hardwareAnswers[h.hardwareId]?.actualValue !== '') filled++;
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
				data.hardwares.map((h) => [h.hardwareId, { actualValue: '', remarks: '' }])
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
				? spec.hardwares.map((h) => ({
						hardwareId: h.hardwareId,
						actualValue: Number(hardwareAnswers[h.hardwareId]?.actualValue),
						remarks: hardwareAnswers[h.hardwareId]?.remarks || null
					}))
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
				const answer = hardwareAnswers[hw.hardwareId];
				if (!answer?.actualValue) return `Hardware "${hw.hwNo}" belum diisi.`;
				if (statusFor(answer.actualValue, hw.standardValue) === 'NG' && !answer.remarks.trim()) {
					return `Remarks wajib diisi untuk Hardware "${hw.hwNo}" yang NG.`;
				}
			}
		}
		if (spec.hasLength) {
			for (const length of spec.lengths) {
				const answer = lengthAnswers[length.lengthNo];
				if (!answer?.actualMm) return `Length "${length.lengthNo}" belum diisi.`;
				if (
					statusFor(answer.actualMm, length.standardMm, 'exact') === 'NG' &&
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
						statusFor(
							h.actualValue,
							spec!.hardwares.find((x) => x.hardwareId === h.hardwareId)!.standardValue
						) === 'OK'
				).length ?? 0) +
				(payload.lengths?.filter(
					(l) =>
						statusFor(
							l.actualMm,
							spec!.lengths.find((x) => x.lengthNo === l.lengthNo)!.standardMm,
							'exact'
						) === 'OK'
				).length ?? 0) +
				(spotOk ? 1 : 0) +
				(payload.visualStatus === 'OK' ? 1 : 0);
			const ngCount =
				(payload.points?.filter((p) => p.status === 'NG').length ?? 0) +
				(payload.hardwares?.filter(
					(h) =>
						statusFor(
							h.actualValue,
							spec!.hardwares.find((x) => x.hardwareId === h.hardwareId)!.standardValue
						) === 'NG'
				).length ?? 0) +
				(payload.lengths?.filter(
					(l) =>
						statusFor(
							l.actualMm,
							spec!.lengths.find((x) => x.lengthNo === l.lengthNo)!.standardMm,
							'exact'
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

	const okBtnClass =
		'bg-green-600 text-white hover:bg-green-700 focus-visible:ring-green-500/50 dark:bg-green-600 dark:hover:bg-green-700';
	const ngBtnClass =
		'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500/50 dark:bg-red-600 dark:hover:bg-red-700';

	onDestroy(() => {
		clearDraft();
	});
</script>

<svelte:window on:beforeunload={() => (isDirty ? '' : undefined)} />

<div class="grid gap-4">
	<Card>
		<CardContent class="pt-6">
			<div class="flex items-center justify-between">
				{#each [1, 2, 3] as step (step)}
					<div class="flex items-center gap-2">
						<div
							class="flex size-8 items-center justify-center rounded-full border-2 text-sm font-semibold"
							class:border-primary={currentStep >= step}
							class:bg-primary={currentStep >= step}
							class:text-primary-foreground={currentStep >= step}
							class:border-muted={currentStep < step}
							class:text-muted-foreground={currentStep < step}
						>
							{step}
						</div>
						<span class="text-sm font-medium">
							{step === 1 ? 'Pilih Line' : step === 2 ? 'Scan Part' : 'Isi Form'}
						</span>
					</div>
					{#if step < 3}
						<div
							class="mx-2 h-0.5 flex-1"
							class:bg-primary={currentStep > step}
							class:bg-muted={currentStep <= step}
						></div>
					{/if}
				{/each}
			</div>
		</CardContent>
	</Card>

	<!-- Step 1: pilih line -->
	<Card>
		<CardHeader>
			<CardTitle>1. Pilih Line</CardTitle>
			<CardDescription>Hanya line yang sesuai permission Anda yang ditampilkan.</CardDescription>
		</CardHeader>
		<CardContent>
			{#if loadingLines}
				<div class="flex flex-wrap gap-2">
					{#each [0, 1, 2, 3, 4, 5] as idx (idx)}
						<Skeleton class="h-9 w-32" />
					{/each}
				</div>
			{:else if lines.length === 0}
				<p class="text-sm text-muted-foreground">
					Tidak ada line yang bisa Anda akses. Hubungi admin untuk mendapatkan permission.
				</p>
			{:else}
				<div class="flex flex-wrap gap-2">
					{#each lines as line (line.id)}
						<Button
							variant={selectedLine?.id === line.id ? 'default' : 'outline'}
							onclick={() => selectLine(line)}
						>
							{line.code} — {line.name}
						</Button>
					{/each}
				</div>
			{/if}
		</CardContent>
	</Card>

	<!-- Step 2 & 3: part + stage -->
	{#if selectedLine}
		<Card>
			<CardHeader>
				<CardTitle>2. Scan Part &amp; Pilih Stage</CardTitle>
				<CardDescription class="flex items-center gap-2">
					Line aktif: {selectedLine.code}
					<Badge variant={activeShift === 'DAY' ? 'default' : 'secondary'} class="text-xs">
						Shift {activeShift}
					</Badge>
				</CardDescription>
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
							bind:value={partNo}
							oninput={markDirty}
						/>
					{/if}
				</div>
				<div class="flex flex-wrap gap-2">
					{#each STAGES as option (option)}
						<Button
							variant={stage === option ? 'default' : 'outline'}
							disabled={preparing || !partNo.trim()}
							onclick={() => prepare(option)}
						>
							{option}
						</Button>
					{/each}
				</div>
				{#if preparing}
					<div class="flex items-center gap-2">
						<Skeleton class="h-4 w-32" />
					</div>
				{/if}
			</CardContent>
		</Card>
	{/if}

	<!-- Step 4: form dinamis -->
	{#if spec}
		<Card>
			<CardHeader>
				<div class="flex items-start justify-between gap-4">
					<div>
						<CardTitle>3. Form Inspeksi</CardTitle>
						<CardDescription>
							{spec.partNo} — {spec.partName} · Line {spec.lineCode} · Stage {spec.stage} · Shift
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
										onclick={() => {
											pointAnswers[point.pointNo].status = 'OK';
											markDirty();
										}}
									>
										OK
									</Button>
									<Button
										size="lg"
										variant={pointAnswers[point.pointNo]?.status === 'NG'
											? 'destructive'
											: 'outline'}
										class={pointAnswers[point.pointNo]?.status === 'NG' ? ngBtnClass : ''}
										onclick={() => {
											pointAnswers[point.pointNo].status = 'NG';
											markDirty();
										}}
									>
										NG
									</Button>
								</div>
								{#if pointAnswers[point.pointNo]?.status === 'NG'}
									<Textarea
										placeholder="Remarks wajib diisi..."
										bind:value={pointAnswers[point.pointNo].remarks}
										aria-invalid
										class="bg-red-50 aria-invalid:border-b-destructive dark:bg-red-950/30"
									/>
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
								{#if statusFor(spotActual, spec.spotStandard ?? 0, 'exact')}
									<Badge
										variant={statusFor(spotActual, spec.spotStandard ?? 0, 'exact') === 'OK'
											? 'default'
											: 'destructive'}
									>
										{statusFor(spotActual, spec.spotStandard ?? 0, 'exact')}
									</Badge>
								{/if}
							</div>
							<Input
								type="number"
								min="0"
								placeholder="Actual"
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
						{#each spec.hardwares as hw (hw.hardwareId)}
							{@const status = statusFor(
								hardwareAnswers[hw.hardwareId]?.actualValue ?? '',
								hw.standardValue
							)}
							<div class="grid gap-2 rounded-lg border p-3">
								<div class="flex items-center justify-between gap-3">
									<span class="text-sm font-medium">{hw.hwNo} — {hw.hwName}</span>
									{#if status}
										<Badge variant={status === 'OK' ? 'default' : 'destructive'}>{status}</Badge>
									{/if}
								</div>
								<span class="text-sm text-muted-foreground">
									Standard: {hw.standardValue}
									{hw.unit}
								</span>
								<Input
									type="number"
									min="0"
									placeholder={`Actual (${hw.unit})`}
									bind:value={hardwareAnswers[hw.hardwareId].actualValue}
									oninput={markDirty}
								/>
								{#if status === 'NG'}
									<Textarea
										placeholder="Remarks wajib diisi..."
										bind:value={hardwareAnswers[hw.hardwareId].remarks}
										aria-invalid
										class="bg-red-50 aria-invalid:border-b-destructive dark:bg-red-950/30"
									/>
								{/if}
							</div>
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
								'exact'
							)}
							<div class="grid gap-2 rounded-lg border p-3">
								<div class="flex items-center justify-between gap-3">
									<span class="text-sm font-medium">{length.lengthNo}</span>
									{#if status}
										<Badge variant={status === 'OK' ? 'default' : 'destructive'}>{status}</Badge>
									{/if}
								</div>
								<span class="text-sm text-muted-foreground">
									Standard: {length.standardMm} mm
								</span>
								<Input
									type="number"
									min="0"
									placeholder="Actual (mm)"
									bind:value={lengthAnswers[length.lengthNo].actualMm}
									oninput={markDirty}
								/>
								{#if status === 'NG'}
									<Textarea
										placeholder="Remarks wajib diisi..."
										bind:value={lengthAnswers[length.lengthNo].remarks}
										aria-invalid
										class="bg-red-50 aria-invalid:border-b-destructive dark:bg-red-950/30"
									/>
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
									onclick={() => {
										visualStatus = 'OK';
										markDirty();
									}}
								>
									OK
								</Button>
								<Button
									size="lg"
									variant={visualStatus === 'NG' ? 'destructive' : 'outline'}
									class={visualStatus === 'NG' ? ngBtnClass : ''}
									onclick={() => {
										visualStatus = 'NG';
										markDirty();
									}}
								>
									NG
								</Button>
							</div>
							{#if visualStatus === 'NG'}
								<Textarea
									placeholder="Remarks wajib diisi..."
									bind:value={visualRemarks}
									aria-invalid
									class="bg-red-50 aria-invalid:border-b-destructive dark:bg-red-950/30"
								/>
							{/if}
						</div>
					</div>
				{/if}

				<div class="h-24"></div>
			</CardContent>
		</Card>
	{/if}
</div>

<!-- Sticky submit footer — muncul hanya saat form aktif -->
{#if spec}
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
						? 'text-xs font-semibold text-green-600'
						: 'text-xs text-muted-foreground'}
				>
					{progress.pct}%
				</span>
			</div>
			<Progress
				value={progress.pct}
				class={progress.pct === 100 ? 'h-1.5 [&>div]:bg-green-500' : 'h-1.5'}
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
