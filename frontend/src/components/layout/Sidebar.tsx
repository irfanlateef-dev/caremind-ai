import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Calendar,
  FileText,
  Users,
  User,
  ScrollText,
  FileCheck,
  BrainCircuit,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Activity,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/utils/cn';
import { useAuthStore } from '@/stores/auth.store';
import { useUIStore } from '@/stores/ui.store';
import { Avatar } from '@/components/ui/Avatar';
import { Tooltip } from '@/components/ui/Tooltip';

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  roles: string[];
  exact?: boolean;
}

const navItems: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" />, roles: ['admin', 'doctor', 'patient'] },
  { to: '/patients', label: 'Patients', icon: <User className="w-5 h-5" />, roles: ['doctor'] },
  { to: '/appointments', label: 'Appointments', icon: <Calendar className="w-5 h-5" />, roles: ['admin', 'doctor', 'patient'] },
  { to: '/ai-assistant', label: 'AI Assistant', icon: <BrainCircuit className="w-5 h-5" />, roles: ['doctor', 'patient'] },
  { to: '/ai-outputs', label: 'AI Outputs', icon: <FileCheck className="w-5 h-5" />, roles: ['admin', 'doctor'] },
  { to: '/documents', label: 'Documents', icon: <FileText className="w-5 h-5" />, roles: ['doctor', 'patient'] },
  { to: '/users', label: 'Users', icon: <Users className="w-5 h-5" />, roles: ['admin'] },
  { to: '/admin/audit-logs', label: 'Audit Logs', icon: <ScrollText className="w-5 h-5" />, roles: ['admin'] },
];

function Logo({ collapsed }: { collapsed: boolean }) {
  return (
    <div className="flex items-center gap-3 px-4 py-5 border-b border-border/50">
      <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
        <Activity className="w-5 h-5 text-white" />
      </div>
      <AnimatePresence>
        {!collapsed && (
          <motion.span
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.2 }}
            className="text-xl font-bold text-slate-900 overflow-hidden whitespace-nowrap"
          >
            CareMind
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Sidebar() {
  const { user, logout } = useAuthStore();
  const { sidebarCollapsed, toggleSidebar } = useUIStore();
  const location = useLocation();

  const role = user?.role ?? 'patient';
  const filteredItems = navItems.filter((item) => item.roles.includes(role));

  return (
    <aside
      className={cn(
        'hidden lg:flex flex-col bg-white border-r border-border transition-all duration-300 relative',
        sidebarCollapsed ? 'w-16' : 'w-60'
      )}
    >
      <Logo collapsed={sidebarCollapsed} />

      <nav className="flex-1 py-4 overflow-y-auto overflow-x-hidden" aria-label="Main navigation">
        <ul className="space-y-1 px-2">
          {filteredItems.map((item) => {
            const isActive = item.exact
              ? location.pathname === item.to
              : location.pathname.startsWith(item.to);

            const linkContent = (
              <NavLink
                to={item.to}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-md transition-all duration-200',
                  'text-base font-medium min-h-[44px]',
                  isActive
                    ? 'bg-primary-50 text-primary font-semibold'
                    : 'text-slate-600 hover:bg-surface hover:text-slate-900'
                )}
                aria-current={isActive ? 'page' : undefined}
              >
                <span className="flex-shrink-0">{item.icon}</span>
                <AnimatePresence>
                  {!sidebarCollapsed && (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: 'auto' }}
                      exit={{ opacity: 0, width: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden whitespace-nowrap"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </NavLink>
            );

            return (
              <li key={item.to}>
                {sidebarCollapsed ? (
                  <Tooltip content={item.label} side="right">
                    {linkContent}
                  </Tooltip>
                ) : (
                  linkContent
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-border/50 p-3">
        <div className={cn('flex items-center gap-3', sidebarCollapsed && 'justify-center')}>
          {!sidebarCollapsed && (
            <>
              <Avatar name={user?.name ?? user?.email} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">
                  {user?.name ?? user?.email}
                </p>
                <p className="text-xs text-muted capitalize">{user?.role}</p>
              </div>
            </>
          )}
          {sidebarCollapsed ? (
            <Tooltip content="Logout" side="right">
              <button
                type="button"
                onClick={logout}
                className="p-2 rounded-md text-muted hover:text-danger hover:bg-danger-50 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </Tooltip>
          ) : (
            <button
              type="button"
              onClick={logout}
              className="p-2 rounded-md text-muted hover:text-danger hover:bg-danger-50 transition-colors"
              aria-label="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={toggleSidebar}
        className={cn(
          'absolute -right-3 top-20 w-6 h-6 bg-white border border-border rounded-full',
          'flex items-center justify-center shadow-card',
          'hover:bg-surface transition-colors z-10',
          'text-muted hover:text-slate-700'
        )}
        aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {sidebarCollapsed ? (
          <ChevronRight className="w-3.5 h-3.5" />
        ) : (
          <ChevronLeft className="w-3.5 h-3.5" />
        )}
      </button>
    </aside>
  );
}

// Re-export for use in mobile contexts
export { navItems };
export type { NavItem };
