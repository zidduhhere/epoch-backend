'use client';

import { useMemo, useState } from 'react';
import { BarChart3, HandCoins, History, House, KeyRound, LayoutGrid, LogOut, Receipt, UsersRound, Users } from 'lucide-react';
import { signOut } from '@/app/actions/auth';
import { AdminAnalyticsDashboard } from '@/components/AdminAnalyticsDashboard';
import type { CurrentUser, WorkspaceData } from '@/lib/types';
import { AuditLogView } from './AuditLogView';
import { ClassMatrix, type ClassStats } from './ClassMatrix';
import { ClassSheet } from './ClassSheet';
import { CoordinatorHome } from './CoordinatorHome';
import { ExpensesView } from './ExpensesView';
import { AdminHandovers, CoordinatorHandover } from './HandoversView';
import { LoginsView } from './LoginsView';
import { StrengthView } from './StrengthView';
import { statsByClass } from '@/components/analytics/metrics';
import { Sheet } from './ui';

const ADMIN_SCREENS = [
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'handovers', label: 'Handovers', icon: HandCoins },
  { id: 'strength', label: 'Strength', icon: UsersRound },
  { id: 'expenses', label: 'Expenses', icon: Receipt },
  { id: 'audit', label: 'Audit log', icon: History },
  { id: 'logins', label: 'Logins', icon: KeyRound },
] as const;

export function Workspace({ user, data }: { user: CurrentUser; data: WorkspaceData }) {
  const { classes, students, ledger, payments, handovers, bills, accounts } = data;
  const isAdmin = user.role === 'admin';

  // Either a class id or one of the admin screen ids.
  const [view, setView] = useState<string>(isAdmin ? 'analytics' : user.assigned_class_id ? 'home' : 'audit');
  const [pickerOpen, setPickerOpen] = useState(false);

  // Target is the whole class (total students x fee), not only the students entered so far.
  const stats = useMemo(() => {
    const paidInFull = new Map<string, number>();
    for (const student of students) {
      if (student.amount_paid >= student.amount_due) paidInFull.set(student.class_id, (paidInFull.get(student.class_id) ?? 0) + 1);
    }
    return new Map<string, ClassStats>(
      statsByClass(classes, students).map((row) => [
        row.cls.id,
        {
          students: row.studentCount,
          target: row.target,
          collected: row.collected,
          paidInFull: paidInFull.get(row.cls.id) ?? 0,
        },
      ]),
    );
  }, [classes, students]);

  const activeClass = classes.find((c) => c.id === view);
  const coordinatorClass = isAdmin ? undefined : classes.find((c) => c.id === user.assigned_class_id);
  const pendingHandovers = handovers.filter((h) => h.status === 'pending').length;

  function selectClass(classId: string) {
    setView(classId);
    setPickerOpen(false);
  }

  const signOutButton = (
    <form action={signOut}>
      <button className="flex h-11 items-center gap-1.5 rounded px-2 text-sm text-ink-2 hover:text-ink lg:h-9">
        <LogOut className="size-4" aria-hidden />
        Sign out
      </button>
    </form>
  );

  const roleLine = isAdmin ? (user.title ?? 'Admin') : (user.assigned_class_name ?? 'No class assigned');

  return (
    <div className="lg:grid lg:min-h-dvh lg:grid-cols-[17.5rem_minmax(0,1fr)]">
      {/* Desktop rail */}
      <aside className="sticky top-0 hidden h-dvh flex-col overflow-y-auto border-r border-line bg-surface p-4 lg:flex">
        <p className="text-lg font-semibold tracking-tight">EPOCH 2026</p>

        <nav className="mt-4 space-y-0.5" aria-label="Main">
          {isAdmin ? (
            ADMIN_SCREENS.map((screen) => (
              <RailLink key={screen.id} label={screen.id === 'handovers' && pendingHandovers > 0 ? `${screen.label} (${pendingHandovers})` : screen.label} icon={screen.icon} active={view === screen.id} onClick={() => setView(screen.id)} />
            ))
          ) : (
            <>
              {user.assigned_class_id && (
                <>
                  <RailLink label="Dashboard" icon={House} active={view === 'home'} onClick={() => setView('home')} />
                  <RailLink label="Students" icon={Users} active={view === user.assigned_class_id} onClick={() => setView(user.assigned_class_id!)} />
                  <RailLink label="Hand over" icon={HandCoins} active={view === 'handover'} onClick={() => setView('handover')} />
                </>
              )}
              <RailLink label="Audit log" icon={History} active={view === 'audit'} onClick={() => setView('audit')} />
            </>
          )}
        </nav>

        {isAdmin && (
          <section className="mt-6" aria-label="Classes">
            <h2 className="mb-2 font-semibold">Classes</h2>
            <ClassMatrix classes={classes} stats={stats} activeId={view} onSelect={selectClass} />
            <p className="mt-2 text-xs text-ink-2">Percent of fees collected</p>
          </section>
        )}

        <div className="mt-auto border-t border-line pt-3">
          <p className="truncate text-sm font-medium">{user.full_name}</p>
          <p className="truncate text-sm text-ink-2">{roleLine}</p>
          <div className="-ml-2 mt-1">{signOutButton}</div>
        </div>
      </aside>

      {/* Phone header */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-surface pr-2 pl-4 lg:hidden">
        <div className="min-w-0 py-1.5">
          <p className="truncate text-sm font-semibold">EPOCH 2026</p>
          <p className="truncate text-xs text-ink-2">
            {user.full_name}, {roleLine}
          </p>
        </div>
        {signOutButton}
      </header>

      <main className={`min-w-0 px-4 py-5 lg:px-8 lg:py-6 ${isAdmin || user.assigned_class_id ? 'pb-24 lg:pb-6' : ''}`}>
        {activeClass && <ClassSheet key={activeClass.id} cls={activeClass} students={students.filter((s) => s.class_id === activeClass.id)} payments={payments.filter((p) => p.class_id === activeClass.id)} isAdmin={isAdmin} />}
        {!activeClass && view === 'analytics' && isAdmin && (
          <AdminAnalyticsDashboard
            classes={classes}
            students={students}
            ledger={ledger}
            payments={payments}
            bills={bills}
            onNavigateToClass={setView}
            onNavigateToBills={() => setView('expenses')}
          />
        )}
        {!activeClass && view === 'home' && !isAdmin && coordinatorClass && (
          <CoordinatorHome
            cls={coordinatorClass}
            students={students}
            payments={payments}
            handovers={handovers}
            onOpenStudents={() => setView(coordinatorClass.id)}
            onOpenHandover={() => setView('handover')}
          />
        )}
        {!activeClass && view === 'handover' && !isAdmin && coordinatorClass && (
          <CoordinatorHandover classId={coordinatorClass.id} students={students} payments={payments} handovers={handovers} />
        )}
        {!activeClass && view === 'handovers' && isAdmin && (
          <AdminHandovers classes={classes} students={students} payments={payments} handovers={handovers} />
        )}
        {!activeClass && view === 'strength' && isAdmin && <StrengthView classes={classes} />}
        {!activeClass && view === 'expenses' && isAdmin && <ExpensesView bills={bills} />}
        {!activeClass && view === 'audit' && <AuditLogView ledger={ledger} classes={classes} showClass={isAdmin} />}
        {!activeClass && view === 'logins' && isAdmin && <LoginsView accounts={accounts} classes={classes} currentUserId={user.id} />}
      </main>

      {/* Phone tab bar */}
      {(isAdmin || user.assigned_class_id) && (
        <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-20 flex border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden">
          {isAdmin ? (
            <>
              <TabLink label="Classes" icon={LayoutGrid} active={Boolean(activeClass)} onClick={() => setPickerOpen(true)} />
              {ADMIN_SCREENS.map((screen) => (
                <TabLink key={screen.id} label={screen.id === 'handovers' && pendingHandovers > 0 ? `${screen.label} (${pendingHandovers})` : screen.label} icon={screen.icon} active={view === screen.id} onClick={() => setView(screen.id)} />
              ))}
            </>
          ) : (
            <>
              {user.assigned_class_id && (
                <>
                  <TabLink label="Home" icon={House} active={view === 'home'} onClick={() => setView('home')} />
                  <TabLink label="Students" icon={Users} active={view === user.assigned_class_id} onClick={() => setView(user.assigned_class_id!)} />
                  <TabLink label="Handover" icon={HandCoins} active={view === 'handover'} onClick={() => setView('handover')} />
                </>
              )}
              <TabLink label="Audit log" icon={History} active={view === 'audit'} onClick={() => setView('audit')} />
            </>
          )}
        </nav>
      )}

      {isAdmin && (
        <Sheet open={pickerOpen} title="Choose a class" onClose={() => setPickerOpen(false)}>
          <ClassMatrix classes={classes} stats={stats} activeId={view} onSelect={selectClass} />
          <p className="mt-3 text-sm text-ink-2">Percent of fees collected</p>
        </Sheet>
      )}
    </div>
  );
}

type LinkProps = { label: string; icon: typeof Users; active: boolean; onClick: () => void };

function RailLink({ label, icon: Icon, active, onClick }: LinkProps) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`flex h-9 w-full items-center gap-2 rounded px-2 text-sm ${active ? 'bg-canvas font-semibold' : 'text-ink-2 hover:text-ink'}`}
    >
      <Icon className="size-4" aria-hidden />
      {label}
    </button>
  );
}

function TabLink({ label, icon: Icon, active, onClick }: LinkProps) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`flex h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-xs ${active ? 'font-semibold text-ink' : 'text-ink-2'}`}
    >
      <Icon className="size-5" aria-hidden />
      <span className="truncate">{label}</span>
    </button>
  );
}
