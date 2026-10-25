/** Site-wide notice set in Admin → Content → Banner (e.g. holiday hours). Shown only when enabled. */
export function AnnouncementBanner({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <div className="bg-charcoal px-4 py-2 text-center text-sm text-ivory" role="note">
      {text}
    </div>
  );
}
