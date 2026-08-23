import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveCity } from "@/lib/cities";
import { addWatcherFor } from "./actions";

const SORTS = [
  { value: "rank", label: "Recommended" },
  { value: "price", label: "Price: low to high" },
] as const;

export default async function TheatreFinderPage({
  params,
  searchParams,
}: {
  params: Promise<{ etCode: string }>;
  searchParams: Promise<{
    city?: string;
    format?: string;
    budget?: string;
    tier?: string;
    sort?: string;
  }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { etCode } = await params;
  const sp = await searchParams;
  const city = resolveCity(sp.city);
  const format = sp.format || "";
  const budget = sp.budget ? Number(sp.budget) : null;
  const tier = sp.tier === "premium" || sp.tier === "standard" ? sp.tier : "";
  const sort = sp.sort === "price" ? "price" : "rank";

  const { data: movie } = await supabase
    .from("now_showing_movies")
    .select("name, slug, poster_url, rating")
    .eq("et_code", etCode)
    .eq("city", city)
    .maybeSingle();

  let query = supabase
    .from("venue_snapshots")
    .select("id, venue_name, redirection_url, formats, seat_tier, min_price, rank")
    .eq("movie_et_code", etCode)
    .eq("city", city)
    .order(sort === "price" ? "min_price" : "rank", {
      ascending: true,
      nullsFirst: false,
    });

  if (format) query = query.contains("formats", [format]);
  if (tier) query = query.eq("seat_tier", tier);
  if (budget !== null) query = query.lte("min_price", budget);

  const { data: venues } = await query;

  function filterUrl(overrides: Record<string, string | null>) {
    const p = new URLSearchParams({ city, format, budget: sp.budget ?? "", tier, sort });
    for (const [k, v] of Object.entries(overrides)) {
      if (v === null) p.delete(k);
      else p.set(k, v);
    }
    for (const k of [...p.keys()]) if (!p.get(k)) p.delete(k);
    const qs = p.toString();
    return `/theatres/${etCode}${qs ? `?${qs}` : ""}`;
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-8">
      <div className="mb-6 flex items-start gap-4">
        {movie?.poster_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={movie.poster_url}
            alt=""
            className="h-28 w-20 shrink-0 rounded-lg object-cover"
          />
        )}
        <div className="min-w-0">
          <h1 className="font-display text-3xl tracking-wide text-accent">
            {movie?.name ?? "Theatre Finder"}
          </h1>
          <p className="text-sm text-muted">
            {venues?.length ?? 0} cinema{venues?.length === 1 ? "" : "s"}{" "}
            showing today in {city[0].toUpperCase() + city.slice(1)}
          </p>
        </div>
      </div>

      <div className="glass mb-6 flex flex-wrap items-center gap-2 rounded-xl p-3">
        <span className="text-xs font-medium tracking-wide text-muted uppercase">
          Format
        </span>
        <Link
          href={filterUrl({ format: null })}
          className={`rounded-full px-3 py-1 text-xs font-medium ${!format ? "bg-accent text-accent-ink" : "glass-input text-muted"}`}
        >
          Any
        </Link>
        {["2D", "3D", "IMAX", "4DX", "DOLBY CINEMA 2D"].map((f) => (
          <Link
            key={f}
            href={filterUrl({ format: f })}
            className={`rounded-full px-3 py-1 text-xs font-medium ${format === f ? "bg-accent text-accent-ink" : "glass-input text-muted"}`}
          >
            {f}
          </Link>
        ))}

        <span className="ml-3 text-xs font-medium tracking-wide text-muted uppercase">
          Seats
        </span>
        {[
          { v: "", l: "Any" },
          { v: "standard", l: "Standard" },
          { v: "premium", l: "Premium" },
        ].map((t) => (
          <Link
            key={t.v}
            href={filterUrl({ tier: t.v || null })}
            className={`rounded-full px-3 py-1 text-xs font-medium ${tier === t.v ? "bg-accent text-accent-ink" : "glass-input text-muted"}`}
          >
            {t.l}
          </Link>
        ))}

        <span className="ml-3 text-xs font-medium tracking-wide text-muted uppercase">
          Sort
        </span>
        {SORTS.map((s) => (
          <Link
            key={s.value}
            href={filterUrl({ sort: s.value })}
            className={`rounded-full px-3 py-1 text-xs font-medium ${sort === s.value ? "bg-accent text-accent-ink" : "glass-input text-muted"}`}
          >
            {s.label}
          </Link>
        ))}

        <form className="ml-auto flex items-center gap-2" action={`/theatres/${etCode}`}>
          <input type="hidden" name="city" value={city} />
          <input type="hidden" name="format" value={format} />
          <input type="hidden" name="tier" value={tier} />
          <input type="hidden" name="sort" value={sort} />
          <label className="text-xs text-muted" htmlFor="budget">
            Max ₹
          </label>
          <input
            id="budget"
            name="budget"
            type="number"
            min={0}
            defaultValue={sp.budget ?? ""}
            placeholder="Any"
            className="glass-input w-20 rounded-lg px-2 py-1 text-xs text-text"
          />
        </form>
      </div>

      <ul className="flex flex-col gap-2">
        {venues?.length ? (
          venues.map((v) => (
            <li key={v.id} className="glass flex items-center gap-3 rounded-xl p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-text">
                  {v.venue_name}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  {v.seat_tier === "premium" && (
                    <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-medium text-accent">
                      Premium
                    </span>
                  )}
                  {v.formats.map((f: string) => (
                    <span
                      key={f}
                      className="rounded-full bg-black/20 px-2 py-0.5 text-[11px] text-muted"
                    >
                      {f}
                    </span>
                  ))}
                  {v.min_price != null && (
                    <span className="text-xs text-muted">
                      from ₹{v.min_price}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <a
                  href={v.redirection_url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink transition-opacity hover:opacity-90"
                >
                  Book on BookMyShow
                </a>
                {movie?.slug && (
                  <form action={addWatcherFor}>
                    <input type="hidden" name="etCode" value={etCode} />
                    <input type="hidden" name="city" value={city} />
                    <input type="hidden" name="slug" value={movie.slug} />
                    <input type="hidden" name="movieName" value={movie.name} />
                    <input type="hidden" name="cinemaName" value={v.venue_name} />
                    <input
                      type="hidden"
                      name="format"
                      value={v.formats[0] ?? ""}
                    />
                    <button
                      type="submit"
                      className="text-[11px] text-muted underline hover:text-text"
                    >
                      Watch this cinema
                    </button>
                  </form>
                )}
              </div>
            </li>
          ))
        ) : (
          <li className="glass rounded-xl p-4 text-sm text-muted">
            No cinemas match these filters right now — theatres.py refreshes
            this every 30 minutes.
          </li>
        )}
      </ul>
    </main>
  );
}
