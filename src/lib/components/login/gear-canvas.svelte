<script lang="ts">
	import { onMount } from 'svelte';

	/**
	 * Rangkaian tiga roda gigi 3D untuk halaman login.
	 *
	 * Yang berubah dari versi sebelumnya:
	 *  - Profil gigi melengkung (sisi gigi 5 titik + busur puncak + busur dasar),
	 *    bukan trapesium kasar.
	 *  - Roda berstruktur: pelek, lubang peringan (lightening holes), hub
	 *    menonjol, poros gelap, dan garis aksen indigo tipis.
	 *  - Tiga roda (24 / 14 / 18 gigi) dalam satu rantai. Fase putaran dihitung
	 *    dari rumus, jadi gigi benar-benar masuk ke celah lawannya.
	 *  - Env map studio dengan softbox, tone mapping ACES: logam terbaca di atas
	 *    foto tanpa harus dibantu emissive tebal.
	 *  - Rangkaian diposisikan di sisi kanan, sebagian di balik kartu login yang
	 *    di-blur, sehingga terlihat berlapis.
	 *
	 * Performa (tablet & HP di pabrik):
	 *  - WebGL hanya menyala di layar >= 1024px. Di bawah itu hanya fallback CSS.
	 *  - DPR dibatasi 1.5, loop berhenti saat tab disembunyikan.
	 *  - prefers-reduced-motion: satu bingkai statis, tanpa rAF.
	 *
	 * three.js diimpor dinamis, jadi form login tidak menunggu renderer.
	 */
	let { class: className = '' }: { class?: string } = $props();

	let canvas = $state<HTMLCanvasElement | undefined>(undefined);
	let webglActive = $state(false);

	onMount(() => {
		if (!canvas) return;

		const wide = typeof matchMedia === 'function' && matchMedia('(min-width: 1024px)').matches;
		if (!wide) return;

		let disposed = false;
		let teardown: (() => void) | undefined;

		void (async () => {
			try {
				const THREE = await import('three');
				if (disposed || !canvas) return;
				teardown = setup(THREE, canvas);
				webglActive = true;
			} catch (error) {
				console.warn('[login] WebGL gagal, fallback CSS dipakai:', error);
			}
		})();

		return () => {
			disposed = true;
			teardown?.();
		};
	});

	function setup(THREE: typeof import('three'), element: HTMLCanvasElement) {
		const reduceMotion =
			typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

		const renderer = new THREE.WebGLRenderer({
			canvas: element,
			alpha: true,
			antialias: true,
			powerPreference: 'low-power'
		});
		renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 1.5));
		renderer.toneMapping = THREE.ACESFilmicToneMapping;
		renderer.toneMappingExposure = 1.05;

		const scene = new THREE.Scene();
		const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
		camera.position.set(0, 0, 9);

		// ---------- Environment: ruang studio kecil dengan softbox ----------
		const envCanvas = document.createElement('canvas');
		envCanvas.width = 512;
		envCanvas.height = 256;
		const ctx = envCanvas.getContext('2d')!;
		const sky = ctx.createLinearGradient(0, 0, 0, 256);
		sky.addColorStop(0, '#d5dbff');
		sky.addColorStop(0.32, '#6f7bb8');
		sky.addColorStop(0.5, '#262b47');
		sky.addColorStop(1, '#090c17');
		ctx.fillStyle = sky;
		ctx.fillRect(0, 0, 512, 256);
		// Softbox: tanpa ini logam hanya memantulkan gradient dan terlihat datar.
		ctx.fillStyle = 'rgba(255,255,255,0.95)';
		ctx.fillRect(70, 46, 110, 34);
		ctx.fillRect(330, 34, 140, 28);
		ctx.fillStyle = 'rgba(143,156,245,0.9)';
		ctx.fillRect(220, 104, 70, 80);
		ctx.fillStyle = 'rgba(255,255,255,0.55)';
		ctx.fillRect(10, 120, 40, 90);

		const envTexture = new THREE.CanvasTexture(envCanvas);
		envTexture.mapping = THREE.EquirectangularReflectionMapping;
		envTexture.colorSpace = THREE.SRGBColorSpace;
		const pmrem = new THREE.PMREMGenerator(renderer);
		const envMap = pmrem.fromEquirectangular(envTexture).texture;
		scene.environment = envMap;

		scene.add(new THREE.HemisphereLight(0xdfe5ff, 0x12162a, 0.7));

		const key = new THREE.DirectionalLight(0xffffff, 2.2);
		key.position.set(4, 6, 7);
		scene.add(key);

		const rim = new THREE.DirectionalLight(0x8f9cf5, 3);
		rim.position.set(-6, -2, -4);
		scene.add(rim);

		// ---------- Material ----------
		const steel = new THREE.MeshStandardMaterial({
			color: 0x9aa4c8,
			metalness: 0.85,
			roughness: 0.3,
			envMapIntensity: 1.25,
			emissive: 0x10142a
		});
		const indigo = new THREE.MeshStandardMaterial({
			color: 0x7482ee,
			metalness: 0.75,
			roughness: 0.28,
			envMapIntensity: 1.3,
			emissive: 0x141a4a
		});
		const dark = new THREE.MeshStandardMaterial({
			color: 0x0d1020,
			metalness: 0.9,
			roughness: 0.45
		});
		const accent = new THREE.MeshBasicMaterial({
			color: 0xa5b0ff,
			transparent: true,
			opacity: 0.7,
			toneMapped: false
		});

		// ---------- Pembuat roda gigi ----------
		const MODULE = 0.16; // satu modul untuk semua roda => gigi pasti cocok
		const BEVEL = 0.035;
		const pitchRadius = (teeth: number) => (MODULE * teeth) / 2;

		type GearSpec = {
			teeth: number;
			bore: number;
			holes: number;
			depth: number;
			material: import('three').Material;
		};

		function buildGear({ teeth, bore, holes, depth, material }: GearSpec) {
			const pitch = pitchRadius(teeth);
			const tip = pitch + MODULE;
			const root = pitch - MODULE * 1.25;
			const step = (Math.PI * 2) / teeth;
			const rimInner = root * 0.82;
			const hubR = bore * 2.2;

			// Profil luar
			const shape = new THREE.Shape();
			let started = false;
			const add = (angle: number, radius: number) => {
				const x = Math.cos(angle) * radius;
				const y = Math.sin(angle) * radius;
				if (!started) {
					shape.moveTo(x, y);
					started = true;
				} else shape.lineTo(x, y);
			};

			// Lebar setengah gigi menyempit dari dasar ke puncak.
			const halfWidth = (t: number) => step * (0.31 - 0.16 * Math.pow(t, 1.1));
			const flank = [0, 0.18, 0.4, 0.65, 1];

			for (let i = 0; i < teeth; i++) {
				const c = i * step;
				for (const t of flank) add(c - halfWidth(t), root + (tip - root) * t);
				add(c, tip); // puncak membulat, bukan garis lurus
				for (const t of [...flank].reverse()) add(c + halfWidth(t), root + (tip - root) * t);
				// busur dasar antar gigi
				const a0 = c + halfWidth(0);
				const a1 = c + step - halfWidth(0);
				for (let k = 1; k <= 2; k++) add(a0 + ((a1 - a0) * k) / 3, root);
			}
			shape.closePath();

			// Lubang peringan di antara hub dan pelek
			const rc = (hubR + rimInner) / 2;
			const rh = ((rimInner - hubR) / 2) * 0.78;
			for (let k = 0; k < holes; k++) {
				const a = (k / holes) * Math.PI * 2;
				const cx = Math.cos(a) * rc;
				const cy = Math.sin(a) * rc;
				const hole = new THREE.Path();
				for (let s = 0; s <= 28; s++) {
					const t = (s / 28) * Math.PI * 2;
					const x = cx + Math.cos(t) * rh;
					const y = cy + Math.sin(t) * rh;
					if (s === 0) hole.moveTo(x, y);
					else hole.lineTo(x, y);
				}
				shape.holes.push(hole);
			}

			// Lubang poros
			const boreHole = new THREE.Path();
			for (let s = 0; s <= 32; s++) {
				const t = (s / 32) * Math.PI * 2;
				const x = Math.cos(t) * bore;
				const y = Math.sin(t) * bore;
				if (s === 0) boreHole.moveTo(x, y);
				else boreHole.lineTo(x, y);
			}
			shape.holes.push(boreHole);

			// bevelOffset negatif: siluet di tengah tebal = profil asli,
			// hanya tepi muka yang terpotong miring. Gigi tidak menggemuk.
			const body = new THREE.Mesh(
				new THREE.ExtrudeGeometry(shape, {
					depth,
					bevelEnabled: true,
					bevelThickness: BEVEL,
					bevelSize: BEVEL,
					bevelOffset: -BEVEL,
					bevelSegments: 2,
					curveSegments: 12
				}),
				material
			);
			body.geometry.center();
			const faceZ = depth / 2 + BEVEL;

			// Hub menonjol (cincin dengan lubang poros)
			const bossShape = new THREE.Shape();
			bossShape.absarc(0, 0, hubR * 0.92, 0, Math.PI * 2, false);
			const bossBore = new THREE.Path();
			bossBore.absarc(0, 0, bore, 0, Math.PI * 2, true);
			bossShape.holes.push(bossBore);
			const bossDepth = depth * 1.5;
			const boss = new THREE.Mesh(
				new THREE.ExtrudeGeometry(bossShape, {
					depth: bossDepth,
					bevelEnabled: true,
					bevelThickness: 0.03,
					bevelSize: 0.03,
					bevelOffset: -0.03,
					bevelSegments: 2,
					curveSegments: 32
				}),
				material
			);
			boss.geometry.center();

			// Poros gelap
			const axleGeometry = new THREE.CylinderGeometry(bore * 0.82, bore * 0.82, depth * 2.4, 24);
			axleGeometry.rotateX(Math.PI / 2);
			const axle = new THREE.Mesh(axleGeometry, dark);

			// Garis aksen tipis: satu di pelek, satu di hub
			const rimRing = new THREE.Mesh(
				new THREE.RingGeometry(rimInner * 1.06, rimInner * 1.09, 96),
				accent
			);
			rimRing.position.z = faceZ + 0.004;
			const hubRing = new THREE.Mesh(new THREE.RingGeometry(hubR * 0.66, hubR * 0.72, 64), accent);
			hubRing.position.z = bossDepth / 2 + 0.03 + 0.004;

			const gear = new THREE.Group();
			gear.add(body, boss, axle, rimRing, hubRing);
			return { gear, body, teeth, step };
		}

		const A = buildGear({ teeth: 24, bore: 0.28, holes: 6, depth: 0.36, material: steel });
		const B = buildGear({ teeth: 14, bore: 0.2, holes: 5, depth: 0.36, material: indigo });
		const C = buildGear({ teeth: 18, bore: 0.24, holes: 6, depth: 0.32, material: steel });

		// ---------- Susunan rantai ----------
		const thetaAB = 0.38; // arah dari A ke B (rad)
		const phiBC = 1.2; // arah dari B ke C (rad)
		const rA = pitchRadius(A.teeth);
		const rB = pitchRadius(B.teeth);
		const rC = pitchRadius(C.teeth);

		// Jarak pusat = jumlah jari-jari pitch => gigi saling mengunci.
		B.gear.position.set(Math.cos(thetaAB) * (rA + rB), Math.sin(thetaAB) * (rA + rB), 0);
		C.gear.position.set(
			B.gear.position.x + Math.cos(phiBC) * (rB + rC),
			B.gear.position.y + Math.sin(phiBC) * (rB + rC),
			0
		);

		const train = new THREE.Group();
		train.add(A.gear, B.gear, C.gear);

		// Pusatkan rangkaian pada pivot supaya skala & parallax berputar di tengahnya.
		const bounds = new THREE.Box3().setFromObject(train);
		const center = bounds.getCenter(new THREE.Vector3());
		const size = bounds.getSize(new THREE.Vector3());
		train.position.set(-center.x, -center.y, 0);

		const group = new THREE.Group();
		group.add(train);
		scene.add(group);

		const pickables = [A.body, B.body, C.body];

		/**
		 * Penempatan memakai SATUAN DUNIA dari frustum kamera, bukan piksel.
		 */
		function layout() {
			const width = element.clientWidth || 1;
			const visibleHeight = 2 * Math.tan((camera.fov * Math.PI) / 360) * camera.position.z;
			const visibleWidth = visibleHeight * camera.aspect;

			const byHeight = (visibleHeight * 1.0) / size.y;
			const byWidth = (visibleWidth * 0.5) / size.x;
			group.scale.setScalar(Math.min(byHeight, byWidth));
			group.position.set(visibleWidth * (width < 1280 ? 0.3 : 0.26), 0, 0);
		}

		// ---------- Putaran ----------
		/**
		 * Fase gigi dihitung, bukan ditebak:
		 *  - roda A: gigi ke-0 menghadap B saat ang = 0.
		 *  - roda B: celah (setengah langkah dari gigi) menghadap A saat ang = 0;
		 *    gigi B menghadap C pada sudut phiBC.
		 *  - roda C: celah menghadap B.
		 * Perbandingan sudut mengikuti jumlah gigi.
		 */
		function setAngle(ang: number) {
			const a = thetaAB + ang;
			const b = thetaAB + Math.PI + B.step / 2 - ang * (A.teeth / B.teeth);
			const c = phiBC + Math.PI + C.step / 2 - (b - phiBC) * (B.teeth / C.teeth);
			A.gear.rotation.z = a;
			B.gear.rotation.z = b;
			C.gear.rotation.z = c;
		}

		const clock = new THREE.Clock();
		const pointer = new THREE.Vector2();
		const pointerSmooth = new THREE.Vector2();
		const raycaster = new THREE.Raycaster();
		const ndc = new THREE.Vector2();

		const BASE_SPEED = 0.28;
		let angle = 0;
		let velocity = reduceMotion ? 0 : BASE_SPEED;
		let dragging = false;
		let lastX = 0;

		function hits(event: PointerEvent) {
			const rect = element.getBoundingClientRect();
			ndc.set(
				((event.clientX - rect.left) / rect.width) * 2 - 1,
				-(((event.clientY - rect.top) / rect.height) * 2 - 1)
			);
			raycaster.setFromCamera(ndc, camera);
			return raycaster.intersectObjects(pickables, false).length > 0;
		}

		function onDown(event: PointerEvent) {
			// Hanya mulai menyeret kalau benar-benar mengenai roda.
			if (!hits(event)) return;
			dragging = true;
			lastX = event.clientX;
			element.style.cursor = 'grabbing';
			element.setPointerCapture(event.pointerId);
		}

		function onMove(event: PointerEvent) {
			pointer.set((event.clientX / innerWidth) * 2 - 1, -((event.clientY / innerHeight) * 2 - 1));
			if (dragging) {
				const dx = event.clientX - lastX;
				lastX = event.clientX;
				velocity += dx * 0.012;
				return;
			}
			// Kursor "grab" hanya saat melayang di atas roda (dan bukan di atas kartu).
			element.style.cursor = event.target === element && hits(event) ? 'grab' : 'default';
		}

		function onUp(event: PointerEvent) {
			if (!dragging) return;
			dragging = false;
			element.style.cursor = 'grab';
			if (element.hasPointerCapture(event.pointerId)) {
				element.releasePointerCapture(event.pointerId);
			}
		}

		element.addEventListener('pointerdown', onDown);
		addEventListener('pointermove', onMove, { passive: true });
		addEventListener('pointerup', onUp);
		addEventListener('pointercancel', onUp);

		function resize() {
			const width = element.clientWidth || 1;
			const height = element.clientHeight || 1;
			renderer.setSize(width, height, false);
			camera.aspect = width / height;
			camera.updateProjectionMatrix();
			layout();
		}

		const observer = new ResizeObserver(resize);
		observer.observe(element);
		resize();

		let frame = 0;
		let detachVisibility: (() => void) | undefined;

		function draw() {
			renderer.render(scene, camera);
		}

		function tick() {
			const dt = Math.min(clock.getDelta(), 0.05);

			if (!dragging) velocity += (BASE_SPEED - velocity) * dt * 0.8;
			velocity *= 1 - dt * 1.3;
			angle += velocity * dt;
			setAngle(angle);

			pointerSmooth.lerp(pointer, 0.05);
			group.rotation.y = pointerSmooth.x * 0.18;
			group.rotation.x = -pointerSmooth.y * 0.09;

			draw();
			frame = requestAnimationFrame(tick);
		}

		if (reduceMotion) {
			setAngle(0.35);
			draw();
		} else {
			frame = requestAnimationFrame(tick);
			const onVisibility = () => {
				if (document.hidden) cancelAnimationFrame(frame);
				else {
					clock.getDelta(); // buang selang waktu saat tab tersembunyi
					frame = requestAnimationFrame(tick);
				}
			};
			document.addEventListener('visibilitychange', onVisibility);
			detachVisibility = () => document.removeEventListener('visibilitychange', onVisibility);
		}

		return () => {
			cancelAnimationFrame(frame);
			detachVisibility?.();
			observer.disconnect();
			element.removeEventListener('pointerdown', onDown);
			removeEventListener('pointermove', onMove);
			removeEventListener('pointerup', onUp);
			removeEventListener('pointercancel', onUp);
			scene.traverse((object) => {
				if (object instanceof THREE.Mesh) object.geometry.dispose();
			});
			steel.dispose();
			indigo.dispose();
			dark.dispose();
			accent.dispose();
			envTexture.dispose();
			envMap.dispose();
			pmrem.dispose();
			renderer.dispose();
		};
	}
</script>

<div class="absolute inset-0 {className}" aria-hidden="true">
	<!--
		Fallback untuk HP / tanpa WebGL: cahaya indigo statis dari kanan bawah.
		Biaya nol, tidak ada loop animasi.
	-->
	{#if !webglActive}
		<div
			class="absolute inset-0"
			style="background:radial-gradient(60% 50% at 82% 82%, oklch(0.72 0.13 272 / 18%), transparent 70%)"
		></div>
	{/if}
	<canvas bind:this={canvas} class="size-full"></canvas>
</div>
