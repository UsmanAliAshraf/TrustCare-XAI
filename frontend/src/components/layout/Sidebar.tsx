import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  FolderTree,
  Activity,
  FileText,
  Settings,
  LogOut,
  X,
} from 'lucide-react'
import { Logo } from '@/components/Logo'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/patients', label: 'Patients', icon: Users },
  { to: '/browse', label: 'Browse', icon: FolderTree },
  { to: '/analysis', label: 'Analysis', icon: Activity },
  { to: '/reports', label: 'Reports', icon: FileText },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { logout } = useAuth()

  return (
    <>
      {/* mobile overlay */}
      {open && (
        <div className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm lg:hidden" onClick={onClose} />
      )}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r bg-card transition-transform duration-300 lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 items-center justify-between border-b px-5">
          <Logo />
          <button
            className="rounded-md p-1 text-muted-foreground hover:bg-accent lg:hidden"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )
              }
            >
              <Icon className="h-[18px] w-[18px]" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t p-3">
          <button
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="h-[18px] w-[18px]" />
            Logout
          </button>
        </div>
      </aside>
    </>
  )
}
