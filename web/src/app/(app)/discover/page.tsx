import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveCity } from "@/lib/cities";
import { CityTabs } from "@/components/CityTabs";
import { MovieTile } from "@/components/MovieTile";
import { addFromDiscovery } from "./actions";

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
  const city = resolveCity(rawCity);

  const { data: movies } = await supabase
    .from("discovered_movies")
    .select("id, name, release_date, buytickets_url, poster_url")
    .eq("city", city)
    .order("release_date", { ascending: true });

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-8">
      <div className="mb-6">
        <h1 className="font-display text-4xl tracking-wide text-accent">
          DISCOVER
        </h1>
        <p className="text-sm text-muted">
          Upcoming releases that haven&apos;t opened booking yet — one click
          to watch.
        </p>
      </div>

      <CityTabs basePath="/discover" activeCity={city} />

      {movies?.length ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {movies.map((m) => (
            <MovieTile
              key={m.id}
              title={m.name}
              posterUrl={m.poster_url}
              subtitle={
                m.release_date
                  ? new Date(m.release_date).toLocaleDateString(undefined, {
                      day: "numeric",
                      month: "short",
                    })
                  : undefined
              }
              actions={
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
              }
            />
          ))}
        </div>
      ) : (
        <p className="glass rounded-xl p-4 text-sm text-muted">
          No upcoming movies loaded for this city yet — discover.py refreshes
          this list daily.
        </p>
      )}
    </main>
  );
}
