export async function register() {
  const { runMigrations } = await import('@/lib/migrate');
  await runMigrations();
}
