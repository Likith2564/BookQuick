import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AddWatcherForm } from "./AddWatcherForm";
import { deleteWatcher, signOut } from "./actions";

const STATUS_LABEL: Record<string, string> = {
  coming_soon: "Watching",
  available: "Booking open",
  unknown: "Unknown",
};

const STATUS_STYLE: Record<string, string> = {
  coming_soon: "bg-neutral-100 text-neutral-700",
  available: "bg-green-100 text-green-800",
  unknown: "bg-yellow-100 text-yellow-800",
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: watchers } = await supabase
    .from("watchers")
    .select("id, movie, url, mode, status, last_checked_at")
    .order("created_at", { ascending: false });

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">BookQuick</h1>
          <p className="text-sm text-neutral-500">{user.email}</p>
        </div>
        <form action={signOut}>
          <button className="text-sm text-neutral-500 underline">
            Sign out
          </button>
        </form>
      </div>

      <h2 className="mb-3 text-sm font-medium text-neutral-600">
        Your watches
      </h2>
      <ul className="mb-8 flex flex-col gap-2">
        {watchers?.length ? (
          watchers.map((w) => (
            <li
              key={w.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 p-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{w.movie}</p>
                <a
                  href={w.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block truncate text-xs text-neutral-400 underline"
                >
                  {w.url}
                </a>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span
                  className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS_STYLE[w.status] ?? STATUS_STYLE.unknown}`}
                >
                  {STATUS_LABEL[w.status] ?? w.status}
                </span>
                <form action={deleteWatcher}>
                  <input type="hidden" name="id" value={w.id} />
                  <button
                    type="submit"
                    className="text-xs text-neutral-400 hover:text-red-600"
                  >
                    Remove
                  </button>
                </form>
              </div>
            </li>
          ))
        ) : (
          <li className="rounded-lg border border-dashed border-neutral-300 p-4 text-sm text-neutral-500">
            No watches yet — add one below.
          </li>
        )}
      </ul>

      <h2 className="mb-3 text-sm font-medium text-neutral-600">
        Add a watch
      </h2>
      <AddWatcherForm />
    </main>
  );
}
