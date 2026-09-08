'use client';

import React, { useEffect, useState } from 'react';
import { adminApiFetch } from '../../../lib/admin-api';

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const loadSettings = async () => {
    setLoading(true);
    const res = await adminApiFetch('/admin/settings');
    if (res.success && res.data) {
      setSettings(res.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSave = async (key: string) => {
    try {
      const parsedValue = JSON.parse(editValue);
      const res = await adminApiFetch(`/admin/settings/${encodeURIComponent(key)}`, {
        method: 'PATCH',
        body: JSON.stringify({ value: parsedValue }),
      });

      if (res.success) {
        setEditingKey(null);
        loadSettings();
      } else {
        alert(res.error || 'Failed to update setting');
      }
    } catch {
      alert('Invalid JSON format. Please provide valid JSON.');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Platform Configuration & Settings</h1>
        <p className="text-xs text-slate-400 mt-1">Manage global operational thresholds, daily token limits, and default parameters</p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
        {loading ? (
          <div className="py-20 text-center text-xs text-slate-400">Loading settings...</div>
        ) : settings.length === 0 ? (
          <div className="py-20 text-center text-xs text-slate-400">No settings found.</div>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {settings.map((s) => {
              const isEditing = editingKey === s.key;
              return (
                <div key={s.key} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-800/20 transition-colors">
                  <div className="space-y-1 max-w-lg">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-indigo-400">{s.key}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 uppercase font-mono">
                        {s.category}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">{s.description || 'No description provided'}</p>
                  </div>

                  <div className="flex-1 max-w-md">
                    {isEditing ? (
                      <div className="space-y-2">
                        <textarea
                          rows={2}
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSave(s.key)}
                            className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-medium"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingKey(null)}
                            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950 border border-slate-800/80">
                        <pre className="text-xs font-mono text-slate-300 truncate max-w-[280px]">
                          {JSON.stringify(s.value)}
                        </pre>
                        <button
                          onClick={() => {
                            setEditingKey(s.key);
                            setEditValue(JSON.stringify(s.value, null, 2));
                          }}
                          className="text-xs text-indigo-400 hover:text-indigo-300 ml-2"
                        >
                          Edit
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
