<script lang="ts">
	const { data } = $props();
	const user = $derived(() => data?.user ?? null);
	const lines = $derived(() => data?.lines ?? []);
	const inspections = $derived(() => data?.inspections ?? []);
	const today = new Date().toLocaleDateString('id-ID');
</script>

<div class="space-y-4">
	<header class="flex items-center justify-between">
		<h1 class="text-2xl font-semibold">Dashboard</h1>
		<div class="text-sm text-muted-foreground">Halo, {user?.name ?? user?.nik ?? 'Operator'}</div>
	</header>

	<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
		<div class="p-4 rounded-xl bg-muted">
			<div class="text-sm text-muted-foreground">Accessible Lines</div>
			<div class="text-2xl font-bold">{lines.length}</div>
		</div>
		<div class="p-4 rounded-xl bg-muted">
			<div class="text-sm text-muted-foreground">Recent Inspections</div>
			<div class="text-2xl font-bold">{inspections.length}</div>
		</div>
		<div class="p-4 rounded-xl bg-muted">
			<div class="text-sm text-muted-foreground">Today</div>
			<div class="text-2xl font-bold">{today}</div>
		</div>
	</div>

	<section class="grid md:grid-cols-2 gap-4">
		<div>
			<h2 class="text-lg font-medium mb-2">Accessible Lines</h2>
			<div class="space-y-2">
				{#if lines.length === 0}
					<div class="text-sm text-muted-foreground">No accessible lines found.</div>
				{:else}
					{#each lines as line}
						<div class="p-3 rounded-md bg-background/50 flex justify-between items-center">
							<div>
								<div class="font-medium">{line.code} — {line.name}</div>
								<div class="text-sm text-muted-foreground">{line.processName ?? ''}</div>
							</div>
						</div>
					{/each}
				{/if}
			</div>
		</div>

		<div>
			<h2 class="text-lg font-medium mb-2">Recent Inspections</h2>
			<div class="space-y-2">
				{#if inspections.length === 0}
					<div class="text-sm text-muted-foreground">No recent inspections.</div>
				{:else}
					{#each inspections as ins}
						<div class="p-3 rounded-md bg-background/50">
							<div class="flex justify-between">
								<div>
									<div class="font-medium">{ins.part_no} — {ins.line_code}</div>
									<div class="text-sm text-muted-foreground">{ins.stage} · {ins.overall_status}</div>
								</div>
								<div class="text-sm text-muted-foreground">{new Date(ins.inspected_at).toLocaleTimeString('id-ID')}</div>
							</div>
						</div>
					{/each}
				{/if}
			</div>
		</div>
	</section>
</div>
