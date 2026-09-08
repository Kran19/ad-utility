'use client';

import React, { useEffect, useState } from 'react';
import { adminApiFetch } from '../../../lib/admin-api';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    roles: ['ADMIN'],
  });

  const loadData = async () => {
    setLoading(true);
    let path = '/admin/users?page=1&pageSize=50';
    if (search) path += `&search=${encodeURIComponent(search)}`;

    const [uRes, rRes] = await Promise.all([
      adminApiFetch(path),
      adminApiFetch('/admin/users/roles'),
    ]);

    if (uRes.success && uRes.data) {
      setUsers(uRes.data.items || []);
    }
    if (rRes.success && rRes.data) {
      setRoles(rRes.data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [search]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await adminApiFetch('/admin/users', {
      method: 'POST',
      body: JSON.stringify(newUser),
    });

    if (res.success) {
      setShowModal(false);
      setNewUser({ email: '', password: '', firstName: '', lastName: '', roles: ['ADMIN'] });
      loadData();
    } else {
      alert(res.error || 'Failed to create user');
    }
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    const res = await adminApiFetch(`/admin/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive: !currentActive }),
    });
    if (res.success) {
      loadData();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Admin Users & RBAC</h1>
          <p className="text-xs text-slate-400 mt-1">Manage administrative accounts, role assignments, and platform access</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs rounded-xl shadow-md transition-colors flex items-center gap-2 self-start sm:self-auto"
        >
          <span>+</span> Create Admin User
        </button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3 bg-slate-900 p-4 rounded-xl border border-slate-800">
        <input
          type="text"
          placeholder="Search by email or name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-80 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
        />
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
        {loading ? (
          <div className="py-20 text-center text-xs text-slate-400">Loading users...</div>
        ) : users.length === 0 ? (
          <div className="py-20 text-center text-xs text-slate-400">No admin users found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800 text-[10px]">
                <tr>
                  <th className="px-4 py-3">Email & Name</th>
                  <th className="px-4 py-3">Assigned Roles</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Last Login</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-white">{u.email}</div>
                      <div className="text-[11px] text-slate-400">
                        {u.firstName || u.lastName ? `${u.firstName || ''} ${u.lastName || ''}` : 'No name set'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {u.roles?.map((r: string) => (
                          <span
                            key={r}
                            className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-indigo-400 font-mono font-semibold"
                          >
                            {r}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-mono ${
                          u.isActive
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {u.isActive ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 font-mono text-[11px]">
                      {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Never'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleToggleActive(u.id, u.isActive)}
                        className={`px-2.5 py-1 rounded text-[11px] transition-colors ${
                          u.isActive
                            ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400'
                            : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400'
                        }`}
                      >
                        {u.isActive ? 'Disable Account' : 'Enable Account'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white">Create Admin User</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white text-sm">✕</button>
            </div>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-300">Email Address</label>
                <input
                  type="email"
                  required
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-300">Password</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300">First Name</label>
                  <input
                    type="text"
                    value={newUser.firstName}
                    onChange={(e) => setNewUser({ ...newUser, firstName: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300">Last Name</label>
                  <input
                    type="text"
                    value={newUser.lastName}
                    onChange={(e) => setNewUser({ ...newUser, lastName: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-300">Primary Role</label>
                <select
                  value={newUser.roles[0] || 'ADMIN'}
                  onChange={(e) => setNewUser({ ...newUser, roles: [e.target.value] })}
                  className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                >
                  <option value="ADMIN">ADMIN</option>
                  <option value="EDITOR">EDITOR</option>
                  <option value="ANALYST">ANALYST</option>
                  <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-800 text-slate-300 text-xs hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium"
                >
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
