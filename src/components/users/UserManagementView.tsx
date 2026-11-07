import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Users,
  UserPlus,
  ShieldCheck,
  Activity,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  MoreVertical,
  Edit2,
  KeyRound,
  Trash2,
  Power,
  RefreshCw,
  AlertCircle,
  Eye,
  EyeOff,
  Sparkles,
  Phone,
  Mail,
  Calendar,
  Lock,
  HelpCircle,
  X,
  Shield,
  Clock,
} from 'lucide-react';
import { UserService, SplUser, UserRole, CreateUserInput, UpdateUserInput } from '../../services/userService';
import { SecurityService, SECURITY_QUESTIONS } from '../../services/securityService';
import { AuthService } from '../../services/authService';
import { sportsAudio } from '../../context/TournamentContext';

export const UserManagementView: React.FC = () => {
  const [users, setUsers] = useState<SplUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<SplUser | null>(null);
  const [resettingUser, setResettingUser] = useState<SplUser | null>(null);
  const [deletingUser, setDeletingUser] = useState<SplUser | null>(null);
  const [statusToggleUser, setStatusToggleUser] = useState<SplUser | null>(null);

  // Form notifications
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const currentUser = AuthService.getCurrentUser();
  const currentUserId = currentUser?.id || 'admin-spl-master-01';

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const loadUsers = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const data = await UserService.fetchUsers();
      setUsers(data);
    } catch {
      showToast('Failed to load users from database', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();

    // Subscribe to live changes on admin_users table in Supabase
    const unsubscribe = UserService.subscribeToUserChanges(() => {
      loadUsers(true);
    });

    return () => {
      unsubscribe();
    };
  }, [loadUsers]);

  // Metrics
  const stats = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => u.isActive).length;
    const inactive = users.filter((u) => !u.isActive).length;
    const scorers = users.filter((u) => u.role === 'scorer').length;
    const superAdmins = users.filter((u) => u.role === 'super_admin').length;
    return { total, active, inactive, scorers, superAdmins };
  }, [users]);

  // Filtered users
  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      // Role filter
      if (roleFilter !== 'all' && user.role !== roleFilter) return false;

      // Status filter
      if (statusFilter === 'active' && !user.isActive) return false;
      if (statusFilter === 'inactive' && user.isActive) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = user.name.toLowerCase().includes(q);
        const matchEmail = user.email.toLowerCase().includes(q);
        const matchUsername = user.username.toLowerCase().includes(q);
        const matchMobile = user.mobile ? user.mobile.includes(q) : false;
        if (!matchName && !matchEmail && !matchUsername && !matchMobile) return false;
      }

      return true;
    });
  }, [users, roleFilter, statusFilter, searchQuery]);

  // Handle status toggle (Activate / Deactivate)
  const handleConfirmToggleStatus = async () => {
    if (!statusToggleUser) return;
    try {
      const newStatus = !statusToggleUser.isActive;
      const res = await UserService.updateUser(
        statusToggleUser.id,
        { isActive: newStatus },
        currentUserId
      );

      if (res.success) {
        showToast(
          `User ${statusToggleUser.name} is now ${newStatus ? 'Activated' : 'Deactivated'}`,
          'success'
        );
        sportsAudio.playButtonClick();
        await loadUsers(true);
      } else {
        showToast(res.error || 'Failed to update user status', 'error');
      }
    } catch {
      showToast('An unexpected error occurred', 'error');
    } finally {
      setStatusToggleUser(null);
    }
  };

  // Handle user deletion
  const handleConfirmDelete = async () => {
    if (!deletingUser) return;
    try {
      const res = await UserService.deleteUser(deletingUser.id, currentUserId);
      if (res.success) {
        showToast(`User ${deletingUser.name} deleted successfully`, 'success');
        sportsAudio.playTrash();
        await loadUsers(true);
      } else {
        showToast(res.error || 'Failed to delete user', 'error');
      }
    } catch {
      showToast('An unexpected error occurred while deleting user', 'error');
    } finally {
      setDeletingUser(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border text-sm font-semibold animate-fade-in ${
            toastMessage.type === 'success'
              ? 'bg-emerald-950/90 text-emerald-200 border-emerald-500/40'
              : 'bg-rose-950/90 text-rose-200 border-rose-500/40'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="text-white/60 hover:text-white ml-2 text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-slate-900/60 border border-white/10 backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-amber-400/15 border border-amber-400/30 text-amber-400">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black font-display tracking-tight text-white uppercase">
                User Management & Roles
              </h1>
              <p className="text-xs text-slate-400">
                Manage Super Admins and Score Operators with real-time Supabase PostgreSQL persistence
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => loadUsers(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-slate-300 transition-colors disabled:opacity-50"
            title="Refresh Users"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-amber-400' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs shadow-lg shadow-amber-400/20 transition-all hover:scale-[1.02]"
          >
            <UserPlus className="w-4 h-4" />
            <span>Create New User</span>
          </button>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Users */}
        <div className="p-4 rounded-2xl bg-slate-900/40 border border-white/5 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Users</p>
            <p className="text-2xl sm:text-3xl font-black font-display text-white mt-1">{stats.total}</p>
          </div>
          <div className="p-3 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Users className="w-5 h-5" />
          </div>
        </div>

        {/* Active Accounts */}
        <div className="p-4 rounded-2xl bg-slate-900/40 border border-white/5 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Active Accounts</p>
            <p className="text-2xl sm:text-3xl font-black font-display text-emerald-400 mt-1">{stats.active}</p>
          </div>
          <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        {/* Score Operators */}
        <div className="p-4 rounded-2xl bg-slate-900/40 border border-white/5 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Score Operators</p>
            <p className="text-2xl sm:text-3xl font-black font-display text-cyan-400 mt-1">{stats.scorers}</p>
          </div>
          <div className="p-3 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <Activity className="w-5 h-5" />
          </div>
        </div>

        {/* Inactive / Suspended */}
        <div className="p-4 rounded-2xl bg-slate-900/40 border border-white/5 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Inactive Users</p>
            <p className="text-2xl sm:text-3xl font-black font-display text-amber-400 mt-1">{stats.inactive}</p>
          </div>
          <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <XCircle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Role Explainer Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-slate-900/60 to-cyan-500/10 border border-white/10 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-amber-400/20 text-amber-400 shrink-0 mt-0.5">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-amber-300 uppercase tracking-wide">Super Admin</h3>
            <p className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">
              Complete tournament control: customize registration, generate shareable links, manage teams & players, complete matches, and administer user accounts.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-cyan-400/20 text-cyan-400 shrink-0 mt-0.5">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-cyan-300 uppercase tracking-wide">Score Operator (Normal User)</h3>
            <p className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">
              Focused court-side operator: quick live score controls (+1/-1 points, sets) and read-only player directory with masked private phone numbers.
            </p>
          </div>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="p-4 rounded-2xl bg-slate-900/40 border border-white/5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, email, username or mobile..."
            className="w-full pl-10 pr-4 py-2 bg-slate-950/80 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Role Filter */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950/80 border border-white/10 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as any)}
              className="bg-transparent text-slate-200 focus:outline-none text-xs cursor-pointer"
            >
              <option value="all" className="bg-slate-900">All Roles</option>
              <option value="super_admin" className="bg-slate-900">Super Admins</option>
              <option value="scorer" className="bg-slate-900">Score Operators</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950/80 border border-white/10 text-xs">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-transparent text-slate-200 focus:outline-none text-xs cursor-pointer"
            >
              <option value="all" className="bg-slate-900">All Status</option>
              <option value="active" className="bg-slate-900">Active Only</option>
              <option value="inactive" className="bg-slate-900">Inactive Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="rounded-2xl bg-slate-900/40 border border-white/10 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-amber-400 animate-spin mx-auto" />
            <p className="text-xs text-slate-400">Loading user accounts from Supabase...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <Users className="w-10 h-10 text-slate-600 mx-auto" />
            <p className="text-sm font-semibold text-slate-300">No users found</p>
            <p className="text-xs text-slate-500">
              {searchQuery ? 'Try adjusting your search criteria' : 'Create a new user to grant access to the scoreboard'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/5 border-b border-white/10 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3.5 px-4">User Details</th>
                  <th className="py-3.5 px-4">Role</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Contact & DOB</th>
                  <th className="py-3.5 px-4">Account Security</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredUsers.map((user) => {
                  const isMasterAdmin = user.id === 'admin-spl-master-01' || user.username === 'admin';
                  const isCurrent = user.id === currentUserId;

                  return (
                    <tr key={user.id} className="hover:bg-white/[0.02] transition-colors">
                      {/* Name & Email */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400/20 to-lime-500/20 border border-amber-400/30 flex items-center justify-center font-bold text-amber-400 text-sm shrink-0">
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white text-sm">{user.name}</span>
                              {isMasterAdmin && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-amber-400/20 text-amber-400 border border-amber-400/30">
                                  Master
                                </span>
                              )}
                              {isCurrent && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-lime-400/20 text-lime-400">
                                  You
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-slate-400 text-[11px] mt-0.5">
                              <span className="font-mono text-slate-300">@{user.username}</span>
                              <span>•</span>
                              <span>{user.email}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Role Badge */}
                      <td className="py-4 px-4">
                        {user.role === 'super_admin' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>Super Admin</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                            <Activity className="w-3.5 h-3.5" />
                            <span>Score Operator</span>
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4">
                        {user.isActive ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            <span>Active</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                            <span>Inactive</span>
                          </span>
                        )}
                      </td>

                      {/* Contact & DOB */}
                      <td className="py-4 px-4 text-slate-300">
                        <div className="space-y-0.5 text-[11px]">
                          {user.mobile && (
                            <div className="flex items-center gap-1 text-slate-400">
                              <Phone className="w-3 h-3 text-slate-500" />
                              <span>{user.mobile}</span>
                            </div>
                          )}
                          {user.dob ? (
                            <div className="flex items-center gap-1 text-slate-400">
                              <Calendar className="w-3 h-3 text-slate-500" />
                              <span>DOB: {user.dob}</span>
                            </div>
                          ) : (
                            <span className="text-slate-600 italic">No DOB set</span>
                          )}
                        </div>
                      </td>

                      {/* Account Security */}
                      <td className="py-4 px-4">
                        <div className="space-y-1">
                          {user.securityQuestion ? (
                            <div className="inline-flex items-center gap-1 text-[11px] text-emerald-400">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Recovery Configured</span>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1 text-[11px] text-amber-400/80">
                              <HelpCircle className="w-3 h-3" />
                              <span>Recovery Pending</span>
                            </div>
                          )}
                          <p className="text-[10px] text-slate-500">
                            Added: {new Date(user.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Edit user details */}
                          <button
                            type="button"
                            onClick={() => setEditingUser(user)}
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
                            title="Edit User"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Admin Reset Password */}
                          <button
                            type="button"
                            onClick={() => setResettingUser(user)}
                            className="p-1.5 rounded-lg bg-amber-400/10 hover:bg-amber-400/20 text-amber-400 border border-amber-400/20 transition-colors"
                            title="Reset Password"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                          </button>

                          {/* Toggle Active / Inactive */}
                          {!isMasterAdmin && !isCurrent && (
                            <button
                              type="button"
                              onClick={() => setStatusToggleUser(user)}
                              className={`p-1.5 rounded-lg border transition-colors ${
                                user.isActive
                                  ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border-rose-500/20'
                                  : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/20'
                              }`}
                              title={user.isActive ? 'Deactivate Account' : 'Activate Account'}
                            >
                              <Power className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Delete */}
                          {!isMasterAdmin && !isCurrent && (
                            <button
                              type="button"
                              onClick={() => setDeletingUser(user)}
                              className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-colors"
                              title="Delete User"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE USER MODAL */}
      {isCreateModalOpen && (
        <CreateUserModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={() => {
            setIsCreateModalOpen(false);
            showToast('User created successfully and synchronized with Supabase!', 'success');
            loadUsers(true);
          }}
          operatorId={currentUserId}
        />
      )}

      {/* EDIT USER MODAL */}
      {editingUser && (
        <EditUserModal
          user={editingUser}
          isOpen={Boolean(editingUser)}
          onClose={() => setEditingUser(null)}
          onSuccess={() => {
            setEditingUser(null);
            showToast('User updated successfully', 'success');
            loadUsers(true);
          }}
          operatorId={currentUserId}
        />
      )}

      {/* ADMIN RESET PASSWORD MODAL */}
      {resettingUser && (
        <AdminResetPasswordModal
          user={resettingUser}
          isOpen={Boolean(resettingUser)}
          onClose={() => setResettingUser(null)}
          onSuccess={() => {
            setResettingUser(null);
            showToast(`Password updated for ${resettingUser.name}`, 'success');
          }}
        />
      )}

      {/* TOGGLE STATUS CONFIRMATION MODAL */}
      {statusToggleUser && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-white/10 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div
                className={`p-3 rounded-xl ${
                  statusToggleUser.isActive ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'
                }`}
              >
                <Power className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  {statusToggleUser.isActive ? 'Deactivate User Account?' : 'Activate User Account?'}
                </h3>
                <p className="text-xs text-slate-400">{statusToggleUser.name} ({statusToggleUser.email})</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              {statusToggleUser.isActive
                ? 'Deactivating this user will revoke their login access to the scoreboard and tournament system immediately across all sessions.'
                : 'Activating this account will restore access and allow them to sign in and record scores.'}
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStatusToggleUser(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-white/5 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmToggleStatus}
                className={`px-4 py-2 text-xs font-bold rounded-xl transition-colors ${
                  statusToggleUser.isActive
                    ? 'bg-rose-500 hover:bg-rose-600 text-white'
                    : 'bg-emerald-500 hover:bg-emerald-600 text-white'
                }`}
              >
                {statusToggleUser.isActive ? 'Deactivate Account' : 'Activate Account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingUser && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-rose-500/30 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-rose-500/20 text-rose-400">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Permanently Delete User?</h3>
                <p className="text-xs text-slate-400">{deletingUser.name} ({deletingUser.email})</p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 leading-relaxed">
              This action cannot be undone. All credentials and permissions for this user will be purged from the Supabase PostgreSQL database.
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingUser(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-white/5 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30 transition-colors"
              >
                Yes, Delete User
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* =========================================================================
 * 1. CREATE USER MODAL COMPONENT
 * ========================================================================= */
interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  operatorId: string;
}

const CreateUserModal: React.FC<CreateUserModalProps> = ({ isOpen, onClose, onSuccess, operatorId }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [mobile, setMobile] = useState('');
  const [role, setRole] = useState<UserRole>('scorer');
  const [temporaryPassword, setTemporaryPassword] = useState('Spl@2026!');
  const [showPassword, setShowPassword] = useState(false);
  const [dob, setDob] = useState('1998-05-15');
  const [securityQuestion, setSecurityQuestion] = useState<string>(SECURITY_QUESTIONS[0]);
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGeneratePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    let res = 'Spl@';
    for (let i = 0; i < 6; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setTemporaryPassword(res);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const input: CreateUserInput = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        username: username.trim() || undefined,
        mobile: mobile.trim() || undefined,
        role,
        temporaryPassword,
        dob: dob.trim() || undefined,
        securityQuestion,
        securityAnswer: securityAnswer.trim() || undefined,
        isActive: true,
      };

      const res = await UserService.createUser(input, operatorId);
      if (res.success) {
        sportsAudio.playFanfare();
        onSuccess();
      } else {
        setError(res.error || 'Failed to create user');
      }
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-xl rounded-3xl bg-slate-900 border border-white/10 p-6 sm:p-8 space-y-6 my-8">
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-amber-400/20 text-amber-400">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black font-display text-white uppercase">Create New User</h2>
              <p className="text-xs text-slate-400">Add an administrator or live score operator</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Full Name */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                Full Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!username && e.target.value) {
                    setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''));
                  }
                }}
                placeholder="e.g. Ramesh Kumar"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
              />
            </div>

            {/* Email Address */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                Email Address *
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="scorer@spl.com"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Mobile Number */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                Mobile Number
              </label>
              <input
                type="tel"
                value={mobile}
                onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="10-digit mobile number"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
              />
            </div>

            {/* Role Selector */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                Role & Permissions *
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-amber-400"
              >
                <option value="scorer">Score Operator (Normal User - Scoring Only)</option>
                <option value="super_admin">Super Admin (Full Tournament Access)</option>
              </select>
            </div>
          </div>

          {/* Initial Password with Generator */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                Temporary Password *
              </label>
              <button
                type="button"
                onClick={handleGeneratePassword}
                className="text-[11px] font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1"
              >
                <Sparkles className="w-3 h-3" />
                <span>Auto-Generate</span>
              </button>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={temporaryPassword}
                onChange={(e) => setTemporaryPassword(e.target.value)}
                placeholder="Enter initial password"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[10px] text-slate-400">
              Share this password with the operator. They can update it in "My Account".
            </p>
          </div>

          {/* Account Recovery Fields */}
          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
              <Shield className="w-4 h-4" />
              <span>Self-Service Recovery Information (Optional)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-[11px] text-slate-400">Date of Birth (YYYY-MM-DD)</label>
                <input
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] text-slate-400">Security Question</label>
                <select
                  value={securityQuestion}
                  onChange={(e) => setSecurityQuestion(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-amber-400 truncate"
                >
                  {SECURITY_QUESTIONS.map((q: string) => (
                    <option key={q} value={q}>
                      {q}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] text-slate-400">Security Answer</label>
              <input
                type="text"
                value={securityAnswer}
                onChange={(e) => setSecurityAnswer(e.target.value)}
                placeholder="Secret answer (hashed with salted SHA-256)"
                className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 transition-all flex items-center gap-2 shadow-lg shadow-amber-400/20"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              <span>{loading ? 'Creating...' : 'Create User Account'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* =========================================================================
 * 2. EDIT USER MODAL COMPONENT
 * ========================================================================= */
interface EditUserModalProps {
  user: SplUser;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  operatorId: string;
}

const EditUserModal: React.FC<EditUserModalProps> = ({ user, isOpen, onClose, onSuccess, operatorId }) => {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [mobile, setMobile] = useState(user.mobile || '');
  const [role, setRole] = useState<UserRole>(user.role);
  const [isActive, setIsActive] = useState<boolean>(user.isActive);
  const [dob, setDob] = useState(user.dob || '');
  const [securityQuestion, setSecurityQuestion] = useState(user.securityQuestion || SECURITY_QUESTIONS[0]);
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const isMasterAdmin = user.id === 'admin-spl-master-01' || user.username === 'admin';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const updates: UpdateUserInput = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        mobile: mobile.trim() || undefined,
        role: isMasterAdmin ? 'super_admin' : role,
        isActive: isMasterAdmin ? true : isActive,
        dob: dob.trim() || undefined,
        securityQuestion,
        securityAnswer: securityAnswer.trim() || undefined,
      };

      const res = await UserService.updateUser(user.id, updates, operatorId);
      if (res.success) {
        sportsAudio.playButtonClick();
        onSuccess();
      } else {
        setError(res.error || 'Failed to update user');
      }
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-lg rounded-3xl bg-slate-900 border border-white/10 p-6 sm:p-8 space-y-6 my-8">
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-amber-400/20 text-amber-400">
              <Edit2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black font-display text-white uppercase">Edit User Account</h2>
              <p className="text-xs text-slate-400">{user.name} (@{user.username})</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
              Full Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-amber-400"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                Email Address *
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                Mobile Number
              </label>
              <input
                type="tel"
                value={mobile}
                onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                className="w-full px-3.5 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                Role & Permissions
              </label>
              <select
                disabled={isMasterAdmin}
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="w-full px-3.5 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-amber-400 disabled:opacity-50"
              >
                <option value="scorer">Score Operator</option>
                <option value="super_admin">Super Admin</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                Account Status
              </label>
              <select
                disabled={isMasterAdmin}
                value={isActive ? 'active' : 'inactive'}
                onChange={(e) => setIsActive(e.target.value === 'active')}
                className="w-full px-3.5 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-amber-400 disabled:opacity-50"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          {/* Recovery updates */}
          <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 space-y-3">
            <p className="text-xs font-bold text-slate-300">Security & Recovery Updates</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-slate-400">Date of Birth</label>
                <input
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400">Security Question</label>
                <select
                  value={securityQuestion}
                  onChange={(e) => setSecurityQuestion(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:outline-none truncate"
                >
                  {SECURITY_QUESTIONS.map((q: string) => (
                    <option key={q} value={q}>
                      {q}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] text-slate-400">New Security Answer (Leave blank to keep current)</label>
              <input
                type="text"
                value={securityAnswer}
                onChange={(e) => setSecurityAnswer(e.target.value)}
                placeholder="Leave blank to preserve existing answer"
                className="w-full px-3 py-1.5 bg-slate-950 border border-white/10 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 transition-all flex items-center gap-2"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              <span>{loading ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* =========================================================================
 * 3. ADMIN RESET PASSWORD MODAL
 * ========================================================================= */
interface AdminResetPasswordModalProps {
  user: SplUser;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const AdminResetPasswordModal: React.FC<AdminResetPasswordModalProps> = ({
  user,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [newPassword, setNewPassword] = useState('Spl@' + Math.floor(100000 + Math.random() * 900000));
  const [showPassword, setShowPassword] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGenerate = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    let res = 'Spl@';
    for (let i = 0; i < 6; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(res);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await UserService.adminResetUserPassword(user.id, newPassword);
      if (res.success) {
        sportsAudio.playFanfare();
        onSuccess();
      } else {
        setError(res.error || 'Failed to update password');
      }
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-white/10 p-6 space-y-5">
        <div className="flex items-center justify-between pb-2 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-amber-400/20 text-amber-400">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Reset User Password</h2>
              <p className="text-xs text-slate-400">{user.name} ({user.email})</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                New Password
              </label>
              <button
                type="button"
                onClick={handleGenerate}
                className="text-[11px] font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1"
              >
                <Sparkles className="w-3 h-3" />
                <span>Generate Random</span>
              </button>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-amber-400 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              Minimum 6 characters. Be sure to securely communicate this temporary password to the user.
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white bg-white/5 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-xl disabled:opacity-50 transition-all flex items-center gap-2"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
              <span>{loading ? 'Updating...' : 'Set New Password'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
