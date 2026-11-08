"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useProfile } from "@/hooks/data";
import { getProfile } from "@/lib/db";
import { useTheme } from "@/hooks/theme";

const NAV = [
  { href: "/", label: "Today", icon: SunIcon },
  { href: "/closet", label: "Closet", icon: HangerIcon },
  { href: "/create", label: "Create", icon: PlusIcon },
  { href: "/inspo", label: "Inspo", icon: SparkIcon },
  { href: "/me", label: "Me", icon: UserIcon },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const profile = useProfile();
  const onboarding = pathname.startsWith("/onboarding");

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

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      <header className="flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),12px)] pb-1">
        <Link href="/" aria-label="BgadAI home" className="flex items-center gap-1.5">
          <span className="only-synth h-4 w-1.5 bg-ink" aria-hidden />
          <span className="display text-[17px] tracking-[0.08em] [font-stretch:var(--display-stretch)]">BgadAI</span>
        </Link>
        <ThemeToggle />
      </header>
      <main className={`flex-1 px-4 pt-3 ${onboarding ? "pb-8" : "pb-28"}`}>{children}</main>
      {!onboarding && (
        <nav aria-label="Main" className="nav-surface fixed inset-x-0 bottom-0 z-30 border-t border-line pb-[env(safe-area-inset-bottom)]">
          <ul className="mx-auto grid max-w-md grid-cols-5">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={`relative flex flex-col items-center gap-1 pt-2.5 pb-2 label ${active ? "text-ink dark:text-accent-text" : "text-muted"}`}
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
      className="label flex h-8 items-center gap-1.5 rounded-btn border border-edge px-2.5 text-ink"
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
