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
    .select("id, name, release_date, buytickets_url")
    .eq("city", city)
    .order("release_date", { ascending: true });

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Discover</h1>
          <p className="text-sm text-neutral-500">
            Upcoming releases that haven&apos;t opened booking yet — one
            click to watch.
          </p>
        </div>
        <Link href="/dashboard" className="text-sm text-neutral-500 underline">
          Back to watches
        </Link>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {CITIES.map((c) => (
          <Link
            key={c.slug}
            href={`/discover?city=${c.slug}`}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              c.slug === city
                ? "bg-neutral-900 text-white"
                : "bg-neutral-100 text-neutral-600"
            }`}
          >
            {c.label}
          </Link>
        ))}
      </div>

      <ul className="flex flex-col gap-2">
        {movies?.length ? (
          movies.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 p-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{m.name}</p>
                {m.release_date && (
                  <p className="text-xs text-neutral-400">
                    Releasing{" "}
                    {new Date(m.release_date).toLocaleDateString(undefined, {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                )}
              </div>
              <form action={addFromDiscovery}>
                <input type="hidden" name="name" value={m.name} />
                <input type="hidden" name="city" value={city} />
                <input type="hidden" name="url" value={m.buytickets_url} />
                <button
                  type="submit"
                  className="shrink-0 rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white"
                >
                  Add alert
                </button>
              </form>
            </li>
          ))
        ) : (
          <li className="rounded-lg border border-dashed border-neutral-300 p-4 text-sm text-neutral-500">
            No upcoming movies loaded for this city yet — discover.py
            refreshes this list daily.
          </li>
        )}
      </ul>
    </main>
  );
}
