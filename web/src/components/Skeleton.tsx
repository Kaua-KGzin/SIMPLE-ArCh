/** Bloco de skeleton com shimmer (classe .skeleton no index.css). */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton rounded ${className}`} />;
}

/** Placeholder de um card de task enquanto o board carrega. */
export function TaskCardSkeleton() {
  return (
    <div className="rounded-xl border border-line bg-panel p-3">
      <Skeleton className="h-4 w-4/5" />
      <div className="mt-3 flex gap-1.5">
        <Skeleton className="h-4 w-14 rounded-full" />
        <Skeleton className="h-4 w-10 rounded-full" />
      </div>
    </div>
  );
}
