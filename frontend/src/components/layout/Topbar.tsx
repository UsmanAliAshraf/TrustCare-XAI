import { useNavigate } from 'react-router-dom'
import { Menu, Bell, Search, LogOut, User } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/hooks/useAuth'
import { useSettings } from '@/hooks/useSettings'
import { initials } from '@/lib/utils'

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const { user, logout } = useAuth()
  const { settings } = useSettings()
  const navigate = useNavigate()
  const name = user?.name || settings.doctorName

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur lg:px-8">
      <button
        className="rounded-md p-2 text-muted-foreground hover:bg-accent lg:hidden"
        onClick={onMenu}
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="relative hidden max-w-sm flex-1 md:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          placeholder="Search patients, reports..."
          onFocus={() => navigate('/patients')}
          className="h-9 w-full rounded-lg border border-input bg-secondary/60 pl-9 pr-3 text-sm outline-none transition-colors focus:border-ring focus:bg-card"
        />
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <button className="relative rounded-lg p-2 text-muted-foreground hover:bg-accent">
          <Bell className="h-5 w-5" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive ring-2 ring-background" />
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring">
            <Avatar className="h-8 w-8">
              <AvatarFallback>{initials(name)}</AvatarFallback>
            </Avatar>
            <div className="hidden text-left sm:block">
              <div className="text-sm font-semibold leading-tight text-foreground">{name}</div>
              <div className="text-xs leading-tight text-muted-foreground">{settings.department}</div>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>
              <div className="font-semibold">{name}</div>
              <div className="text-xs font-normal text-muted-foreground">{user?.email}</div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/settings')}>
              <User /> Profile & Settings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
              <LogOut /> Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
