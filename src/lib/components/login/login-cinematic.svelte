<script lang="ts">
	import { onMount } from 'svelte';
	import LoginForm from '$lib/components/login-form.svelte';
	import GearCanvas from '$lib/components/login/gear-canvas.svelte';

	let { form } = $props();

	const stages = ['START', 'MIDDLE', 'END'];

	// Jam dinding pabrik, selalu WIB walau perangkat disetel zona lain.
	// ASUMSI: shift DAY 07:00-18:59, sisanya NIGHT. Sesuaikan dengan aturan
	// shift yang dipakai server supaya tampilan di sini tidak menyesatkan.
	const DAY_START = 7;
	const DAY_END = 19;

	let now = $state(new Date());

	const parts = $derived.by(() => {
		const fmt = new Intl.DateTimeFormat('id-ID', {
			timeZone: 'Asia/Jakarta',
			hour: '2-digit',
			minute: '2-digit',
			hour12: false
		});
		const [hh, mm] = fmt.format(now).replace('.', ':').split(':');
		const hour = Number(hh);
		return {
			time: `${hh}:${mm}`,
			shift: hour >= DAY_START && hour < DAY_END ? 'DAY' : 'NIGHT'
		};
	});

	const dateLabel = $derived(
		new Intl.DateTimeFormat('id-ID', {
			timeZone: 'Asia/Jakarta',
			weekday: 'long',
			day: 'numeric',
			month: 'long'
		}).format(now)
	);

	onMount(() => {
		const id = setInterval(() => (now = new Date()), 15_000);
		return () => clearInterval(id);
	});
</script>

<!--
	Foto produk = latar di semua ukuran layar. Roda gigi 3D hanya di layar lebar
	(lihat gear-canvas.svelte). Teks selalu diberi warna eksplisit di atas scrim
	berlapis, jadi kontras tidak bergantung pada bagian foto yang kebetulan gelap.
-->
<div class="relative min-h-svh overflow-hidden bg-neutral-950">
	<img
		src="/product.png"
		alt=""
		aria-hidden="true"
		class="pointer-events-none absolute inset-0 size-full object-cover object-center"
	/>

	<div
		aria-hidden="true"
		class="pointer-events-none absolute inset-0"
		style="background:linear-gradient(to bottom, oklch(0.12 0.01 265 / 82%) 0%, transparent 22%, transparent 62%, oklch(0.12 0.01 265 / 90%) 100%)"
	></div>
	<div
		aria-hidden="true"
		class="pointer-events-none absolute inset-0 lg:bg-[linear-gradient(100deg,oklch(0.12_0.01_265/92%)_0%,oklch(0.12_0.01_265/72%)_46%,oklch(0.12_0.01_265/42%)_100%)]"
	></div>
	<div
		aria-hidden="true"
		class="pointer-events-none absolute inset-0"
		style="background:radial-gradient(120% 90% at 50% 45%, transparent 40%, oklch(0.12 0.01 265 / 70%) 100%)"
	></div>

	<GearCanvas />

	<!-- pointer-events-none: canvas di belakang tetap bisa diseret.
	     Kolom kiri & kanan mengaktifkannya lagi untuk teks dan form. -->
	<div
		class="pointer-events-none relative z-10 mx-auto flex min-h-svh w-full max-w-6xl flex-col justify-center gap-10 px-5 py-20 sm:px-8 lg:flex-row lg:items-center lg:gap-16 lg:px-10 lg:py-16"
	>
		<!-- Kiri: identitas + papan status line -->
		<div class="pointer-events-auto max-w-lg lg:flex-1">
			<div class="flex items-center gap-3">
				<span
					class="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white p-1.5"
				>
					<img src="/adw.png" alt="Logo ADW" class="h-full w-full object-contain" />
				</span>
				<p class="text-label leading-tight text-white/75">PT Adyawinsa Stamping Industries</p>
			</div>

			<h1
				class="mt-8 text-4xl font-semibold tracking-tight text-balance text-white sm:text-5xl lg:leading-[1.05]"
			>
				Inspeksi kualitas, langsung di line.
			</h1>

			<p class="mt-4 max-w-md text-body text-white/70">
				Catat pemeriksaan setiap stage lengkap dengan operator, shift, dan hasil OK atau NG.
			</p>

			<!-- Papan line: jam WIB + tiga stage. Satu-satunya elemen yang bergerak. -->
			<div class="mt-9 rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-md sm:p-5">
				<div class="flex items-end justify-between gap-4">
					<div>
						<p class="text-3xl font-semibold tracking-tight text-white tabular-nums">
							{parts.time}
							<span class="ml-1 text-label font-normal text-white/50">WIB</span>
						</p>
						<p class="mt-0.5 text-label text-white/55">{dateLabel}</p>
					</div>
					<p
						class="rounded-md border border-white/15 px-2.5 py-1 text-label font-medium text-white/90"
					>
						Shift {parts.shift}
					</p>
				</div>

				<ol class="relative mt-6 grid grid-cols-3" aria-label="Urutan stage inspeksi">
					<!-- garis penghubung di belakang titik -->
					<span
						aria-hidden="true"
						class="absolute top-[7px] right-[16.67%] left-[16.67%] h-px bg-white/20"
					></span>
					{#each stages as stage, i (stage)}
						<li class="relative flex flex-col items-center gap-2">
							<span
								class="stage-dot size-3.5 rounded-full border-2 border-indigo-300 bg-neutral-900"
								style="--i:{i}"
							></span>
							<span class="text-label font-medium text-white/80">{stage}</span>
						</li>
					{/each}
				</ol>
			</div>
		</div>

		<!-- Kanan: form -->
		<div class="pointer-events-auto w-full lg:w-[25rem] lg:shrink-0">
			<div
				class="dark rounded-xl border border-white/10 bg-neutral-900/85 p-6 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-8"
			>
				<h2 class="text-xl font-semibold tracking-tight text-white">Masuk ke Q-JUN</h2>
				<p class="mt-1 mb-6 text-label text-white/60">
					Gunakan akun operator atau supervisor Anda.
				</p>

				<LoginForm {form} class="w-full" />
			</div>

			<p class="mt-4 hidden text-label text-white/45 lg:block">Seret roda gigi untuk memutar.</p>
		</div>
	</div>
</div>

<style>
	/* Satu momen saja: tiga titik stage menyala berurutan saat halaman dibuka. */
	.stage-dot {
		animation: stage-on 0.5s ease-out both;
		animation-delay: calc(0.35s + var(--i) * 0.28s);
	}

	@keyframes stage-on {
		from {
			background-color: oklch(0.2 0.01 265);
			box-shadow: 0 0 0 0 transparent;
		}
		to {
			background-color: oklch(0.8 0.1 272);
			box-shadow: 0 0 14px 2px oklch(0.72 0.13 272 / 55%);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.stage-dot {
			animation: none;
			background-color: oklch(0.8 0.1 272);
		}
	}
</style>
