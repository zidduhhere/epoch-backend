'use client';

import React, { useState, useMemo } from 'react';
import { ClassInfo, Student, PaymentLedgerEntry, Bill } from '../lib/types';
import { formatDateTimeIST } from '../lib/date-utils';
import {
  Building2,
  TrendingUp,
  ShieldCheck,
  Download,
  Search,
  ArrowRight,
  Users,
  Phone,
  Receipt,
  Calendar,
  Layers,
  Lock
} from 'lucide-react';

interface AdminOverviewProps {
  classes: ClassInfo[];
  students: Student[];
  ledger: PaymentLedgerEntry[];
  bills: Bill[];
  onSelectClass: (classId: string) => void;
}

export function AdminOverview({
  classes,
  students,
  ledger,
  bills,
  onSelectClass,
}: AdminOverviewProps) {
  const [selectedYear, setSelectedYear] = useState<number | 'all'>('all');
  const [ledgerSearch, setLedgerSearch] = useState('');

  // Global Financials
  const globalTarget = students.reduce((acc, s) => acc + s.amount_due, 0);
  const globalCollected = students.reduce((acc, s) => acc + s.amount_paid, 0);
  const globalPending = globalTarget - globalCollected;
  const globalPercent = globalTarget > 0 ? Math.round((globalCollected / globalTarget) * 100) : 0;

  const approvedBillsTotal = bills
    .filter((b) => b.status === 'approved' || b.status === 'reimbursed')
    .reduce((acc, b) => acc + b.amount, 0);

  const pendingBillsTotal = bills
    .filter((b) => b.status === 'pending')
    .reduce((acc, b) => acc + b.amount, 0);

  const netVaultBalance = globalCollected - approvedBillsTotal;

  // Filter classes by year
  const filteredClasses = useMemo(() => {
    if (selectedYear === 'all') return classes;
    return classes.filter((c) => c.year === selectedYear);
  }, [classes, selectedYear]);

  // Master Ledger filtered
  const filteredLedger = useMemo(() => {
    return ledger.filter((entry) => {
      return (
        entry.student_name.toLowerCase().includes(ledgerSearch.toLowerCase()) ||
        (entry.student_roll && entry.student_roll.toLowerCase().includes(ledgerSearch.toLowerCase())) ||
        entry.modifier_name.toLowerCase().includes(ledgerSearch.toLowerCase()) ||
        (entry.reference_id && entry.reference_id.toLowerCase().includes(ledgerSearch.toLowerCase()))
      );
    });
  }, [ledger, ledgerSearch]);

  const handleExportCSV = () => {
    const headers = [
      'Timestamp',
      'Student Roll',
      'Student Name',
      'Old Amount',
      'New Amount',
      'Delta',
      'Action',
      'Payment Mode',
      'Reference ID',
      'Modifier Name',
      'Modifier Role',
      'Reason',
    ];

    const rows = filteredLedger.map((e) => [
      `"${new Date(e.created_at).toISOString()}"`,
      `"${e.student_roll}"`,
      `"${e.student_name}"`,
      e.old_amount,
      e.new_amount,
      e.delta,
      `"${e.action}"`,
      `"${e.payment_mode}"`,
      `"${e.reference_id || ''}"`,
      `"${e.modifier_name}"`,
      `"${e.modifier_role}"`,
      `"${e.reason || ''}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `EPOCH_Master_Ledger_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Central Admin Financial Health Dashboard */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-5 border-b border-slate-800 gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                <ShieldCheck className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-bold text-white tracking-tight">
                Epoch Central Financial Command
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Cross-Year Institutional Roster • 4 Years • 8 Class Sections • Facilitation Treasury
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleExportCSV}
              className="flex items-center space-x-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition-colors shadow-sm"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              <span>Export Master Ledger (CSV)</span>
            </button>
          </div>
        </div>

        {/* Global Financial Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
          {/* Card 1: Total Projected Target */}
          <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/60">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Total Target (Roster)
            </span>
            <div className="text-2xl font-black text-white mt-1">
              ₹{globalTarget.toLocaleString('en-IN')}
            </div>
            <div className="text-xs text-slate-400 mt-1 flex items-center justify-between">
              <span>{students.length} Total Registered</span>
              <span className="font-mono">₹2,600 / student</span>
            </div>
          </div>

          {/* Card 2: Total Collected */}
          <div className="bg-slate-800/60 p-4 rounded-xl border border-emerald-500/30 bg-emerald-950/10">
            <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block">
              Total Funds Collected
            </span>
            <div className="text-2xl font-black text-emerald-400 mt-1">
              ₹{globalCollected.toLocaleString('en-IN')}
            </div>
            <div className="text-xs text-emerald-300/80 mt-1 flex items-center justify-between">
              <span>{globalPercent}% of Total Target</span>
              <span>₹{globalPending.toLocaleString('en-IN')} Pending</span>
            </div>
          </div>

          {/* Card 3: Approved Expenses */}
          <div className="bg-slate-800/60 p-4 rounded-xl border border-amber-500/30 bg-amber-950/10">
            <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block">
              Approved Event Expenses
            </span>
            <div className="text-2xl font-black text-amber-400 mt-1">
              ₹{approvedBillsTotal.toLocaleString('en-IN')}
            </div>
            <div className="text-xs text-amber-300/80 mt-1 flex items-center justify-between">
              <span>Facilitation Committee</span>
              <span>₹{pendingBillsTotal.toLocaleString('en-IN')} Awaiting Review</span>
            </div>
          </div>

          {/* Card 4: Net Treasury Balance */}
          <div className="bg-slate-800/60 p-4 rounded-xl border border-indigo-500/30 bg-indigo-950/10">
            <span className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider block">
              Net Vault Balance
            </span>
            <div className="text-2xl font-black text-white mt-1">
              ₹{netVaultBalance.toLocaleString('en-IN')}
            </div>
            <div className="text-xs text-indigo-300/80 mt-1">
              Funds in Hand (Collected − Expenses)
            </div>
          </div>
        </div>
      </div>

      {/* Year-by-Year Classes Leaderboard & Cards */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <Building2 className="w-4 h-4 text-indigo-400" />
              <span>Classes Across 4 Years</span>
            </h3>
            <p className="text-xs text-slate-400">
              Each class has 2 assigned co-ordinators managing collection. Click any class to open its spreadsheet.
            </p>
          </div>

          {/* Year Filter Pills */}
          <div className="flex items-center space-x-1.5 bg-slate-800 p-1 rounded-xl border border-slate-700">
            <button
              onClick={() => setSelectedYear('all')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${selectedYear === 'all'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
                }`}
            >
              All Years (1-4)
            </button>
            {[1, 2, 3, 4].map((year) => (
              <button
                key={year}
                onClick={() => setSelectedYear(year)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${selectedYear === year
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                  }`}
              >
                Year {year}
              </button>
            ))}
          </div>
        </div>

        {/* Classes Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
          {filteredClasses.map((c) => {
            const classRoster = students.filter((s) => s.class_id === c.id);
            const target = classRoster.reduce((acc, s) => acc + s.amount_due, 0);
            const collected = classRoster.reduce((acc, s) => acc + s.amount_paid, 0);
            const percent = target > 0 ? Math.round((collected / target) * 100) : 0;
            const fullCount = classRoster.filter((s) => s.amount_paid >= s.amount_due).length;

            return (
              <div
                key={c.id}
                onClick={() => onSelectClass(c.id)}
                className="bg-slate-800/70 border border-slate-700/60 rounded-xl p-4 hover:border-indigo-500/70 transition-all cursor-pointer group hover:shadow-lg"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
                      Year {c.year} • {c.branch} Sec {c.section}
                    </span>
                    <h4 className="text-sm font-bold text-white mt-1 group-hover:text-indigo-300 transition-colors">
                      {c.name}
                    </h4>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-emerald-400 block font-mono">
                      ₹{collected.toLocaleString('en-IN')}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      of ₹{target.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-3">
                  <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                    <span>{fullCount}/{classRoster.length} Paid</span>
                    <span className="font-semibold text-white">{percent}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-full"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>

                {/* Coordinators */}
                <div className="mt-3 pt-3 border-t border-slate-700/50 text-[11px] space-y-1 text-slate-300">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">C1: {c.coordinator_1_name}</span>
                    <span className="text-[10px] font-mono text-slate-400">{c.coordinator_1_phone}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">C2: {c.coordinator_2_name}</span>
                    <span className="text-[10px] font-mono text-slate-400">{c.coordinator_2_phone}</span>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-end text-[11px] font-semibold text-indigo-400 group-hover:translate-x-1 transition-transform">
                  <span>Open Class Spreadsheet</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Master Audit Ledger Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <Lock className="w-4 h-4 text-emerald-400" />
              <span>Master Immutable Audit Ledger</span>
            </h3>
            <p className="text-xs text-slate-400">
              Live chronological stream of every entry and adjustment across the entire college.
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search ledger entries..."
              value={ledgerSearch}
              onChange={(e) => setLedgerSearch(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Ledger Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-800/80 text-slate-300 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-700">
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-3">Student</th>
                <th className="py-2.5 px-3">Change (₹)</th>
                <th className="py-2.5 px-3">Action</th>
                <th className="py-2.5 px-3">Mode & Ref</th>
                <th className="py-2.5 px-3">Modifier (Author)</th>
                <th className="py-2.5 px-3">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredLedger.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-500">
                    No matching audit records
                  </td>
                </tr>
              ) : (
                filteredLedger.slice(0, 15).map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap font-mono text-[11px]" suppressHydrationWarning>
                      {formatDateTimeIST(entry.created_at)}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-slate-200">{entry.student_name}</div>
                      <div className="text-[10px] font-mono text-indigo-400">{entry.student_roll}</div>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <div className="font-bold text-white">
                        ₹{entry.old_amount} → ₹{entry.new_amount}
                      </div>
                      <div className="text-[10px] font-semibold text-emerald-400">
                        {entry.delta > 0 ? `+₹${entry.delta}` : `₹${entry.delta}`}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300">
                        {entry.action.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <div className="text-slate-300 font-mono text-[10px] uppercase">{entry.payment_mode || 'Cash'}</div>
                      {entry.reference_id && (
                        <div className="text-slate-400 text-[10px] font-mono truncate max-w-[120px]" title={entry.reference_id}>
                          {entry.reference_id}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-slate-200">{entry.modifier_name}</div>
                      <div className="text-[10px] text-slate-400">
                        {entry.modifier_role === 'admin' ? 'Central Admin' : 'Class Coordinator'}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 italic text-[11px] max-w-[200px] truncate" title={entry.reason}>
                      {entry.reason || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

