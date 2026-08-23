"use client";

import { useRef, useState } from "react";
import { addWatcher } from "./actions";

const INPUT_CLASS =
  "glass-input w-full rounded-lg px-3 py-2.5 text-sm text-text placeholder:text-muted";

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
      className="glass flex flex-col gap-4 rounded-xl p-5"
    >
      <div>
        <label className="mb-1.5 block text-xs font-medium tracking-wide text-muted uppercase">
          Movie
        </label>
        <input
          name="movie"
          required
          placeholder="Toxic: A Fairy Tale for Grown-ups (Bengaluru, Hindi)"
          className={INPUT_CLASS}
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
          className={INPUT_CLASS}
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
                : "glass-input text-muted hover:text-text"
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
                : "glass-input text-muted hover:text-text"
            }`}
          >
            Text marker
            <span className="block text-xs opacity-70">other platforms</span>
          </button>
        </div>
      </div>

      {mode === "showtime_regex" && (
        <div className="rounded-lg border border-glass-border bg-black/10 p-3">
          <p className="mb-3 text-xs text-muted">
            Leave both blank to get alerted the moment <em>any</em> cinema in
            the URL above opens booking. Fill either in to narrow it down —
            type the name exactly as BookMyShow shows it.
          </p>
          <div className="mb-3">
            <label className="mb-1.5 block text-xs font-medium tracking-wide text-muted uppercase">
              Specific cinema (optional)
            </label>
            <input
              name="cinema_name"
              placeholder="PVR: Nexus (Formerly Forum), Koramangala"
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium tracking-wide text-muted uppercase">
              Format (optional)
            </label>
            <input
              name="format"
              placeholder="IMAX 2D, 4DX, DOLBY..."
              className={INPUT_CLASS}
            />
          </div>
        </div>
      )}

      {mode === "marker" && (
        <>
          <div>
            <label className="mb-1.5 block text-xs font-medium tracking-wide text-muted uppercase">
              Open marker text
            </label>
            <input
              name="open_marker"
              placeholder="Book tickets"
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium tracking-wide text-muted uppercase">
              Closed marker text (optional)
            </label>
            <input
              name="closed_marker"
              placeholder="Coming Soon"
              className={INPUT_CLASS}
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
