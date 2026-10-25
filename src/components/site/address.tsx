export function Address({ lines, className }: { lines: readonly string[]; className?: string }) {
  return (
    <address className={className ?? "not-italic"}>
      {lines.map((line) => (
        <span key={line} className="block">
          {line}
        </span>
      ))}
    </address>
  );
}
