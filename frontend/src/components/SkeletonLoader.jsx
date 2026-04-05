// frontend/src/components/SkeletonLoader.jsx

// Base pulse skeleton block
export function Skeleton({ className = '' }) {
  return (
    <div className={`animate-pulse bg-gray-200 dark:bg-gray-700 rounded-lg ${className}`} />
  );
}

// Client list skeleton
export function ClientListSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden">
      <div className="bg-gray-50 dark:bg-gray-800 px-6 py-3 flex gap-6">
        {[120, 140, 80, 60, 80].map((w, i) => (
          <Skeleton key={i} className="h-3 rounded" style={{ width: w }} />
        ))}
      </div>
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-6 px-6 py-4 border-t border-gray-50 dark:border-gray-800">
          <Skeleton className="h-4 w-32 rounded" />
          <Skeleton className="h-4 w-40 rounded" />
          <Skeleton className="h-4 w-24 rounded hidden sm:block" />
          <Skeleton className="h-5 w-16 rounded-full" />
          <div className="ml-auto flex gap-2">
            <Skeleton className="h-4 w-10 rounded" />
            <Skeleton className="h-4 w-14 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Dashboard stats skeleton
export function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="bg-gray-50 dark:bg-gray-800/60 rounded-2xl p-5 animate-pulse">
          <Skeleton className="h-7 w-7 rounded-lg mb-3" />
          <Skeleton className="h-8 w-16 rounded mb-2" />
          <Skeleton className="h-3 w-24 rounded" />
        </div>
      ))}
    </div>
  );
}

// Session list skeleton
export function SessionListSkeleton({ rows = 4 }) {
  return (
    <div className="space-y-2">
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-xl animate-pulse">
          <Skeleton className="w-2 h-10 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-36 rounded" />
            <Skeleton className="h-3 w-48 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Card skeleton (generic)
export function CardSkeleton({ lines = 3 }) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 animate-pulse space-y-3">
      <Skeleton className="h-5 w-40 rounded" />
      {[...Array(lines)].map((_, i) => (
        <Skeleton key={i} className={`h-4 rounded`} style={{ width: `${70 + (i % 3) * 10}%` }} />
      ))}
    </div>
  );
}

// Training list skeleton
export function TrainingListSkeleton({ rows = 5 }) {
  return (
    <div className="space-y-2">
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-4 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl animate-pulse">
          <Skeleton className="w-5 h-5 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-48 rounded" />
            <Skeleton className="h-3 w-32 rounded" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full hidden sm:block" />
        </div>
      ))}
    </div>
  );
}

export default Skeleton;
