export default function PageShell({
  children,
  width = "workspace",
  className = "",
  dense = false,
}) {
  const widthClass = width === "narrow"
    ? "max-w-3xl"
    : width === "composer"
      ? "max-w-composer"
      : "max-w-workspace";

  return (
    <div className={`mx-auto w-full ${widthClass} rl-fade-in ${dense ? "space-y-5 px-4 py-6 sm:px-6" : "space-y-7 px-4 py-8 sm:px-6"} ${className}`}>
      {children}
    </div>
  );
}
