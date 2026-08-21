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
      className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-4"
    >
      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-600">
          Movie
        </label>
        <input
          name="movie"
          required
          placeholder="Toxic: A Fairy Tale for Grown-ups (Bengaluru, Hindi)"
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-600">
          BookMyShow URL
        </label>
        <input
          name="url"
          required
          placeholder="https://in.bookmyshow.com/movies/.../buytickets/..."
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-600">
          Detection mode
        </label>
        <select
          name="mode"
          value={mode}
          onChange={(e) => setMode(e.target.value as typeof mode)}
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
        >
          <option value="showtime_regex">
            Showtime detection (recommended for BookMyShow)
          </option>
          <option value="marker">Text marker (other platforms)</option>
        </select>
      </div>

      {mode === "marker" && (
        <>
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">
              Open marker text
            </label>
            <input
              name="open_marker"
              placeholder="Book tickets"
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">
              Closed marker text (optional)
            </label>
            <input
              name="closed_marker"
              placeholder="Coming Soon"
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
            />
          </div>
        </>
      )}

      <button
        type="submit"
        className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white"
      >
        Add watch
      </button>
    </form>
  );
}
