export default function TodayPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-semibold mb-1">Good morning</h1>
      <p className="text-muted-foreground text-sm mb-8">
        Here&apos;s your job search snapshot for today.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Active Applications", value: "—" },
          { label: "New Matches", value: "—" },
          { label: "Response Rate", value: "—" },
          { label: "Interviews", value: "—" },
        ].map((stat) => (
          <div key={stat.label} className="bg-card rounded-xl p-4 border border-border">
            <p className="text-muted-foreground text-xs mb-1">{stat.label}</p>
            <p className="text-2xl font-semibold">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-card rounded-xl border border-border p-6">
        <h2 className="text-sm font-medium text-muted-foreground mb-4">Today&apos;s Top Matches</h2>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-muted-foreground text-sm">
            No job matches yet. Go to Discover and scan for jobs to get started.
          </p>
        </div>
      </div>
    </div>
  );
}
