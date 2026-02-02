export default function Loading() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-8">
      <div className="text-stone-600">Loading…</div>
      <p className="max-w-sm text-center text-xs text-stone-400">
        First load can take a few seconds while the app compiles.
      </p>
    </div>
  );
}
