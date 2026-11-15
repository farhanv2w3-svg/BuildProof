import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { Menu, X, ChevronDown, LogOut, LayoutDashboard } from "lucide-react";
import { Logo } from "./Logo";
import { Button, ButtonLink } from "./ui";
import { useAuth } from "../lib/auth";
import { cn } from "../lib/utils";

const exploreNav = [
  { to: "/problems", label: "Problems" },
  { to: "/solutions", label: "Solutions Marketplace" },
  { to: "/company-projects", label: "Company Projects" },
  { to: "/startups-funding", label: "Startups & Funding" },
  { to: "/hardware", label: "Hardware Innovation" },
  { to: "/opportunities", label: "Opportunities" },
  { to: "/events", label: "Events" },
];

const publicNav = [
  { to: "/how-it-works", label: "How it works" },
  { to: "/proof-cards", label: "Proof Cards" },
];

const audienceNav = [
  { to: "/for-students", label: "Students" },
  { to: "/for-colleges", label: "Colleges" },
  { to: "/for-problem-owners", label: "Problem owners" },
  { to: "/for-mentors", label: "Mentors" },
];

export function PublicLayout() {
  const [open, setOpen] = useState(false);
  const [exploreOpen, setExploreOpen] = useState(false);
  const { user, loading } = useAuth();

  const navItem = (n: { to: string; label: string }) => (
    <NavLink
      key={n.to}
      to={n.to}
      onClick={() => setOpen(false)}
      className={({ isActive }) =>
        cn(
          "rounded-md px-2.5 py-2 text-[13.5px] font-medium transition-colors",
          isActive ? "text-brand-700 bg-brand-50" : "text-ink-soft hover:text-ink"
        )
      }
    >
      {n.label}
    </NavLink>
  );

  /* Explore dropdown: the platform domains, distinguishable without reading essays. */
  const exploreDropdown = (
    <div className="relative" onMouseLeave={() => setExploreOpen(false)}>
      <button
        className="flex items-center gap-1 rounded-md px-2.5 py-2 text-[13.5px] font-medium text-ink-soft hover:text-ink"
        aria-expanded={exploreOpen}
        aria-haspopup="menu"
        aria-label="Explore platform domains"
        onClick={() => setExploreOpen((o) => !o)}
        onMouseEnter={() => setExploreOpen(true)}
      >
        Explore <ChevronDown className="h-3.5 w-3.5" />
      </button>
      {exploreOpen && (
        <div
          role="menu"
          className="absolute left-0 top-full z-50 w-60 rounded-card border border-line bg-surface p-1.5 shadow-card"
        >
          {exploreNav.map((n) => (
            <NavLink
              key={n.to}
              role="menuitem"
              to={n.to}
              onClick={() => { setExploreOpen(false); setOpen(false); }}
              className="block rounded-md px-2.5 py-2 text-[13px] font-medium text-ink-soft hover:bg-brand-50 hover:text-brand-700"
            >
              {n.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
        <div className="container-xl flex h-16 items-center justify-between gap-4">
          <Link to="/" aria-label="BuildProof home">
            <Logo />
          </Link>
          <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
            {publicNav.map(navItem)}
            {exploreDropdown}
            {audienceNav.map(navItem)}
          </nav>
          <div className="hidden items-center gap-2 lg:flex">
            {loading ? null : user ? (
              <ButtonLink to="/app" size="md">
                <LayoutDashboard className="h-4 w-4" /> Open app
              </ButtonLink>
            ) : (
              <>
                <ButtonLink to="/login" variant="secondary" size="md">
                  Sign in
                </ButtonLink>
                <ButtonLink to="/signup" size="md">
                  Get started
                </ButtonLink>
              </>
            )}
          </div>
          <button
            className="lg:hidden p-2 text-ink-soft"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label="Toggle menu"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        {open && (
          <nav
            id="mobile-nav"
            aria-label="Mobile"
            className="border-t border-line bg-surface px-4 py-3 lg:hidden"
          >
            <div className="flex flex-col">
              {exploreNav.map(navItem)}
              <div className="my-1 border-t border-line" />
              {publicNav.map(navItem)}
              {audienceNav.map(navItem)}
            </div>
            <div className="mt-3 flex gap-2 border-t border-line pt-3">
              {user ? (
                <Link to="/app" className="w-full" onClick={() => setOpen(false)}>
                  <Button className="w-full">Open app</Button>
                </Link>
              ) : (
                <>
                  <Link to="/login" className="flex-1" onClick={() => setOpen(false)}>
                    <Button variant="secondary" className="w-full">Sign in</Button>
                  </Link>
                  <Link to="/signup" className="flex-1" onClick={() => setOpen(false)}>
                    <Button className="w-full">Get started</Button>
                  </Link>
                </>
              )}
            </div>
          </nav>
        )}
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

/* -------------------------------- Footer --------------------------- */

const year = new Date().getFullYear();

export function Footer() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="container-xl grid gap-10 py-12 sm:grid-cols-3 lg:grid-cols-5">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-[13px] leading-relaxed text-ink-soft">
            Real Problems. Proven Skills. Real Opportunities. BuildProof connects
            problem discovery, evidence-based validation and skills proof.
          </p>
        </div>
        <FooterCol
          title="Discover"
          links={[
            ["/problems", "Problems"],
            ["/solutions", "Solutions Marketplace"],
            ["/company-projects", "Company Projects"],
            ["/hardware", "Hardware Innovation"],
            ["/events", "Events"],
          ]}
        />
        <FooterCol
          title="Grow"
          links={[
            ["/startups-funding", "Startups & Funding"],
            ["/opportunities", "Opportunities"],
            ["/how-it-works", "How it works"],
            ["/apply", "Join BuildProof"],
          ]}
        />
        <FooterCol
          title="For"
          links={[
            ["/for-students", "Students"],
            ["/for-colleges", "Colleges"],
            ["/for-problem-owners", "Problem owners"],
            ["/for-mentors", "Mentors"],
          ]}
        />
        <div>
          <h3 className="font-display text-[13px] font-bold text-ink">Legal & contact</h3>
          <ul className="mt-3 space-y-2 text-[13px]">
            <li><Link className="text-ink-soft hover:text-ink" to="/privacy">Privacy policy</Link></li>
            <li><Link className="text-ink-soft hover:text-ink" to="/terms">Terms of use</Link></li>
            <li>
              <a className="text-ink-soft hover:text-ink" href="mailto:hello@buildproof.org">
                hello@buildproof.org
              </a>
              <p className="mt-1 text-[11.5px] text-ink-soft">
                Placeholder contact while the project is unverified — update before launch.
              </p>
            </li>
            <li><Link className="text-ink-soft hover:text-ink" to="/terms#report">Report an issue</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line">
        <div className="container-xl flex flex-wrap items-center justify-between gap-2 py-4 text-[12px] text-ink-soft">
          <p>© {year} BuildProof. An early-stage student-built product — features shown reflect current functionality.</p>
          <p>Not legal, financial or career advice.</p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <h3 className="font-display text-[13px] font-bold text-ink">{title}</h3>
      <ul className="mt-3 space-y-2 text-[13px]">
        {links.map(([to, label]) => (
          <li key={to + label}>
            <Link className="text-ink-soft hover:text-ink" to={to}>
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------ Provider pill ---------------------- */

export function RolePickerBadge() {
  return (
    <span className="inline-flex items-center text-[12px] text-ink-soft">
      <ChevronDown className="h-3.5 w-3.5" />
    </span>
  );
}

/** Small helper for auth pages to sign out cleanly after profile updates. */
export function useSignOutAndGo() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  return async () => {
    await signOut();
    navigate("/login");
  };
}

export function SignOutButton({ className }: { className?: string }) {
  const doSignOut = useSignOutAndGo();
  return (
    <button
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-3 py-2 text-[13.5px] text-ink-soft hover:bg-line/40 hover:text-ink",
        className
      )}
      onClick={doSignOut}
    >
      <LogOut className="h-4 w-4" /> Sign out
    </button>
  );
}
