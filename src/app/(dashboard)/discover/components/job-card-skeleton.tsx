export function JobCardSkeleton() {
  return (
    <div className="bg-card border border-border rounded-xl p-4 animate-pulse">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="h-4 bg-muted rounded w-48 mb-2" />
          <div className="h-3 bg-muted rounded w-32" />
        </div>
        <div className="h-6 bg-muted rounded-full w-12" />
      </div>
      <div className="flex gap-2 mt-3">
        <div className="h-3 bg-muted rounded w-24" />
        <div className="h-3 bg-muted rounded w-16" />
      </div>
    </div>
  );
}
