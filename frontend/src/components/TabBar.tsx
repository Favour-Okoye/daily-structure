import { NavLink } from "react-router-dom";

const TABS = [
  { to: "/", label: "Today", icon: "⚓" },
  { to: "/crew", label: "Crew", icon: "👒" },
  { to: "/tasks", label: "Tasks", icon: "✅" },
  { to: "/week", label: "Week", icon: "🌊" },
  { to: "/more", label: "More", icon: "🧭" },
];

export function TabBar() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-sky-100 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-3xl justify-around">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.to === "/"}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-3 py-2 text-[11px] font-bold transition ${
                isActive ? "text-sky-800" : "text-stone-400 hover:text-stone-600"
              }`
            }
          >
            <span className="text-xl leading-none">{tab.icon}</span>
            {tab.label}
          </NavLink>
        ))}
      </div>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
