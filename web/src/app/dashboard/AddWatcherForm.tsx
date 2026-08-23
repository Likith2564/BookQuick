"use client";

import { useRef, useState } from "react";
import { addWatcher } from "./actions";

export function AddWatcherForm() {
  const [mode, setMode] = useState<"showtime_regex" | "marker">(
    "showtime_regex",
  );
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        await addWatcher(formData);
        formRef.current?.reset();
        setMode("showtime_regex");
      }}
      className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5"
    >
      <div>
        <label className="mb-1.5 block text-xs font-medium tracking-wide text-muted uppercase">
          Movie
        </label>
        <input
          name="movie"
          required
          placeholder="Toxic: A Fairy Tale for Grown-ups (Bengaluru, Hindi)"
          className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm text-text outline-none placeholder:text-muted focus:border-accent"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium tracking-wide text-muted uppercase">
          BookMyShow URL
        </label>
        <input
          name="url"
          required
          placeholder="https://in.bookmyshow.com/movies/.../buytickets/..."
          className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm text-text outline-none placeholder:text-muted focus:border-accent"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium tracking-wide text-muted uppercase">
          Detection mode
        </label>
        <input type="hidden" name="mode" value={mode} />
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setMode("showtime_regex")}
            className={`rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
              mode === "showtime_regex"
                ? "border-accent bg-accent/10 text-text"
                : "border-border bg-surface-2 text-muted hover:text-text"
            }`}
          >
            Showtime detection
            <span className="block text-xs opacity-70">
              recommended · BookMyShow
            </span>
          </button>
          <button
            type="button"
            onClick={() => setMode("marker")}
            className={`rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
              mode === "marker"
                ? "border-accent bg-accent/10 text-text"
                : "border-border bg-surface-2 text-muted hover:text-text"
            }`}
          >
            Text marker
            <span className="block text-xs opacity-70">other platforms</span>
          </button>
        </div>
      </div>

      {mode === "marker" && (
        <>
          <div>
            <label className="mb-1.5 block text-xs font-medium tracking-wide text-muted uppercase">
              Open marker text
            </label>
            <input
              name="open_marker"
              placeholder="Book tickets"
              className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm text-text outline-none placeholder:text-muted focus:border-accent"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium tracking-wide text-muted uppercase">
              Closed marker text (optional)
            </label>
            <input
              name="closed_marker"
              placeholder="Coming Soon"
              className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm text-text outline-none placeholder:text-muted focus:border-accent"
            />
          </div>
        </>
      )}

      <button
        type="submit"
        className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink transition-opacity hover:opacity-90"
      >
        Add watch
      </button>
    </form>
  );
}
