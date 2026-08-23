import { CITIES } from "@/lib/cities";

export function CityTabs({
  basePath,
  activeCity,
}: {
  basePath: string;
  activeCity: string;
}) {
  return (
    <div className="mb-8 flex flex-wrap gap-2">
      {CITIES.map((c) => (
        <a
          key={c.slug}
          href={`${basePath}?city=${c.slug}`}
          className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
            c.slug === activeCity
              ? "bg-accent text-accent-ink"
              : "glass-input text-muted hover:text-text"
          }`}
        >
          {c.label}
        </a>
      ))}
    </div>
  );
}
