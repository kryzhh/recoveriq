import { NavLink, Outlet } from 'react-router-dom'
import { LayoutDashboard, List, Play } from 'lucide-react'
import { motion } from 'motion/react'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/events', label: 'Events', icon: List },
  { to: '/batch', label: 'Batch Runner', icon: Play },
]

export default function Layout() {
  return (
    <div className="flex min-h-screen bg-[#0a0f1a] text-slate-100">
      <aside className="flex w-[240px] shrink-0 flex-col border-r border-[#1a2540] bg-[#0d1424] px-4 py-5">
        <div className="mb-10 px-2">
          <div className="text-[0.7rem] font-semibold uppercase tracking-[0.35em] text-sky-300/80">
            RecoverIQ
          </div>
          <div className="mt-2 text-lg font-semibold tracking-tight text-slate-50">
            Revenue recovery control plane
          </div>
        </div>

        <nav className="space-y-2">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className="block">
              {({ isActive }) => (
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.985 }}
                  className={`flex items-center gap-3 rounded-xl border px-3 py-3 text-sm font-medium transition-colors ${
                    isActive
                      ? 'border-sky-400/35 bg-sky-400/10 text-sky-200 shadow-[0_0_0_1px_rgba(56,189,248,0.08)]'
                      : 'border-transparent text-slate-300 hover:border-slate-700 hover:bg-white/5 hover:text-slate-50'
                  }`}
                >
                  <Icon className={isActive ? 'h-4 w-4 text-sky-300' : 'h-4 w-4 text-slate-400'} />
                  <span>{label}</span>
                </motion.div>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto px-2 pb-2 text-xs text-slate-500">
          Live recovery operations
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-auto bg-[#0a0f1a]">
        <Outlet />
      </main>
    </div>
  )
}