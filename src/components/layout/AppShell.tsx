import { clsx } from 'clsx'
import {
  BarChart3,
  BookOpenCheck,
  Briefcase,
  CalendarRange,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu,
  Tags,
  UserRound,
  Users,
  X,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink, Outlet, useLocation } from 'react-router'
import { useAuth, useMe } from '@/auth/AuthProvider'
import { LANGUAGES } from '@/i18n'
import type { Role } from '@/lib/types'
import { Avatar } from '../ui/misc'

interface NavItem {
  to: string
  label: string
  icon: ReactNode
  roles?: Role[]
}

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <svg viewBox="0 0 32 32" className="size-8" aria-hidden>
        <rect width="32" height="32" rx="8" fill="#f3efe6" />
        <path d="M9 9h14M9 14h14M9 19h8" stroke="#1f4d3a" strokeWidth="2.2" strokeLinecap="round" />
        <circle cx="22" cy="22" r="4.5" fill="none" stroke="#b9822a" strokeWidth="2" />
        <path d="M22 20v2.2l1.4 1" stroke="#b9822a" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      <span className="font-display text-[21px] font-medium tracking-tight text-paper">
        Time<span className="italic text-[#e3c486]">Ledger</span>
      </span>
    </div>
  )
}

export function AppShell() {
  const { t, i18n } = useTranslation()
  const { signOut } = useAuth()
  const me = useMe()
  const location = useLocation()
  // The drawer remembers the page it was opened on, so navigating closes it.
  const [openOn, setOpenOn] = useState<string | null>(null)
  const open = openOn === location.pathname
  const setOpen = (value: boolean) => setOpenOn(value ? location.pathname : null)

  const allSections: { title: string; items: NavItem[] }[] = [
    {
      title: t('nav.sectionWork'),
      items: [{ to: '/', label: t('nav.timesheet'), icon: <BookOpenCheck /> }],
    },
    {
      title: t('nav.sectionManage'),
      items: [
        { to: '/dashboard', label: t('nav.dashboard'), icon: <LayoutDashboard />, roles: ['admin', 'manager'] },
        { to: '/reports', label: t('nav.reports'), icon: <BarChart3 /> },
      ],
    },
    {
      title: t('nav.sectionSetup'),
      items: [
        { to: '/team', label: t('nav.team'), icon: <Users />, roles: ['admin'] },
        { to: '/clients', label: t('nav.clients'), icon: <Briefcase />, roles: ['admin', 'manager'] },
        { to: '/categories', label: t('nav.categories'), icon: <Tags />, roles: ['admin', 'manager'] },
        { to: '/tasks', label: t('nav.tasks'), icon: <ClipboardList />, roles: ['admin', 'manager'] },
        { to: '/exercises', label: t('nav.exercises'), icon: <CalendarRange />, roles: ['admin'] },
      ],
    },
  ]
  const sections = allSections
    .map((s) => ({ ...s, items: s.items.filter((i) => !i.roles || i.roles.includes(me.role)) }))
    .filter((s) => s.items.length > 0)

  const sidebar = (
    <div className="flex h-full flex-col bg-cover text-paper">
      <div className="flex h-16 items-center justify-between px-5">
        <Logo />
        <button className="rounded-md p-1.5 text-paper/70 hover:bg-white/10 lg:hidden" onClick={() => setOpen(false)} aria-label={t('common.close')}>
          <X className="size-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 pt-4">
        {sections.map((s) => (
          <div key={s.title}>
            <p className="mb-2 px-3 font-mono text-[10.5px] tracking-[0.16em] text-paper/40 uppercase">{s.title}</p>
            <ul className="space-y-0.5">
              {s.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) =>
                      clsx(
                        'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[14.5px] transition [&_svg]:size-[18px]',
                        isActive
                          ? 'bg-cover-2 text-paper before:absolute before:top-2 before:bottom-2 before:-left-3 before:w-[3px] before:rounded-r before:bg-[#e3c486]'
                          : 'text-paper/65 hover:bg-white/5 hover:text-paper',
                      )
                    }
                  >
                    {item.icon}
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/10 p-3">
        <NavLink
          to="/account"
          className={({ isActive }) =>
            clsx('flex items-center gap-3 rounded-lg px-2 py-2 transition hover:bg-white/5', isActive && 'bg-cover-2')
          }
        >
          <Avatar name={me.full_name} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{me.full_name}</p>
            <p className="truncate text-xs text-paper/50">{t(`roles.${me.role}`)}</p>
          </div>
          <UserRound className="size-4 text-paper/40" />
        </NavLink>
        <div className="mt-2 flex items-center justify-between gap-2 px-1">
          <div className="flex rounded-md bg-white/5 p-0.5">
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                onClick={() => void i18n.changeLanguage(l.code)}
                className={clsx(
                  'rounded px-2 py-1 font-mono text-[11px] uppercase transition',
                  i18n.resolvedLanguage === l.code ? 'bg-paper text-cover' : 'text-paper/60 hover:text-paper',
                )}
                title={l.label}
              >
                {l.code}
              </button>
            ))}
          </div>
          <button
            onClick={() => void signOut()}
            className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-paper/60 transition hover:bg-white/5 hover:text-paper"
          >
            <LogOut className="size-3.5" />
            {t('nav.signOut')}
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[256px_1fr]">
      <aside className="sticky top-0 hidden h-dvh lg:block">{sidebar}</aside>

      {/* Mobile drawer */}
      <div inert={!open} className={clsx('fixed inset-0 z-40 lg:hidden', open ? 'pointer-events-auto' : 'pointer-events-none')}>
        <div
          className={clsx('absolute inset-0 bg-cover/50 transition-opacity', open ? 'opacity-100' : 'opacity-0')}
          onClick={() => setOpen(false)}
        />
        <div className={clsx('absolute inset-y-0 left-0 w-72 transition-transform duration-300', open ? 'translate-x-0' : '-translate-x-full')}>
          {sidebar}
        </div>
      </div>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-rule bg-paper/90 px-4 backdrop-blur lg:hidden">
          <button className="rounded-md p-1.5 hover:bg-paper-2" onClick={() => setOpen(true)} aria-label="Menu">
            <Menu className="size-5" />
          </button>
          <span className="font-display text-lg">
            Time<span className="italic text-ledger">Ledger</span>
          </span>
        </header>
        <main className="mx-auto w-full max-w-[1240px] px-4 py-8 sm:px-8 lg:py-12">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
