<script lang="ts">
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
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

	onMount(async () => {
		try {
			const res = await fetch('/api/inspect/lines');
			if (!res.ok) {
				toast.error('Gagal memuat daftar line.');
				return;
			}
			lines = (await res.json()).data ?? [];
		} finally {
			loadingLines = false;
		}
	});

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
	}

	$effect(() => {
		if (inputMode) resetForm();
	});

	function selectLine(line: Line) {
		selectedLine = line;
		resetFlow();
	}

	function statusFor(actual: string | number, standard: number, exact = false): 'OK' | 'NG' | null {
		if (actual === '' || actual === null || actual === undefined) return null;
		const value = Number(actual);
		if (!Number.isFinite(value)) return null;
		if (exact) {
			return value === standard ? 'OK' : 'NG';
		}
		return value >= standard ? 'OK' : 'NG';
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
					statusFor(answer.actualMm, length.standardMm, true) === 'NG' &&
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
			toast.success(`Inspeksi tersimpan. Overall status: ${body.data.overallStatus}.`);
			partNo = '';
			resetFlow();
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
	}

	const okBtnClass =
		'bg-green-600 text-white hover:bg-green-700 focus-visible:ring-green-500/50 dark:bg-green-600 dark:hover:bg-green-700';
	const ngBtnClass =
		'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500/50 dark:bg-red-600 dark:hover:bg-red-700';
</script>

<div class="grid gap-4">
	<!-- Step 1: pilih line -->
	<Card>
		<CardHeader>
			<CardTitle>1. Pilih Line</CardTitle>
			<CardDescription>Hanya line yang sesuai permission Anda yang ditampilkan.</CardDescription>
		</CardHeader>
		<CardContent>
			{#if loadingLines}
				<p class="text-sm text-muted-foreground">Memuat daftar line...</p>
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
				<CardDescription>Line aktif: {selectedLine.code}</CardDescription>
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
							oninput={resetForm}
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
					<p class="text-sm text-muted-foreground">Menyiapkan form...</p>
				{/if}
			</CardContent>
		</Card>
	{/if}

	<!-- Step 4: form dinamis -->
	{#if spec}
		<Card>
			<CardHeader>
				<CardTitle>3. Form Inspeksi</CardTitle>
				<CardDescription>
					{spec.partNo} — {spec.partName} · Line {spec.lineCode} · Stage {spec.stage} · Shift
					{spec.shift}
				</CardDescription>
			</CardHeader>
			<CardContent class="grid gap-6">
				{#if spec.hasPoint}
					<div class="grid gap-3">
						<h3 class="text-sm font-semibold">Points</h3>
						{#each spec.points as point (point.pointNo)}
							<div class="grid gap-2 rounded-lg border p-3">
								<div class="flex items-center justify-between">
									<span class="text-sm font-medium">{point.pointNo}</span>
									<div class="flex gap-2">
										<Button
											size="sm"
											variant={pointAnswers[point.pointNo]?.status === 'OK' ? 'default' : 'outline'}
											class={pointAnswers[point.pointNo]?.status === 'OK' ? okBtnClass : ''}
											onclick={() => (pointAnswers[point.pointNo].status = 'OK')}
										>
											OK
										</Button>
										<Button
											size="sm"
											variant={pointAnswers[point.pointNo]?.status === 'NG'
												? 'destructive'
												: 'outline'}
											class={pointAnswers[point.pointNo]?.status === 'NG' ? ngBtnClass : ''}
											onclick={() => (pointAnswers[point.pointNo].status = 'NG')}
										>
											NG
										</Button>
									</div>
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
								{#if statusFor(spotActual, spec.spotStandard ?? 0, true)}
									<Badge
										variant={statusFor(spotActual, spec.spotStandard ?? 0, true) === 'OK'
											? 'default'
											: 'destructive'}
									>
										{statusFor(spotActual, spec.spotStandard ?? 0, true)}
									</Badge>
								{/if}
							</div>
							<Input type="number" min="0" placeholder="Actual" bind:value={spotActual} />
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
								true
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
							<div class="flex gap-2">
								<Button
									size="sm"
									variant={visualStatus === 'OK' ? 'default' : 'outline'}
									class={visualStatus === 'OK' ? okBtnClass : ''}
									onclick={() => (visualStatus = 'OK')}
								>
									OK
								</Button>
								<Button
									size="sm"
									variant={visualStatus === 'NG' ? 'destructive' : 'outline'}
									class={visualStatus === 'NG' ? ngBtnClass : ''}
									onclick={() => (visualStatus = 'NG')}
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

				<div class="flex justify-end gap-2">
					<Button variant="outline" onclick={resetFlow}>Batal</Button>
					<Button disabled={submitting} onclick={() => submit()}>
						{submitting ? 'Menyimpan...' : 'Submit Inspeksi'}
					</Button>
				</div>
			</CardContent>
		</Card>
	{/if}
</div>

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
