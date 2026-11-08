"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { useProfile } from "@/hooks/data";
import { useOffline } from "next/offline";
import { getProfile, returnCleanLaundry } from "@/lib/db";
import { useTheme } from "@/hooks/theme";

const subscribeOnline = (cb: () => void) => {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
};

const NAV = [
  { href: "/", label: "Today", icon: SunIcon },
  { href: "/closet", label: "Closet", icon: HangerIcon },
  { href: "/create", label: "Create", icon: PlusIcon },
  { href: "/plan", label: "Plan", icon: CalendarIcon },
  { href: "/inspo", label: "Inspo", icon: SparkIcon },
  { href: "/me", label: "Me", icon: UserIcon },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const profile = useProfile();
  const onboarding = pathname.startsWith("/onboarding");
  // Next's useOffline catches failed navigations; the browser's own signal covers pages the
  // service worker serves from cache (no request fails there).
  const navFailed = useOffline();
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  const offline = navFailed || !online;

  // Laundry comes back by itself after the configured number of days.
  const laundryDays = profile?.laundryDays;
  useEffect(() => {
    if (laundryDays) returnCleanLaundry(laundryDays);
  }, [laundryDays]);

  // Offline support: cache the app shell + sample photos (production only).
  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!profile || profile.completedOnboarding || onboarding) return;
    // Re-read from the DB: the live query can lag right after onboarding saves.
    let alive = true;
    getProfile().then((fresh) => {
      if (alive && !fresh.completedOnboarding) router.replace("/onboarding");
    });
    return () => {
      alive = false;
    };
  }, [profile, onboarding, router]);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const logo = (
    <Link href="/" aria-label="BgadAI home" className="flex items-center gap-1.5">
      <span className="only-synth h-4 w-1.5 bg-ink" aria-hidden />
      <span className="display text-[17px] tracking-[0.08em] [font-stretch:var(--display-stretch)]">BgadAI</span>
    </Link>
  );
  const offlineBadge = offline && <span className="label rounded-btn bg-bad px-2 py-1 text-white">Offline</span>;

  return (
    <div className="flex min-h-dvh w-full">
      {/* Desktop: persistent sidebar (≥1024px). Phones/tablets use the bottom tab bar. */}
      {!onboarding && (
        <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line px-5 py-7 lg:flex">
          {logo}
          <p className="label mt-1 text-muted">AI stylist</p>
          <nav aria-label="Main" className="mt-10 flex-1">
            <ul className="space-y-1">
              {NAV.map(({ href, label, icon: Icon }) => {
                const active = isActive(href);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      aria-current={active ? "page" : undefined}
                      className={`flex h-11 items-center gap-3 rounded-btn px-3 text-[13px] font-semibold tracking-[0.08em] uppercase transition-colors duration-200 ${
                        active ? "bg-ink text-bg dark:bg-soft dark:text-accent-text" : "text-muted hover:bg-soft hover:text-ink"
                      }`}
                    >
                      <Icon active={active} />
                      {label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <div className="flex flex-col items-start gap-2">
            {offlineBadge}
            <ThemeToggle />
            <p className="mt-2 text-[11px] leading-snug text-muted">Your closet stays on this device.</p>
          </div>
        </aside>
      )}

      <div className={`mx-auto flex min-h-dvh w-full min-w-0 flex-col ${onboarding ? "max-w-xl" : "max-w-md md:max-w-3xl lg:max-w-5xl"}`}>
        <header className={`flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),12px)] pb-1 md:px-8 ${onboarding ? "" : "lg:hidden"}`}>
          {logo}
          <div className="flex items-center gap-2">
            {offlineBadge}
            <ThemeToggle />
          </div>
        </header>
        <main className={`flex-1 px-4 pt-3 md:px-8 ${onboarding ? "pb-8" : "pb-28 lg:pt-8 lg:pb-16"}`}>{children}</main>
      </div>

      {!onboarding && (
        <nav aria-label="Main" className="nav-surface fixed inset-x-0 bottom-0 z-30 border-t border-line pb-[env(safe-area-inset-bottom)] lg:hidden">
          <ul className="mx-auto grid max-w-xl grid-cols-6">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = isActive(href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={`relative flex min-h-[52px] flex-col items-center justify-center gap-1 pt-2 pb-1.5 label transition-colors duration-200 ${active ? "text-ink dark:text-accent-text" : "text-muted"}`}
                  >
                    {active && <span className="absolute top-0 h-[2px] w-8 bg-ink dark:bg-accent-text" aria-hidden />}
                    <Icon active={active} />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </div>
  );
}

function ThemeToggle() {
  const { resolved, setPref } = useTheme();
  const dark = resolved === "dark";
  return (
    <button
      type="button"
      onClick={() => setPref(dark ? "light" : "dark")}
      aria-label={dark ? "Switch to Editorial (light) theme" : "Switch to Synth (dark) theme"}
      className="label flex h-9 items-center gap-1.5 rounded-btn border border-edge px-3 text-ink transition-colors duration-200 hover:bg-soft"
    >
      <span aria-hidden>{dark ? "☾" : "☀"}</span>
      {dark ? "Synth" : "Editorial"}
    </button>
  );
}

type IconProps = { active?: boolean };
const svg = { width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;

function SunIcon({ active }: IconProps) {
  return (
    <svg {...svg} aria-hidden>
      <circle cx="12" cy="12" r="4" fill={active ? "currentColor" : "none"} />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}
function HangerIcon({ active }: IconProps) {
  return (
    <svg {...svg} aria-hidden strokeWidth={active ? 2.3 : 1.8}>
      <path d="M12 7a2 2 0 1 1 2-2c0 .9-.6 1.4-1.3 1.8L12 7.3v1.2L3.6 15.4A1.5 1.5 0 0 0 4.6 18h14.8a1.5 1.5 0 0 0 1-2.6L12 8.5" />
    </svg>
  );
}
function PlusIcon({ active }: IconProps) {
  return (
    <svg {...svg} aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="6" fill={active ? "currentColor" : "none"} />
      <path d="M12 8v8M8 12h8" stroke={active ? "var(--card)" : "currentColor"} />
    </svg>
  );
}
function CalendarIcon({ active }: IconProps) {
  return (
    <svg {...svg} aria-hidden>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" fill={active ? "currentColor" : "none"} />
      <path d="M3.5 10h17M8 3v4M16 3v4" stroke={active ? "var(--card)" : "currentColor"} />
    </svg>
  );
}
function SparkIcon({ active }: IconProps) {
  return (
    <svg {...svg} aria-hidden>
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" fill={active ? "currentColor" : "none"} />
      <path d="M19 16l.7 1.8 1.8.7-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7z" />
    </svg>
  );
}
function UserIcon({ active }: IconProps) {
  return (
    <svg {...svg} aria-hidden>
      <circle cx="12" cy="8" r="4" fill={active ? "currentColor" : "none"} />
      <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
    </svg>
  );
}
