"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/lib/authActions";

const LINKS = [
  { href: "/dashboard", label: "Watches" },
  { href: "/discover", label: "Discover" },
  { href: "/now-showing", label: "Now Showing" },
];

export function NavBar({ email }: { email: string }) {
  const pathname = usePathname();

  return (
    <header className="glass sticky top-4 z-20 mx-4 mt-4 flex items-center justify-between rounded-2xl px-5 py-3 sm:mx-6">
      <Link
        href="/dashboard"
        className="font-display text-2xl tracking-wide text-accent"
      >
        BOOKQUICK
      </Link>

      <nav className="hidden items-center gap-1 sm:flex">
        {LINKS.map((link) => {
          const active =
            pathname === link.href ||
            (link.href === "/now-showing" && pathname.startsWith("/theatres"));
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-accent text-accent-ink"
                  : "text-muted hover:text-text"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center gap-3">
        <p className="hidden truncate text-xs text-muted sm:block" title={email}>
          {email}
        </p>
        <form action={signOut}>
          <button className="text-xs text-muted underline hover:text-text">
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}
