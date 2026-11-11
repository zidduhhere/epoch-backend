'use client';

import React, { useState } from 'react';
import { ClassInfo, CurrentUser } from '../lib/types';
import { Users, Phone, Building2, Edit2, Check, X, ShieldCheck } from 'lucide-react';

interface CoordinatorsDirectoryProps {
  currentUser: CurrentUser;
  classes: ClassInfo[];
  onUpdateCoordinators: (classId: string, c1Name: string, c1Phone: string, c2Name: string, c2Phone: string) => void;
}

export function CoordinatorsDirectory({
  currentUser,
  classes,
  onUpdateCoordinators,
}: CoordinatorsDirectoryProps) {
  const [editingClassId, setEditingClassId] = useState<string | null>(null);
  const [c1Name, setC1Name] = useState('');
  const [c1Phone, setC1Phone] = useState('');
  const [c2Name, setC2Name] = useState('');
  const [c2Phone, setC2Phone] = useState('');

  const handleStartEdit = (c: ClassInfo) => {
    setEditingClassId(c.id);
    setC1Name(c.coordinator_1_name || '');
    setC1Phone(c.coordinator_1_phone || '');
    setC2Name(c.coordinator_2_name || '');
    setC2Phone(c.coordinator_2_phone || '');
  };

  const handleSave = (classId: string) => {
    onUpdateCoordinators(classId, c1Name, c1Phone, c2Name, c2Phone);
    setEditingClassId(null);
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-3">
          <div>
            <div className="flex items-center space-x-2">
              <span className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <Users className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-bold text-white tracking-tight">
                Class Coordinators Roster (2 per Class)
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Designated student representatives responsible for collecting ₹2,600 from each student across all 4 years.
            </p>
          </div>

          <div className="text-xs text-slate-400 bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700 flex items-center space-x-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Total Assigned: {classes.length * 2} Coordinators</span>
          </div>
        </div>

        {/* Directory Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          {classes.map((c) => {
            const isEditing = editingClassId === c.id;

            return (
              <div
                key={c.id}
                className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-5 shadow-md flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between pb-3 border-b border-slate-750">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
                        Year {c.year}
                      </span>
                      <h3 className="text-base font-bold text-white mt-1">
                        {c.name}
                      </h3>
                      <p className="text-xs text-slate-400">
                        Branch: {c.branch} • Section: {c.section}
                      </p>
                    </div>

                    {currentUser.role === 'admin' && !isEditing && (
                      <button
                        onClick={() => handleStartEdit(c)}
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors text-xs flex items-center space-x-1"
                        title="Edit Coordinators"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span className="text-[11px]">Edit</span>
                      </button>
                    )}
                  </div>

                  {isEditing ? (
                    <div className="mt-4 space-y-3 text-xs">
                      <div className="p-3 bg-slate-900 rounded-xl border border-slate-750 space-y-2">
                        <span className="font-bold text-indigo-400 text-[11px] block">
                          Coordinator 1 (Primary)
                        </span>
                        <input
                          type="text"
                          placeholder="Full Name"
                          value={c1Name}
                          onChange={(e) => setC1Name(e.target.value)}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                        />
                        <input
                          type="text"
                          placeholder="Phone Number"
                          value={c1Phone}
                          onChange={(e) => setC1Phone(e.target.value)}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                        />
                      </div>

                      <div className="p-3 bg-slate-900 rounded-xl border border-slate-750 space-y-2">
                        <span className="font-bold text-emerald-400 text-[11px] block">
                          Coordinator 2 (Secondary)
                        </span>
                        <input
                          type="text"
                          placeholder="Full Name"
                          value={c2Name}
                          onChange={(e) => setC2Name(e.target.value)}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                        />
                        <input
                          type="text"
                          placeholder="Phone Number"
                          value={c2Phone}
                          onChange={(e) => setC2Phone(e.target.value)}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                        />
                      </div>

                      <div className="flex justify-end space-x-2 pt-1">
                        <button
                          onClick={() => setEditingClassId(null)}
                          className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-lg text-xs"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleSave(c.id)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold"
                        >
                          Save Changes
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      {/* Coordinator 1 Card */}
                      <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-700/60 flex items-start space-x-2.5">
                        <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0">
                          1
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold uppercase block">
                            Coordinator 1
                          </span>
                          <span className="font-semibold text-slate-100 text-xs block">
                            {c.coordinator_1_name || 'Unassigned'}
                          </span>
                          <span className="text-slate-400 text-[11px] font-mono flex items-center space-x-1 mt-0.5">
                            <Phone className="w-3 h-3 text-slate-500" />
                            <span>{c.coordinator_1_phone || '—'}</span>
                          </span>
                        </div>
                      </div>

                      {/* Coordinator 2 Card */}
                      <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-700/60 flex items-start space-x-2.5">
                        <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0">
                          2
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold uppercase block">
                            Coordinator 2
                          </span>
                          <span className="font-semibold text-slate-100 text-xs block">
                            {c.coordinator_2_name || 'Unassigned'}
                          </span>
                          <span className="text-slate-400 text-[11px] font-mono flex items-center space-x-1 mt-0.5">
                            <Phone className="w-3 h-3 text-slate-500" />
                            <span>{c.coordinator_2_phone || '—'}</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-750 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Class Target per student:</span>
                  <span className="font-bold text-white font-mono">₹2,600.00</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

