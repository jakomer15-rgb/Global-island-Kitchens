/**
 * Renders a post's plain text safely (no HTML from the database): blank lines separate
 * paragraphs, "## " starts a heading, and lines starting with "- " form a list.
 */
export function BlogBody({ text }: { text: string }) {
  const blocks = text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);

  return (
    <div className="space-y-6 text-lg leading-relaxed">
      {blocks.map((block, i) => {
        if (block.startsWith("## "))
          return (
            <h2 key={i} className="pt-4 font-display text-display-md">
              {block.slice(3)}
            </h2>
          );
        const lines = block.split("\n");
        if (lines.every((l) => l.startsWith("- ")))
          return (
            <ul key={i} className="list-disc space-y-2 ps-6">
              {lines.map((l, j) => (
                <li key={j}>{l.slice(2)}</li>
              ))}
            </ul>
          );
        return (
          <p key={i} className="whitespace-pre-line">
            {block}
          </p>
        );
      })}
    </div>
  );
}
