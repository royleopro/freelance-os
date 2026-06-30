export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-8 w-32 bg-[rgba(255,255,255,0.06)] rounded" />
        <div className="h-10 w-32 bg-[rgba(255,255,255,0.06)] rounded" />
      </div>

      <div className="flex gap-3">
        <div className="h-10 w-48 bg-[rgba(255,255,255,0.06)] rounded" />
        <div className="h-10 w-48 bg-[rgba(255,255,255,0.06)] rounded" />
      </div>

      <div className="grid grid-cols-5 gap-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="space-y-3">
            <div className="h-8 bg-[rgba(255,255,255,0.06)] rounded w-20" />
            <div className="space-y-2">
              {[...Array(3)].map((_, j) => (
                <div key={j} className="h-24 bg-[rgba(255,255,255,0.06)] rounded" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
