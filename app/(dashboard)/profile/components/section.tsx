export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden mb-4">
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-sm font-medium text-foreground/80">{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}
