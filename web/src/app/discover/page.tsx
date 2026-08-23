import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { addFromDiscovery } from "./actions";

const CITIES = [
  { slug: "bengaluru", label: "Bengaluru" },
  { slug: "mumbai", label: "Mumbai" },
  { slug: "delhi-ncr", label: "Delhi-NCR" },
  { slug: "hyderabad", label: "Hyderabad" },
  { slug: "chennai", label: "Chennai" },
  { slug: "pune", label: "Pune" },
  { slug: "kolkata", label: "Kolkata" },
];

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{ city?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { city: rawCity } = await searchParams;
  const city = CITIES.some((c) => c.slug === rawCity) ? rawCity! : "bengaluru";

  const { data: movies } = await supabase
    .from("discovered_movies")
    .select("id, name, release_date, buytickets_url, poster_url")
    .eq("city", city)
    .order("release_date", { ascending: true });

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl tracking-wide text-accent">
            DISCOVER
          </h1>
          <p className="text-sm text-muted">
            Upcoming releases that haven&apos;t opened booking yet — one
            click to watch.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="shrink-0 text-sm text-muted underline hover:text-text"
        >
          Back to watches
        </Link>
      </div>

      <div className="mb-8 flex flex-wrap gap-2">
        {CITIES.map((c) => (
          <Link
            key={c.slug}
            href={`/discover?city=${c.slug}`}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
              c.slug === city
                ? "bg-accent text-accent-ink"
                : "bg-surface-2 text-muted hover:text-text"
            }`}
          >
            {c.label}
          </Link>
        ))}
      </div>

      {movies?.length ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {movies.map((m) => (
            <div
              key={m.id}
              className="group relative overflow-hidden rounded-xl border border-border bg-surface"
            >
              <div className="aspect-2/3 w-full bg-surface-2">
                {m.poster_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={m.poster_url}
                    alt={m.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center font-display text-3xl text-muted">
                    {m.name.charAt(0)}
                  </div>
                )}
              </div>

              <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 bg-gradient-to-t from-black/95 via-black/70 to-transparent p-3 pt-8">
                <div>
                  <p className="line-clamp-2 text-sm leading-tight font-semibold text-white">
                    {m.name}
                  </p>
                  {m.release_date && (
                    <p className="mt-0.5 text-xs text-white/60">
                      {new Date(m.release_date).toLocaleDateString(undefined, {
                        day: "numeric",
                        month: "short",
                      })}
                    </p>
                  )}
                </div>
                <form action={addFromDiscovery}>
                  <input type="hidden" name="name" value={m.name} />
                  <input type="hidden" name="city" value={city} />
                  <input type="hidden" name="url" value={m.buytickets_url} />
                  <input
                    type="hidden"
                    name="posterUrl"
                    value={m.poster_url ?? ""}
                  />
                  <button
                    type="submit"
                    className="w-full rounded-lg bg-accent py-1.5 text-xs font-semibold text-accent-ink transition-opacity hover:opacity-90"
                  >
                    Add alert
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted">
          No upcoming movies loaded for this city yet — discover.py refreshes
          this list daily.
        </p>
      )}
    </main>
  );
}
