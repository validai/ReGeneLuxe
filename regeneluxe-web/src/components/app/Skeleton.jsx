export default function Skeleton({ className = "", lines = 0, height = "h-4" }) {
  if (lines > 0) {
    return (
      <div className={`space-y-2 ${className}`}>
        {Array.from({ length: lines }, (_, index) => (
          <div
            key={index}
            className={`animate-pulse rounded-md bg-rl_surfaceSoft ${height} ${index === lines - 1 ? "w-2/3" : "w-full"}`}
          />
        ))}
      </div>
    );
  }

  return <div className={`animate-pulse rounded-md bg-rl_surfaceSoft ${height} ${className}`} />;
}
