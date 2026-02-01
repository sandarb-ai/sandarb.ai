export default function Loading() {
  return (
    <div className="flex flex-1 flex-col min-h-0 bg-background">
      <div className="flex items-center justify-between border-b bg-background px-6 py-4">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
      </div>
      <div className="flex-1 p-6 flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    </div>
  );
}
