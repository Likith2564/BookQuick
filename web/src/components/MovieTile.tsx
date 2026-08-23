import type { ReactNode } from "react";

export function MovieTile({
  title,
  posterUrl,
  subtitle,
  badge,
  actions,
}: {
  title: string;
  posterUrl: string | null;
  subtitle?: ReactNode;
  badge?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="glass group relative overflow-hidden rounded-xl">
      <div className="aspect-2/3 w-full bg-black/20">
        {posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={posterUrl}
            alt={title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center font-display text-3xl text-muted">
            {title.charAt(0)}
          </div>
        )}
      </div>

      {badge && (
        <div className="absolute top-2 right-2 rounded-full bg-black/70 px-2 py-1 text-xs font-semibold text-accent">
          {badge}
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 bg-gradient-to-t from-black/95 via-black/70 to-transparent p-3 pt-8">
        <div>
          <p className="line-clamp-2 text-sm leading-tight font-semibold text-white">
            {title}
          </p>
          {subtitle && (
            <p className="mt-0.5 text-xs text-white/60">{subtitle}</p>
          )}
        </div>
        {actions}
      </div>
    </div>
  );
}
