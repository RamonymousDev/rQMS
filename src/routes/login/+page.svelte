<script lang="ts">
	import LoginForm from '$lib/components/login-form.svelte';

	let { form } = $props();
</script>

<svelte:head><title>Login · Q-Jun</title></svelte:head>

<div class="relative flex min-h-svh items-center justify-center overflow-hidden">
	<img
		src="/product.png"
		alt="product"
		class="pointer-events-none fixed inset-0 h-full w-full object-cover"
	/>

	<div
		class="pointer-events-none fixed inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent"
	></div>

	<div class="floating-dots pointer-events-none fixed inset-0">
		<div class="dot dot-1"></div>
		<div class="dot dot-2"></div>
		<div class="dot dot-3"></div>
		<div class="dot dot-4"></div>
	</div>

	<div class="login-card relative z-10 w-full max-w-sm px-4">
		<div class="glow-border">
			<div class="glass-card rounded-2xl p-8 shadow-2xl backdrop-blur-xl">
				<div class="flex flex-col items-center gap-6">
					<div class="flex flex-col items-center gap-3">
						<img src="/adw.png" alt="ADW" class="logo-glow size-50 object-contain" />
						<div class="text-center">
							<h1
								class="bg-gradient-to-r from-blue-300 via-white to-blue-300 bg-clip-text text-4xl font-bold tracking-tight text-transparent"
							>
								Q-JUN
							</h1>
							<p class="mt-1 text-sm text-white/60">Quality Management System</p>
						</div>
					</div>

					<LoginForm {form} class="w-full" />
				</div>
			</div>
		</div>

		<p class="mt-6 text-center text-xs text-white/40">PT Adyawinsa Stamping Industries</p>
	</div>
</div>

<style>
	@keyframes fade-in-up {
		from {
			opacity: 0;
			transform: translateY(24px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@keyframes fade-in {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	@keyframes ken-burns {
		from {
			transform: scale(1);
		}
		to {
			transform: scale(1.05);
		}
	}

	@keyframes spin-slow {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}

	@keyframes float-1 {
		0%,
		100% {
			transform: translateY(0px);
		}
		50% {
			transform: translateY(-12px);
		}
	}

	@keyframes float-2 {
		0%,
		100% {
			transform: translateY(0px);
		}
		50% {
			transform: translateY(-8px);
		}
	}

	@keyframes float-3 {
		0%,
		100% {
			transform: translateY(0px);
		}
		50% {
			transform: translateY(-16px);
		}
	}

	.login-card {
		animation: fade-in-up 0.5s ease-out both;
	}

	.glass-card {
		animation: fade-in 0.6s ease-out 0.15s both;
		background: rgba(255, 255, 255, 0.08);
	}

	:global(.dark) .glass-card {
		background: rgba(0, 0, 0, 0.3);
	}

	.glow-border {
		position: relative;
		border-radius: 1rem;
		padding: 1px;
		overflow: hidden;
	}

	.glow-border::before {
		content: '';
		position: absolute;
		inset: -50%;
		background: conic-gradient(
			from 0deg,
			transparent 0%,
			rgba(147, 197, 253, 0.4) 10%,
			transparent 20%,
			transparent 80%,
			rgba(147, 197, 253, 0.4) 90%,
			transparent 100%
		);
		animation: spin-slow 4s linear infinite;
	}

	.glow-border .glass-card {
		position: relative;
		z-index: 1;
		border-radius: calc(1rem - 1px);
	}

	:global(img[src='/product.png']) {
		animation: ken-burns 20s ease-in-out infinite alternate;
	}

	.logo-glow {
		filter: drop-shadow(0 0 12px rgba(96, 165, 250, 0.5));
	}

	.floating-dots .dot {
		position: absolute;
		border-radius: 9999px;
		background: rgba(255, 255, 255, 0.08);
	}

	.dot-1 {
		width: 6px;
		height: 6px;
		top: 20%;
		left: 15%;
		animation: float-1 5s ease-in-out infinite;
	}

	.dot-2 {
		width: 4px;
		height: 4px;
		top: 60%;
		right: 20%;
		animation: float-2 4s ease-in-out 0.5s infinite;
	}

	.dot-3 {
		width: 8px;
		height: 8px;
		bottom: 25%;
		left: 25%;
		animation: float-3 6s ease-in-out 1s infinite;
	}

	.dot-4 {
		width: 5px;
		height: 5px;
		top: 35%;
		right: 12%;
		animation: float-1 4.5s ease-in-out 1.5s infinite;
	}
</style>
