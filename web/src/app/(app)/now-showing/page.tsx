import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveCity } from "@/lib/cities";
import { CityTabs } from "@/components/CityTabs";
import { MovieTile } from "@/components/MovieTile";

export default async function NowShowingPage({
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
    .from("now_showing_movies")
    .select("id, name, slug, et_code, poster_url, rating, rating_label")
    .eq("city", city)
    .order("rating", { ascending: false, nullsFirst: false });

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-8">
      <div className="mb-6">
        <h1 className="font-display text-4xl tracking-wide text-accent">
          NOW SHOWING
        </h1>
        <p className="text-sm text-muted">
          Playing right now, sorted by audience rating where BookMyShow has
          one. The theatre finder (pick a cinema by format, budget, and view)
          is coming soon — for now, jump straight to BookMyShow.
        </p>
      </div>

      <CityTabs basePath="/now-showing" activeCity={city} />

      {movies?.length ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {movies.map((m) => (
            <MovieTile
              key={m.id}
              title={m.name}
              posterUrl={m.poster_url}
              badge={m.rating ? `★ ${m.rating}` : undefined}
              subtitle={m.rating_label || (m.rating ? undefined : "Not yet rated")}
              actions={
                <a
                  href={`https://in.bookmyshow.com/${city}/movies/${m.slug}/${m.et_code}`}
                  target="_blank"
                  rel="noreferrer"
                  className="block w-full rounded-lg bg-accent py-1.5 text-center text-xs font-semibold text-accent-ink transition-opacity hover:opacity-90"
                >
                  View on BookMyShow
                </a>
              }
            />
          ))}
        </div>
      ) : (
        <p className="glass rounded-xl p-4 text-sm text-muted">
          No now-showing movies loaded for this city yet — nowshowing.py
          refreshes this list daily.
        </p>
      )}
    </main>
  );
}
