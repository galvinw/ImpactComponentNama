import type { PropsWithChildren } from 'react';
import { NavLink } from 'react-router-dom';

const navItems = [
  { label: 'Kiosk', to: '/' },
  { label: 'Analytics', to: '/kiosk' },
];

export default function AppShell({ children }: PropsWithChildren) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.7),_transparent_40%),linear-gradient(180deg,_#edf5f3_0%,_#f8faf8_45%,_#eef2f7_100%)] text-slate-900">
      <header className="pointer-events-none fixed inset-x-0 top-0 z-20 flex justify-end px-3 py-3">
        <div className="pointer-events-auto rounded-lg border border-white/30 bg-slate-950/20 p-1.5 shadow-[0_18px_50px_-28px_rgba(15,23,42,0.55)] backdrop-blur-md">
          <nav className="flex items-center gap-2 rounded-md bg-white/28 p-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `rounded-md px-4 py-2 text-sm font-medium transition ${
                    isActive ? 'bg-[#ffc42d] text-slate-950' : 'text-white/80 hover:text-white'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="px-0 py-0">{children}</main>
    </div>
  );
}
