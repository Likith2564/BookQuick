import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AddWatcherForm } from "./AddWatcherForm";
import { deleteWatcher } from "./actions";

const STATUS_LABEL: Record<string, string> = {
  coming_soon: "Watching",
  available: "Booking open",
  unknown: "Unknown",
};

const STATUS_STYLE: Record<string, string> = {
  coming_soon: "bg-neutral-chip text-muted",
  available: "bg-success-bg text-success",
  unknown: "bg-danger/10 text-danger",
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: watchers } = await supabase
    .from("watchers")
    .select(
      "id, movie, url, mode, status, poster_url, cinema_name, format, last_checked_at",
    )
    .order("created_at", { ascending: false });

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-medium tracking-wide text-muted uppercase">
          Your watches
        </h2>
        <Link
          href="/discover"
          className="rounded-full border border-accent/40 px-3 py-1 text-sm font-medium text-accent hover:bg-accent/10"
        >
          Discover upcoming movies →
        </Link>
      </div>

      <ul className="mb-10 flex flex-col gap-2">
        {watchers?.length ? (
          watchers.map((w) => (
            <li
              key={w.id}
              className="glass flex items-center gap-3 rounded-xl p-3"
            >
              {w.poster_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={w.poster_url}
                  alt=""
                  className="h-16 w-11 shrink-0 rounded-md object-cover"
                />
              ) : (
                <div className="flex h-16 w-11 shrink-0 items-center justify-center rounded-md bg-black/20 font-display text-xl text-muted">
                  {w.movie.charAt(0)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-text">
                  {w.movie}
                </p>
                {(w.cinema_name || w.format) && (
                  <p className="truncate text-xs text-accent">
                    {[w.cinema_name, w.format].filter(Boolean).join(" · ")}
                  </p>
                )}
                <a
                  href={w.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block truncate text-xs text-muted underline decoration-glass-border"
                >
                  {w.url}
                </a>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap ${STATUS_STYLE[w.status] ?? STATUS_STYLE.unknown}`}
                >
                  {STATUS_LABEL[w.status] ?? w.status}
                </span>
                <form action={deleteWatcher}>
                  <input type="hidden" name="id" value={w.id} />
                  <button
                    type="submit"
                    className="text-xs text-muted hover:text-danger"
                  >
                    Remove
                  </button>
                </form>
              </div>
            </li>
          ))
        ) : (
          <li className="glass rounded-xl border-dashed p-4 text-sm text-muted">
            No watches yet — add one below, or{" "}
            <Link href="/discover" className="text-accent underline">
              discover upcoming movies
            </Link>
            .
          </li>
        )}
      </ul>

      <h2 className="mb-3 text-xs font-medium tracking-wide text-muted uppercase">
        Add a watch
      </h2>
      <AddWatcherForm />
    </main>
  );
}
