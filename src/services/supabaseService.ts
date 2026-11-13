import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  Player,
  Team,
  Match,
  KnockoutMatch,
  Registration,
  RegistrationFormConfig,
  RegistrationTokenRecord,
  PaymentStatus,
  StandingsRecord,
  TournamentSettings,
  PaymentSettings,
} from '../types/tournament';
import { createDefaultFormConfig } from '../utils/tournamentEngine';
import {
  DbPlayer,
  DbTeam,
  DbMatch,
  DbRegistration,
  DbRegistrationFormConfig,
  DbRegistrationToken,
} from '../types/database.types';

export class SupabaseService {
  static isAvailable(): boolean {
    return isSupabaseConfigured();
  }

  // ============================================================================
  // 1. PLAYERS
  // ============================================================================
  static async fetchPlayers(): Promise<Player[] | null> {
    if (!this.isAvailable()) return null;
    try {
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .order('name', { ascending: true });

      if (error || !data) return null;

      return (data as DbPlayer[]).map((p: any) => ({
        id: p.id,
        name: p.name,
        mobile: p.mobile || undefined,
        age: p.age || undefined,
        gender: p.gender,
        skillLevel: p.skill_level === 'Pro' ? 'Pro' : p.skill_level === 'Intermediate' ? 'Intermediate' : 'Advanced',
        photoUrl: p.photo_url || undefined,
        registrationStatus: p.registration_status || 'direct',
        registrationId: p.registration_id || undefined,
        city: p.city || undefined,
        category: p.category || undefined,
        style: p.style || undefined,
      }));
    } catch {
      return null;
    }
  }

  static async upsertPlayer(player: Player): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      const payload: Record<string, any> = {
        id: player.id,
        name: player.name.trim(),
        mobile: player.mobile ? String(player.mobile).trim() : null,
        age: player.age ? Number(player.age) : null,
        gender: player.gender || 'M',
        skill_level: player.skillLevel === 'Pro' ? 'Pro' : player.skillLevel === 'Intermediate' ? 'Intermediate' : 'Advanced',
        photo_url: player.photoUrl || null,
        status: 'active',
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('players').upsert(payload as any);
      if (error) {
        console.error('Supabase upsertPlayer error:', error.message);
        return false;
      }
      return true;
    } catch (e: any) {
      console.error('Supabase upsertPlayer exception:', e?.message);
      return false;
    }
  }

  static async upsertPlayersBulk(players: Player[]): Promise<boolean> {
    if (!this.isAvailable() || players.length === 0) return false;
    try {
      const rows = players.map((player) => ({
        id: player.id,
        name: player.name.trim(),
        mobile: player.mobile ? String(player.mobile).trim() : null,
        age: player.age ? Number(player.age) : null,
        gender: player.gender || 'M',
        skill_level: player.skillLevel === 'Pro' ? 'Pro' : player.skillLevel === 'Intermediate' ? 'Intermediate' : 'Advanced',
        photo_url: player.photoUrl || null,
        status: 'active',
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase.from('players').upsert(rows as any);
      if (error) {
        console.error('Supabase upsertPlayersBulk error:', error.message);
        return false;
      }
      return true;
    } catch (e: any) {
      console.error('Supabase upsertPlayersBulk exception:', e?.message);
      return false;
    }
  }

  static async deletePlayer(id: string): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      // 1. Remove captaincy references to prevent FK violation
      await (supabase.from('teams') as any).update({ captain_id: null }).eq('captain_id', id);
      // 2. Remove from roster junction
      await supabase.from('team_players').delete().eq('player_id', id);
      // 3. Delete player
      const { error } = await supabase.from('players').delete().eq('id', id);
      if (error) {
        console.error('Supabase deletePlayer error:', error.message);
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  static async deletePlayersBulk(ids: string[]): Promise<boolean> {
    if (!this.isAvailable() || ids.length === 0) return false;
    try {
      // 1. Remove captaincy references
      await (supabase.from('teams') as any).update({ captain_id: null }).in('captain_id', ids);
      // 2. Remove roster assignments
      await supabase.from('team_players').delete().in('player_id', ids);
      // 3. Bulk delete players
      const { error } = await supabase.from('players').delete().in('id', ids);
      if (error) {
        console.error('Supabase deletePlayersBulk error:', error.message);
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  static async clearPlayers(): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      await (supabase.from('teams') as any).update({ captain_id: null }).neq('id', '___none___');
      await supabase.from('team_players').delete().neq('id', '___none___');
      const { error } = await supabase.from('players').delete().neq('id', '___none___');
      return !error;
    } catch {
      return false;
    }
  }

  private static encodeShortName(token?: string, lockedPlayerIds?: string[]): string | null {
    const cleanLocked = Array.from(new Set((lockedPlayerIds || []).filter(Boolean)));
    if (cleanLocked.length > 0) {
      return `${token || ''}::LOCKED:${cleanLocked.join(',')}`;
    }
    return token || null;
  }

  static decodeShortName(shortName?: string | null): {
    token?: string;
    lockedPlayerIds: string[];
  } {
    if (!shortName) return { token: undefined, lockedPlayerIds: [] };
    if (shortName.includes('::LOCKED:')) {
      const [tokPart, lockedPart] = shortName.split('::LOCKED:');
      return {
        token: tokPart ? tokPart : undefined,
        lockedPlayerIds: lockedPart ? lockedPart.split(',').filter(Boolean) : [],
      };
    }
    return { token: shortName, lockedPlayerIds: [] };
  }

  // ============================================================================
  // 2. TEAMS & ROSTERS
  // ============================================================================
  static async fetchTeams(): Promise<Team[] | null> {
    if (!this.isAvailable()) return null;
    try {
      const { data: teamsData, error: teamsErr } = await supabase
        .from('teams')
        .select('*')
        .order('created_at', { ascending: true });

      if (teamsErr || !teamsData) return null;

      const { data: rostersData } = await supabase
        .from('team_players')
        .select('*')
        .order('slot_index', { ascending: true });

      const rosterMap = new Map<string, string[]>();
      if (rostersData) {
        for (const item of rostersData as any[]) {
          const list = rosterMap.get(item.team_id) || [];
          list.push(item.player_id);
          rosterMap.set(item.team_id, list);
        }
      }

      const seenIds = new Set<string>();
      const uniqueTeams: Team[] = [];
      for (const t of teamsData as DbTeam[]) {
        if (!t.id || seenIds.has(t.id)) continue;
        seenIds.add(t.id);
        const decoded = this.decodeShortName(t.short_name);
        uniqueTeams.push({
          id: t.id,
          name: t.name,
          token: decoded.token,
          lockedPlayerIds: decoded.lockedPlayerIds,
          captainId: t.captain_id || undefined,
          avatarColor: t.avatar_color || 'from-amber-500 to-orange-600',
          badge: t.badge || '🏸',
          locked: t.locked,
          players: rosterMap.get(t.id) || [],
        });
      }
      return uniqueTeams;
    } catch {
      return null;
    }
  }

  static async updateTeamMetadata(
    id: string,
    updates: Partial<Team>,
    fallbackTeam?: Team
  ): Promise<boolean> {
    if (!this.isAvailable() || !id) return false;
    try {
      const patchPayload: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      if (updates.name !== undefined) {
        patchPayload.name = updates.name.trim() || fallbackTeam?.name || 'Team';
      }
      if (updates.badge !== undefined) {
        patchPayload.badge = updates.badge || '🏸';
      }
      if (updates.avatarColor !== undefined) {
        patchPayload.avatar_color = updates.avatarColor || 'from-amber-500 to-orange-600';
      }
      if (updates.locked !== undefined) {
        patchPayload.locked = Boolean(updates.locked);
      }
      if (updates.captainId !== undefined) {
        patchPayload.captain_id = updates.captainId || null;
      }
      if (updates.token !== undefined || updates.lockedPlayerIds !== undefined) {
        const nextToken = updates.token !== undefined ? updates.token : fallbackTeam?.token;
        const nextLockedPlayers =
          updates.lockedPlayerIds !== undefined
            ? updates.lockedPlayerIds
            : fallbackTeam?.lockedPlayerIds;
        patchPayload.short_name = this.encodeShortName(nextToken, nextLockedPlayers);
      }

      let { data: updatedRows, error } = await (supabase.from('teams') as any)
        .update(patchPayload)
        .eq('id', id)
        .select('id');

      // Retry without captain_id if foreign key reference is not yet synced in players
      if (error && patchPayload.captain_id) {
        const retryRes = await (supabase.from('teams') as any)
          .update({ ...patchPayload, captain_id: null })
          .eq('id', id)
          .select('id');
        updatedRows = retryRes.data;
        error = retryRes.error;
      }

      if (error) {
        console.error('Supabase updateTeamMetadata error:', error.message);
      }

      // If the team row does not exist yet in Supabase, upsert the full team record safely
      if ((!updatedRows || updatedRows.length === 0) && fallbackTeam) {
        return await this.saveTeam({ ...fallbackTeam, ...updates, id });
      }

      // Only touch team_players if roster array was explicitly included in updates
      if (updates.players !== undefined) {
        await supabase.from('team_players').delete().eq('team_id', id);
        if (updates.players.length > 0) {
          const uniquePlayers = Array.from(new Set(updates.players.filter(Boolean)));
          const effectiveCaptain =
            updates.captainId !== undefined ? updates.captainId : fallbackTeam?.captainId;
          const rows = uniquePlayers.map((playerId, idx) => ({
            team_id: id,
            player_id: playerId,
            slot_index: idx,
            is_captain: effectiveCaptain === playerId,
          }));
          await supabase.from('team_players').insert(rows as any);
        }
      }

      return !error && Boolean(updatedRows && updatedRows.length > 0);
    } catch {
      return false;
    }
  }

  static async saveTeam(team: Team): Promise<boolean> {
    if (!this.isAvailable() || !team?.id) return false;
    try {
      const teamPayload = {
        id: team.id,
        name: team.name,
        short_name: this.encodeShortName(team.token, team.lockedPlayerIds),
        captain_id: team.captainId || null,
        avatar_color: team.avatarColor || 'from-amber-500 to-orange-600',
        badge: team.badge || '🏸',
        locked: Boolean(team.locked),
        updated_at: new Date().toISOString(),
      };

      let { error } = await supabase
        .from('teams')
        .upsert(teamPayload as any, { onConflict: 'id' });

      // Fallback if captain_id foreign key fails because player record is not in public.players yet
      if (error && teamPayload.captain_id) {
        const retry = await supabase
          .from('teams')
          .upsert({ ...teamPayload, captain_id: null } as any, { onConflict: 'id' });
        error = retry.error;
      }

      if (error) {
        console.error('Supabase saveTeam error:', error.message);
        return false;
      }

      // Replace roster junction
      await supabase.from('team_players').delete().eq('team_id', team.id);

      if (team.players && team.players.length > 0) {
        const uniquePlayers = Array.from(new Set(team.players.filter(Boolean)));
        const rows = uniquePlayers.map((playerId, idx) => ({
          team_id: team.id,
          player_id: playerId,
          slot_index: idx,
          is_captain: team.captainId === playerId,
        }));
        await supabase.from('team_players').insert(rows as any);
      }
      return true;
    } catch {
      return false;
    }
  }

  static async saveTeamsBulk(teams: Team[]): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      // Deduplicate by team.id to strictly prevent duplicate records
      const uniqueMap = new Map<string, Team>();
      for (const t of teams) {
        if (t && t.id) {
          uniqueMap.set(t.id, t);
        }
      }
      const uniqueTeams = Array.from(uniqueMap.values());
      if (uniqueTeams.length === 0) {
        await supabase.from('team_players').delete().neq('id', '___none___');
        await supabase.from('teams').delete().neq('id', '___none___');
        return true;
      }

      const keepIds = uniqueTeams.map((t) => t.id);
      const keepIdSet = new Set(keepIds);
      const nowIso = new Date().toISOString();

      const teamPayloads = uniqueTeams.map((team) => ({
        id: team.id,
        name: team.name,
        short_name: this.encodeShortName(team.token, team.lockedPlayerIds),
        captain_id: team.captainId || null,
        avatar_color: team.avatarColor || 'from-amber-500 to-orange-600',
        badge: team.badge || '🏸',
        locked: Boolean(team.locked),
        updated_at: nowIso,
      }));

      // Build all team_players rows in a single flat array
      const allRosterRows: {
        team_id: string;
        player_id: string;
        slot_index: number;
        is_captain: boolean;
      }[] = [];

      for (const t of uniqueTeams) {
        if (t.players && t.players.length > 0) {
          const uniquePlayers = Array.from(new Set(t.players.filter(Boolean)));
          uniquePlayers.forEach((playerId, idx) => {
            allRosterRows.push({
              team_id: t.id,
              player_id: playerId,
              slot_index: idx,
              is_captain: t.captainId === playerId,
            });
          });
        }
      }

      // Run team upsert and existing ID check in parallel
      const [upsertRes, { data: existingRows }] = await Promise.all([
        supabase.from('teams').upsert(teamPayloads as any, { onConflict: 'id' }),
        supabase.from('teams').select('id'),
      ]);

      if (upsertRes.error) {
        // Retry with captain_id nulled on FK mismatch so every team row and badge still saves
        const safeTeamPayloads = teamPayloads.map((tp) => ({ ...tp, captain_id: null }));
        await supabase.from('teams').upsert(safeTeamPayloads as any, { onConflict: 'id' });
      }

      // Replace all roster rows in 1 bulk delete + 1 bulk insert
      await supabase.from('team_players').delete().in('team_id', keepIds);
      if (allRosterRows.length > 0) {
        await supabase.from('team_players').insert(allRosterRows as any);
      }

      // Clean up any stale/orphan teams in background if present
      if (existingRows && existingRows.length > 0) {
        const orphanIds = existingRows
          .map((r: any) => String(r.id))
          .filter((id: string) => id && !keepIdSet.has(id));
        if (orphanIds.length > 0) {
          await supabase.from('team_players').delete().in('team_id', orphanIds);
          await supabase.from('teams').delete().in('id', orphanIds);
        }
      }

      return true;
    } catch {
      return false;
    }
  }

  static async deleteTeam(id: string): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      // First delete junction rows
      await supabase.from('team_players').delete().eq('team_id', id);
      const { error } = await supabase.from('teams').delete().eq('id', id);
      return !error;
    } catch {
      return false;
    }
  }

  static async deleteTeamsBulk(ids: string[]): Promise<boolean> {
    if (!this.isAvailable() || ids.length === 0) return false;
    try {
      await supabase.from('team_players').delete().in('team_id', ids);
      const { error } = await supabase.from('teams').delete().in('id', ids);
      return !error;
    } catch {
      return false;
    }
  }

  static async clearTeams(): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      await supabase.from('team_players').delete().neq('id', '___none___');
      const { error } = await supabase.from('teams').delete().neq('id', '___none___');
      return !error;
    } catch {
      return false;
    }
  }

  static async assignPlayerToTeam(teamId: string, playerId: string): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      // Remove any existing assignment for this player to prevent duplicates
      await supabase.from('team_players').delete().eq('player_id', playerId);
      // Query highest current slot_index in destination team
      const { data } = await supabase
        .from('team_players')
        .select('slot_index')
        .eq('team_id', teamId)
        .order('slot_index', { ascending: false })
        .limit(1);
      const nextSlot = data && data[0] ? ((data[0] as any).slot_index + 1) : 0;

      const { error } = await supabase.from('team_players').insert({
        team_id: teamId,
        player_id: playerId,
        slot_index: nextSlot,
        is_captain: false,
      } as any);

      return !error;
    } catch {
      return false;
    }
  }

  static async removePlayerFromTeam(teamId: string, playerId: string): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      const { error } = await supabase
        .from('team_players')
        .delete()
        .eq('team_id', teamId)
        .eq('player_id', playerId);
      return !error;
    } catch {
      return false;
    }
  }

  // ============================================================================
  // 3. MATCHES & REAL-TIME SCORES
  // ============================================================================
  static async fetchMatches(season = 'season-4'): Promise<{ matches: Match[]; knockout: KnockoutMatch[] } | null> {
    if (!this.isAvailable()) return null;
    try {
      const { data, error } = await supabase
        .from('matches')
        .select('*')
        .eq('tournament_season', season)
        .order('created_at', { ascending: true });

      if (error || !data) return null;

      const groupMatches: Match[] = [];
      const koMatches: KnockoutMatch[] = [];

      const stageOrder: Record<string, number> = { ELIM: 1, QF: 1, SF: 2, F: 3 };

      for (const m of data as DbMatch[]) {
        const normalizedStatus =
          (m.status as any) === 'paused' || m.status === 'postponed'
            ? 'paused'
            : m.status === 'live'
            ? 'live'
            : m.status === 'completed'
            ? 'completed'
            : 'upcoming';
        const parsedCourt =
          typeof m.court === 'number'
            ? m.court
            : parseInt(String(m.court || '').replace(/\D/g, '') || '1', 10) || 1;

        if (m.match_type === 'knockout') {
          koMatches.push({
            id: m.id,
            stage: (m.stage as any) || 'SF',
            slot: m.slot || 1,
            court: parsedCourt,
            time: m.time || undefined,
            teamA: m.team_a_id || undefined,
            teamB: m.team_b_id || undefined,
            scoreA: m.score_a != null ? m.score_a : undefined,
            scoreB: m.score_b != null ? m.score_b : undefined,
            status: normalizedStatus,
            winner: m.winner_id || undefined,
            sets: m.sets_json || undefined,
            mvpPlayerId: m.mvp_player_id || undefined,
          });
        } else {
          groupMatches.push({
            id: m.id,
            round: m.round,
            court: parsedCourt,
            teamA: m.team_a_id || '',
            teamB: m.team_b_id || '',
            scoreA: m.score_a != null ? m.score_a : undefined,
            scoreB: m.score_b != null ? m.score_b : undefined,
            status: normalizedStatus,
            winner: m.winner_id || undefined,
            time: m.time || undefined,
            sets: m.sets_json || undefined,
            mvpPlayerId: m.mvp_player_id || undefined,
          });
        }
      }

      koMatches.sort((a, b) => {
        const sa = stageOrder[a.stage] ?? 9;
        const sb = stageOrder[b.stage] ?? 9;
        if (sa !== sb) return sa - sb;
        return (a.slot || 1) - (b.slot || 1);
      });

      return { matches: groupMatches, knockout: koMatches };
    } catch {
      return null;
    }
  }

  // Per-match tail-coalescing write queue prevents out-of-order HTTP races on rapid +1/-1 clicks
  // while keeping independent courts running concurrently.
  private static matchScoreInFlight = new Set<string>();
  private static matchScorePending = new Map<
    string,
    { payload: Record<string, any>; season: string; resolvers: ((ok: boolean) => void)[] }
  >();

  private static async flushMatchScoreQueue(matchId: string): Promise<void> {
    if (this.matchScoreInFlight.has(matchId)) return;
    this.matchScoreInFlight.add(matchId);

    try {
      while (true) {
        const pending = this.matchScorePending.get(matchId);
        if (!pending) break;
        this.matchScorePending.delete(matchId);

        let success = false;
        try {
          const { error } = await supabase
            .from('matches')
            .upsert({ id: matchId, tournament_season: pending.season, ...pending.payload } as any);
          success = !error;
          if (error) {
            console.error('[SupabaseService] updateMatchScore failed:', error.message);
          }
        } catch (err) {
          console.error('[SupabaseService] updateMatchScore exception:', err);
          success = false;
        }

        for (const resolve of pending.resolvers) {
          resolve(success);
        }
      }
    } finally {
      this.matchScoreInFlight.delete(matchId);
      // Guard against a write queued right before finally ran
      if (this.matchScorePending.has(matchId)) {
        void this.flushMatchScoreQueue(matchId);
      }
    }
  }

  static async updateMatchScore(
    matchId: string,
    updates: Partial<Match | KnockoutMatch>,
    isKnockout = false,
    season = 'season-4'
  ): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      const payload: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      if ('scoreA' in updates) payload.score_a = updates.scoreA ?? null;
      if ('scoreB' in updates) payload.score_b = updates.scoreB ?? null;
      if (updates.status !== undefined) {
        // DB CHECK allows: 'upcoming', 'live', 'completed', 'postponed'
        payload.status = updates.status === 'paused' ? 'postponed' : updates.status;
      }
      if ('winner' in updates) payload.winner_id = updates.winner || null;
      if ('sets' in updates) payload.sets_json = updates.sets ?? null;
      if ('teamA' in updates) payload.team_a_id = updates.teamA || null;
      if ('teamB' in updates) payload.team_b_id = updates.teamB || null;
      if ('court' in updates && updates.court != null) {
        payload.court =
          typeof updates.court === 'number'
            ? updates.court
            : parseInt(String(updates.court).replace(/\D/g, '') || '1', 10) || 1;
      }
      if ('time' in updates) payload.time = updates.time || null;
      if ('mvpPlayerId' in updates) payload.mvp_player_id = updates.mvpPlayerId || null;
      if ('stage' in updates && (updates as any).stage) {
        const st = String((updates as any).stage);
        payload.stage = st === 'QF' ? 'ELIM' : st;
      }
      if ('slot' in updates && (updates as any).slot != null) payload.slot = (updates as any).slot;
      if (isKnockout) {
        payload.match_type = 'knockout';
        payload.round = 99;
      }

      return await new Promise<boolean>((resolve) => {
        const existing = this.matchScorePending.get(matchId);
        if (existing) {
          // Merge latest updates on top of pending write so the newest score always wins
          existing.payload = { ...existing.payload, ...payload };
          existing.season = season;
          existing.resolvers.push(resolve);
        } else {
          this.matchScorePending.set(matchId, {
            payload,
            season,
            resolvers: [resolve],
          });
        }
        void this.flushMatchScoreQueue(matchId);
      });
    } catch {
      return false;
    }
  }

  static async replaceSeasonMatches(
    newMatches: Match[],
    season = 'season-4',
    courtSettings?: { courts: number; courtNames?: string[] }
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.isAvailable()) return { success: true };
    try {
      // 1. Identify existing group matches to clear dependent match_scores
      const { data: existingMatches } = await supabase
        .from('matches')
        .select('id')
        .eq('tournament_season', season)
        .eq('match_type', 'group');

      const existingIds = (existingMatches || []).map((m: any) => m.id);

      // 2. Delete dependent match score rows
      if (existingIds.length > 0) {
        await supabase
          .from('match_scores')
          .delete()
          .in('match_id', existingIds);
      }

      // 3. Delete existing group matches
      const { error: delError } = await supabase
        .from('matches')
        .delete()
        .eq('tournament_season', season)
        .eq('match_type', 'group');

      if (delError) {
        console.error('Failed to delete existing matches in Supabase:', delError);
        return { success: false, error: delError.message };
      }

      // 4. Insert new matches
      if (newMatches.length > 0) {
        const rows = newMatches.map((m) => ({
          id: m.id,
          tournament_season: season,
          round: m.round,
          court: typeof m.court === 'number' ? m.court : parseInt(String(m.court || '').replace(/\D/g, '') || '1', 10),
          match_type: 'group' as const,
          slot: m.courtSlot || null,
          team_a_id: m.teamA || null,
          team_b_id: m.teamB || null,
          score_a: m.scoreA != null ? m.scoreA : null,
          score_b: m.scoreB != null ? m.scoreB : null,
          status: m.status || 'upcoming',
          winner_id: m.winner || null,
          time: m.time || (m.courtName ? `Round ${m.round} · ${m.courtName}` : `Round ${m.round} · Court ${m.court}`),
          sets_json: m.sets || null,
          mvp_player_id: m.mvpPlayerId || null,
          updated_at: new Date().toISOString(),
        }));

        const { error: insError } = await supabase.from('matches').insert(rows as any);
        if (insError) {
          console.error('Failed to insert new matches in Supabase:', insError);
          return { success: false, error: insError.message };
        }
      }

      // 5. Update court configuration in registration_form_config
      if (courtSettings) {
        const { data: currentForm } = await (supabase
          .from('registration_form_config') as any)
          .select('appearance_json')
          .eq('season_slug', season)
          .maybeSingle();

        const appearance = (currentForm as any)?.appearance_json || {};
        await (supabase
          .from('registration_form_config') as any)
          .update({
            appearance_json: {
              ...appearance,
              courts: courtSettings.courts,
              courtNames: courtSettings.courtNames,
            },
            updated_at: new Date().toISOString(),
          })
          .eq('season_slug', season);
      }

      await this.logAudit('matches_schedule_regenerated', 'matches', `Generated ${newMatches.length} matches with ${courtSettings?.courts || 1} courts`);
      return { success: true };
    } catch (err: any) {
      console.error('Exception in replaceSeasonMatches:', err);
      return { success: false, error: err?.message || 'Failed to replace match schedule' };
    }
  }

  static async batchSaveMatches(
    matches: Match[],
    season = 'season-4'
  ): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      const rows = matches.map((m) => ({
        id: m.id,
        tournament_season: season,
        round: m.round,
        court: typeof m.court === 'number' ? m.court : parseInt(String(m.court || '').replace(/\D/g, '') || '1', 10),
        match_type: 'group' as const,
        slot: m.courtSlot || null,
        team_a_id: m.teamA || null,
        team_b_id: m.teamB || null,
        score_a: m.scoreA != null ? m.scoreA : null,
        score_b: m.scoreB != null ? m.scoreB : null,
        status: m.status,
        winner_id: m.winner || null,
        time: m.time || null,
        sets_json: m.sets || null,
        mvp_player_id: m.mvpPlayerId || null,
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase.from('matches').upsert(rows as any);
      return !error;
    } catch {
      return false;
    }
  }

  static async deleteMatch(id: string): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      await supabase.from('match_scores').delete().eq('match_id', id);
      const { error } = await supabase.from('matches').delete().eq('id', id);
      return !error;
    } catch {
      return false;
    }
  }

  static async clearSeasonMatches(season = 'season-4'): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      const { data: existing } = await supabase
        .from('matches')
        .select('id')
        .eq('tournament_season', season)
        .eq('match_type', 'group');

      const ids = (existing || []).map((m: any) => m.id);
      if (ids.length > 0) {
        await supabase.from('match_scores').delete().in('match_id', ids);
      }
      const { error } = await supabase.from('matches').delete().eq('tournament_season', season).eq('match_type', 'group');
      return !error;
    } catch {
      return false;
    }
  }

  static async batchSaveKnockoutMatches(matches: KnockoutMatch[], season = 'season-4'): Promise<boolean> {
    if (!this.isAvailable() || matches.length === 0) return false;
    try {
      const rows = matches.map((m) => ({
        id: m.id,
        tournament_season: season,
        round: 99,
        court: typeof m.court === 'number' ? m.court : parseInt(String(m.court || '').replace(/\D/g, '') || '1', 10) || 1,
        match_type: 'knockout' as const,
        stage: (m.stage === 'QF' ? 'ELIM' : m.stage) || 'SF',
        slot: m.slot || 1,
        team_a_id: m.teamA || null,
        team_b_id: m.teamB || null,
        score_a: m.scoreA != null ? m.scoreA : null,
        score_b: m.scoreB != null ? m.scoreB : null,
        status: m.status === 'paused' ? 'postponed' : m.status || 'upcoming',
        winner_id: m.winner || null,
        time: m.time || null,
        sets_json: m.sets || null,
        mvp_player_id: m.mvpPlayerId || null,
        updated_at: new Date().toISOString(),
      }));
      const { error } = await supabase.from('matches').upsert(rows as any);
      return !error;
    } catch {
      return false;
    }
  }

  static async replaceKnockoutMatches(matches: KnockoutMatch[], season = 'season-4'): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      await this.clearKnockoutMatches(season);
      if (matches.length === 0) return true;
      return await this.batchSaveKnockoutMatches(matches, season);
    } catch {
      return false;
    }
  }

  static async clearKnockoutMatches(season = 'season-4'): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      const { data: existing } = await supabase
        .from('matches')
        .select('id')
        .eq('tournament_season', season)
        .eq('match_type', 'knockout');

      const ids = (existing || []).map((m: any) => m.id);
      if (ids.length > 0) {
        await supabase.from('match_scores').delete().in('match_id', ids);
      }
      const { error } = await supabase
        .from('matches')
        .delete()
        .eq('tournament_season', season)
        .eq('match_type', 'knockout');
      return !error;
    } catch {
      return false;
    }
  }

  static async recordScoreEvent(
    matchId: string,
    setNumber: number,
    scoreA: number,
    scoreB: number,
    isCompleted = false,
    winnerTeamId?: string,
    recordedBy = 'Umpire'
  ): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      const { error } = await supabase.from('match_scores').insert({
        match_id: matchId,
        set_number: setNumber,
        score_a: scoreA,
        score_b: scoreB,
        is_completed: isCompleted,
        winner_team_id: winnerTeamId || null,
        recorded_by: recordedBy,
        recorded_at: new Date().toISOString(),
      } as any);
      return !error;
    } catch {
      return false;
    }
  }

  // ============================================================================
  // 4. REGISTRATIONS & APPLICANTS
  // ============================================================================
  static async fetchRegistrations(season = 'all'): Promise<Registration[] | null> {
    if (!this.isAvailable()) return null;
    try {
      let query = supabase
        .from('registrations')
        .select('*')
        .order('created_at', { ascending: false });

      if (season && season !== 'all' && season !== 'any') {
        query = query.eq('season_slug', season);
      }

      const { data, error } = await query;

      if (error || !data) return null;

      return (data as DbRegistration[]).map((r) => ({
        id: r.id,
        regId: r.reg_id,
        playerId: r.player_id || undefined,
        name: r.name,
        mobile: r.mobile,
        whatsapp: r.whatsapp || undefined,
        age: r.age || undefined,
        gender: r.gender,
        experience: r.experience || undefined,
        category: r.category || undefined,
        style: r.style || undefined,
        city: r.city || undefined,
        notes: r.notes || undefined,
        fee: r.fee,
        status: r.status,
        paymentStatus: r.payment_status,
        method: r.method,
        txnId: r.txn_id || undefined,
        season: r.season_slug,
        createdAt: new Date(r.created_at).getTime(),
        paidAt: r.paid_at ? new Date(r.paid_at).getTime() : undefined,
        approvedAt: r.approved_at ? new Date(r.approved_at).getTime() : undefined,
        verifiedBy: r.verified_by || undefined,
        verifiedAt: r.verified_at ? new Date(r.verified_at).getTime() : undefined,
        auditLog: r.audit_log_json || [],
        answers: r.answers_json || {},
        photoUrl: r.photo_url || undefined,
        tokenUsed: r.token_used || undefined,
        formVersion: (r as any).form_version || 1,
      }));
    } catch {
      return null;
    }
  }

  static async checkDuplicateRegistration(
    mobile: string,
    seasonSlug = 'season-4'
  ): Promise<{ isDuplicate: boolean; regId?: string } | null> {
    if (!this.isAvailable()) return null;
    try {
      const clean = mobile.replace(/\D/g, '');
      const { data, error } = await supabase
        .from('registrations')
        .select('id, reg_id, status')
        .eq('season_slug', seasonSlug)
        .eq('mobile', clean)
        .neq('status', 'rejected')
        .maybeSingle();

      if (error || !data) return { isDuplicate: false };
      return { isDuplicate: true, regId: (data as any).reg_id };
    } catch {
      return null;
    }
  }

  static async generateCollisionFreeRegId(prefix = 'SPL-2026'): Promise<string> {
    try {
      const { count } = await supabase
        .from('registrations')
        .select('*', { count: 'exact', head: true });
      const seq = String((count || 0) + 1).padStart(3, '0');
      const salt = Math.floor(100 + Math.random() * 900);
      return `${prefix}-${seq}-${salt}`;
    } catch {
      const fallbackSeq = String(Math.floor(1 + Math.random() * 999)).padStart(3, '0');
      const salt = Math.floor(100 + Math.random() * 900);
      return `${prefix}-${fallbackSeq}-${salt}`;
    }
  }

  static async saveRegistration(reg: Registration): Promise<boolean> {
    const res = await this.saveRegistrationWithDetail(reg);
    return res.success;
  }

  static async saveRegistrationWithDetail(reg: Registration): Promise<{ success: boolean; error?: string }> {
    if (!this.isAvailable()) return { success: false, error: 'Supabase credentials not configured' };
    try {
      // 1. Normalize gender to match PostgreSQL CHECK (gender IN ('M', 'F', 'Other'))
      const rawGender = String(reg.gender || '').trim().toLowerCase();
      let normalizedGender: 'M' | 'F' | 'Other' = 'M';
      if (rawGender === 'm' || rawGender === 'male') {
        normalizedGender = 'M';
      } else if (rawGender === 'f' || rawGender === 'female') {
        normalizedGender = 'F';
      } else if (rawGender === 'other') {
        normalizedGender = 'Other';
      }

      // 2. Normalize status to match PostgreSQL CHECK (status IN ('pending', 'approved', 'rejected', 'paid', 'complimentary'))
      const validStatuses = ['pending', 'approved', 'rejected', 'paid', 'complimentary'];
      const normalizedStatus = validStatuses.includes(reg.status) ? reg.status : 'pending';

      // 3. Normalize payment_status to match PostgreSQL CHECK
      const validPaymentStatuses = [
        'unpaid',
        'pending',
        'initiated',
        'pending_verification',
        'paid',
        'failed',
        'cancelled',
        'refunded',
      ];
      const normalizedPaymentStatus = validPaymentStatuses.includes(reg.paymentStatus as any)
        ? (reg.paymentStatus as any)
        : 'unpaid';

      // 4. Normalize method to match PostgreSQL CHECK
      const validMethods = ['cash', 'upi', 'bank', 'complimentary'];
      const normalizedMethod = validMethods.includes(reg.method as any) ? (reg.method as any) : 'upi';

      const payload = {
        id: reg.id,
        reg_id: reg.regId,
        season_slug: reg.season || 'season-4',
        player_id: reg.playerId || null,
        name: reg.name.trim(),
        mobile: reg.mobile.replace(/\D/g, ''),
        whatsapp: reg.whatsapp ? reg.whatsapp.replace(/\D/g, '') : null,
        age: typeof reg.age === 'number' && !isNaN(reg.age) ? Math.round(reg.age) : null,
        gender: normalizedGender,
        experience: reg.experience || null,
        category: reg.category || null,
        style: reg.style || null,
        city: reg.city || null,
        notes: reg.notes || null,
        fee: Math.round(Number(reg.fee) || 250),
        status: normalizedStatus,
        payment_status: normalizedPaymentStatus,
        method: normalizedMethod,
        txn_id: reg.txnId || null,
        answers_json: reg.answers || {},
        photo_url: reg.photoUrl || null,
        token_used: reg.tokenUsed || null,
        form_version: reg.formVersion || 1,
        approved_at: reg.approvedAt ? new Date(reg.approvedAt).toISOString() : null,
        paid_at: reg.paidAt ? new Date(reg.paidAt).toISOString() : null,
        verified_by: reg.verifiedBy || null,
        verified_at: reg.verifiedAt ? new Date(reg.verifiedAt).toISOString() : null,
        audit_log_json: reg.auditLog || [],
        created_at: new Date(reg.createdAt).toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('registrations').upsert(payload as any);
      if (error) {
        console.error('Supabase saveRegistration error:', error.message, error.details);
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (e: any) {
      console.error('Supabase saveRegistration exception:', e?.message);
      return { success: false, error: e?.message || 'Database error recording registration' };
    }
  }

  static async deleteRegistration(id: string): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      const { error } = await supabase.from('registrations').delete().eq('id', id);
      return !error;
    } catch {
      return false;
    }
  }

  static async deleteRegistrationsBulk(ids: string[]): Promise<boolean> {
    if (!this.isAvailable() || ids.length === 0) return false;
    try {
      const { error } = await supabase.from('registrations').delete().in('id', ids);
      return !error;
    } catch {
      return false;
    }
  }

  // ============================================================================
  // 5. REGISTRATION FORM CONFIG, TOURNAMENT SETTINGS & VERSIONS
  // ============================================================================
  static mapDbFormRow(row: DbRegistrationFormConfig): RegistrationFormConfig {
    const appJson = (row.appearance_json as any) || {};
    const customUrlSlug = appJson.customUrlSlug || undefined;

    return {
      seasonSlug: row.season_slug,
      customUrlSlug,
      tournamentName: row.tournament_name,
      seasonTitle: row.season_title,
      deadline: row.deadline || undefined,
      maxSlots: row.max_slots,
      entryFee: row.entry_fee,
      venue: row.venue || undefined,
      date: row.date || undefined,
      enabled: row.enabled,
      closedNotice: row.closed_notice || undefined,
      isPublished: row.is_published,
      version: row.version || 1,
      publishedAt: row.published_at ? new Date(row.published_at).getTime() : undefined,
      lastUpdatedAt: new Date(row.updated_at).getTime(),
      payment: row.payment_config_json as any,
      appearance: appJson,
      fields: row.fields_json || [],
    };
  }

  static extractTournamentSettingsFromConfig(
    config: RegistrationFormConfig | null
  ): { settings?: Partial<TournamentSettings>; payment?: Partial<PaymentSettings> } {
    if (!config) return {};
    const appAny = (config.appearance as any) || {};
    const embedded: Partial<TournamentSettings> = appAny.tournamentSettings || {};

    const settings: Partial<TournamentSettings> = {
      ...embedded,
      ...(config.tournamentName ? { name: config.tournamentName } : {}),
      ...(config.seasonTitle ? { season: config.seasonTitle } : {}),
      ...(config.venue !== undefined ? { venue: config.venue } : {}),
      ...(config.date !== undefined ? { date: config.date } : {}),
      ...(config.entryFee != null && !Number.isNaN(Number(config.entryFee))
        ? { entryFee: Number(config.entryFee) }
        : {}),
      ...(config.maxSlots != null && !Number.isNaN(Number(config.maxSlots))
        ? { slotLimit: Number(config.maxSlots) }
        : {}),
    };

    const rawPay = (config.payment as any) || null;
    const payment: Partial<PaymentSettings> | undefined = rawPay
      ? {
          ...(rawPay.enabled !== undefined ? { enabled: Boolean(rawPay.enabled) } : {}),
          ...(rawPay.isMandatory !== undefined ? { isMandatory: Boolean(rawPay.isMandatory) } : {}),
          ...(rawPay.upiId !== undefined ? { upiId: String(rawPay.upiId) } : {}),
          ...(rawPay.accountName !== undefined ? { accountName: String(rawPay.accountName) } : {}),
          ...(rawPay.note !== undefined ? { note: String(rawPay.note) } : {}),
          ...(rawPay.instructions !== undefined ? { instructions: String(rawPay.instructions) } : {}),
          ...(rawPay.buttonText !== undefined ? { buttonText: String(rawPay.buttonText) } : {}),
          ...(rawPay.categoryFees !== undefined ? { categoryFees: rawPay.categoryFees } : {}),
        }
      : undefined;

    return { settings, payment };
  }

  static async fetchFormConfigRow(seasonSlug = 'season-4'): Promise<DbRegistrationFormConfig | null> {
    if (!this.isAvailable()) return null;
    try {
      const { data, error } = await supabase
        .from('registration_form_config')
        .select('*')
        .eq('season_slug', seasonSlug)
        .maybeSingle();

      if (!error && data) {
        return data as DbRegistrationFormConfig;
      }

      const { data: fallbackData } = await supabase
        .from('registration_form_config')
        .select('*')
        .eq('is_published', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fallbackData) {
        return fallbackData as DbRegistrationFormConfig;
      }

      const { data: season4Data } = await supabase
        .from('registration_form_config')
        .select('*')
        .eq('season_slug', 'season-4')
        .maybeSingle();

      if (season4Data) return season4Data as DbRegistrationFormConfig;

      const { data: anyRow } = await supabase
        .from('registration_form_config')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      return (anyRow as unknown as DbRegistrationFormConfig) || null;
    } catch {
      return null;
    }
  }

  static async fetchFormConfig(seasonSlug = 'season-4'): Promise<RegistrationFormConfig | null> {
    const row = await this.fetchFormConfigRow(seasonSlug);
    if (!row) return null;
    return this.mapDbFormRow(row);
  }

  static async saveFormConfig(config: RegistrationFormConfig, publish = false): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      const slug = config.seasonSlug || 'season-4';
      const now = new Date().toISOString();

      const { data } = await supabase
        .from('registration_form_config')
        .select('id, version, appearance_json, published_at')
        .eq('season_slug', slug)
        .maybeSingle();

      const existing = data as any;
      const existingId = existing?.id || slug;
      const nextVersion = existing ? (existing.version || 1) + 1 : 1;

      // Preserve persisted tournamentSettings metadata inside appearance_json
      const existingTournamentSettings = existing?.appearance_json?.tournamentSettings;
      const incomingTournamentSettings = (config.appearance as any)?.tournamentSettings;
      const mergedAppearance = {
        ...(config.appearance || {}),
        ...(existingTournamentSettings || incomingTournamentSettings
          ? {
              tournamentSettings: {
                ...(existingTournamentSettings || {}),
                ...(incomingTournamentSettings || {}),
              },
            }
          : {}),
      };

      const payload: Record<string, any> = {
        id: existingId,
        season_slug: slug,
        tournament_name: config.tournamentName,
        season_title: config.seasonTitle,
        deadline: config.deadline ? new Date(config.deadline).toISOString() : null,
        max_slots: config.maxSlots ?? 32,
        entry_fee: config.entryFee ?? 500,
        venue: config.venue || null,
        date: config.date || null,
        enabled: config.enabled ?? true,
        closed_notice: config.closedNotice || null,
        is_published: publish ? true : config.isPublished,
        payment_config_json: config.payment || {},
        appearance_json: mergedAppearance,
        fields_json: config.fields || [],
        version: nextVersion,
        updated_at: now,
      };

      if (publish) {
        payload.published_at = now;
      } else if (existing?.published_at) {
        payload.published_at = existing.published_at;
      }

      const formTable = supabase.from('registration_form_config') as any;
      const { error } = existing
        ? await formTable.update(payload).eq('id', existingId)
        : await formTable.upsert(payload, { onConflict: 'season_slug' });

      if (!error) {
        await supabase.from('registration_form_versions').insert({
          form_config_id: existingId,
          season_slug: slug,
          version_num: nextVersion,
          snapshot_json: config as any,
          created_by: 'admin',
          created_at: now,
        } as any);
      }

      return !error;
    } catch {
      return false;
    }
  }

  static async saveTournamentConfig(
    seasonSlug = 'season-4',
    settingsUpdate?: Partial<TournamentSettings>,
    paymentUpdate?: Partial<PaymentSettings>
  ): Promise<{
    success: boolean;
    error?: string;
    config?: RegistrationFormConfig;
    settings?: Partial<TournamentSettings>;
    payment?: Partial<PaymentSettings>;
  }> {
    if (!this.isAvailable()) {
      return { success: false, error: 'Supabase credentials are not configured.' };
    }

    try {
      const targetSlug = seasonSlug || 'season-4';
      const existingRow = await this.fetchFormConfigRow(targetSlug);
      const existingConfig = existingRow ? this.mapDbFormRow(existingRow) : null;
      const existingExtracted = this.extractTournamentSettingsFromConfig(existingConfig);
      const defaultForm = createDefaultFormConfig(targetSlug);
      const now = new Date().toISOString();

      const mergedSettings: Partial<TournamentSettings> = {
        ...(existingExtracted.settings || {}),
        ...(settingsUpdate || {}),
      };

      const existingPayment = (existingRow?.payment_config_json as any) || defaultForm.payment || {};
      const mergedPaymentConfig = paymentUpdate
        ? {
            ...existingPayment,
            ...paymentUpdate,
            baseFee:
              mergedSettings.entryFee != null
                ? Number(mergedSettings.entryFee)
                : existingPayment.baseFee ?? 500,
          }
        : {
            ...existingPayment,
            ...(mergedSettings.entryFee != null ? { baseFee: Number(mergedSettings.entryFee) } : {}),
          };

      const existingAppearance = (existingRow?.appearance_json as any) || defaultForm.appearance || {};
      const mergedAppearance = {
        ...existingAppearance,
        tournamentSettings: mergedSettings,
      };

      const resolvedName =
        (mergedSettings.name !== undefined ? String(mergedSettings.name).trim() : '') ||
        existingRow?.tournament_name ||
        defaultForm.tournamentName;
      const resolvedSeason =
        mergedSettings.season !== undefined
          ? String(mergedSettings.season)
          : existingRow?.season_title || defaultForm.seasonTitle;
      const resolvedVenue =
        mergedSettings.venue !== undefined
          ? String(mergedSettings.venue)
          : existingRow?.venue || defaultForm.venue || null;
      const resolvedDate =
        mergedSettings.date !== undefined
          ? String(mergedSettings.date)
          : existingRow?.date || defaultForm.date || null;
      const resolvedEntryFee =
        mergedSettings.entryFee != null && !Number.isNaN(Number(mergedSettings.entryFee))
          ? Math.max(0, Math.round(Number(mergedSettings.entryFee)))
          : existingRow?.entry_fee ?? 500;
      const resolvedMaxSlots =
        mergedSettings.slotLimit != null && !Number.isNaN(Number(mergedSettings.slotLimit))
          ? Math.max(2, Math.round(Number(mergedSettings.slotLimit)))
          : existingRow?.max_slots ?? 32;

      mergedSettings.name = resolvedName;
      mergedSettings.season = resolvedSeason;
      mergedSettings.venue = resolvedVenue || '';
      mergedSettings.date = resolvedDate || '';
      mergedSettings.entryFee = resolvedEntryFee;
      mergedSettings.slotLimit = resolvedMaxSlots;

      if (existingRow) {
        const updatePayload = {
          tournament_name: resolvedName,
          season_title: resolvedSeason,
          venue: resolvedVenue,
          date: resolvedDate,
          entry_fee: resolvedEntryFee,
          max_slots: resolvedMaxSlots,
          payment_config_json: mergedPaymentConfig,
          appearance_json: mergedAppearance,
          updated_at: now,
        };

        const { data: savedRow, error } = await (supabase.from('registration_form_config') as any)
          .update(updatePayload)
          .eq('id', existingRow.id)
          .select('*')
          .single();

        if (error || !savedRow) {
          return {
            success: false,
            error: error?.message || 'Failed to persist tournament settings in Supabase.',
          };
        }

        const savedConfig = this.mapDbFormRow(savedRow as DbRegistrationFormConfig);
        const extracted = this.extractTournamentSettingsFromConfig(savedConfig);
        return {
          success: true,
          config: savedConfig,
          settings: extracted.settings,
          payment: extracted.payment,
        };
      } else {
        const insertPayload = {
          id: targetSlug,
          season_slug: targetSlug,
          tournament_name: resolvedName,
          season_title: resolvedSeason,
          deadline: defaultForm.deadline ? new Date(defaultForm.deadline).toISOString() : null,
          max_slots: resolvedMaxSlots,
          entry_fee: resolvedEntryFee,
          venue: resolvedVenue,
          date: resolvedDate,
          enabled: true,
          closed_notice: defaultForm.closedNotice || null,
          is_published: true,
          payment_config_json: mergedPaymentConfig,
          appearance_json: mergedAppearance,
          fields_json: defaultForm.fields || [],
          version: 1,
          published_at: now,
          updated_at: now,
        };

        const { data: savedRow, error } = await supabase
          .from('registration_form_config')
          .upsert(insertPayload as any, { onConflict: 'season_slug' })
          .select('*')
          .single();

        if (error || !savedRow) {
          return {
            success: false,
            error: error?.message || 'Failed to create tournament settings record in Supabase.',
          };
        }

        const savedConfig = this.mapDbFormRow(savedRow as DbRegistrationFormConfig);
        const extracted = this.extractTournamentSettingsFromConfig(savedConfig);
        return {
          success: true,
          config: savedConfig,
          settings: extracted.settings,
          payment: extracted.payment,
        };
      }
    } catch (e: any) {
      return {
        success: false,
        error: e?.message || 'Unexpected error persisting settings to Supabase.',
      };
    }
  }

  static async updateTournamentSettings(
    seasonSlug = 'season-4',
    settingsUpdate?: Partial<{ tournamentName: string; seasonTitle: string; venue: string; date: string; maxSlots: number; entryFee: number; status: string }>,
    paymentUpdate?: any
  ): Promise<boolean> {
    const mappedSettings: Partial<TournamentSettings> | undefined = settingsUpdate
      ? {
          ...(settingsUpdate.tournamentName !== undefined ? { name: settingsUpdate.tournamentName } : {}),
          ...(settingsUpdate.seasonTitle !== undefined ? { season: settingsUpdate.seasonTitle } : {}),
          ...(settingsUpdate.venue !== undefined ? { venue: settingsUpdate.venue } : {}),
          ...(settingsUpdate.date !== undefined ? { date: settingsUpdate.date } : {}),
          ...(settingsUpdate.maxSlots !== undefined ? { slotLimit: settingsUpdate.maxSlots } : {}),
          ...(settingsUpdate.entryFee !== undefined ? { entryFee: settingsUpdate.entryFee } : {}),
        }
      : undefined;

    const res = await this.saveTournamentConfig(seasonSlug, mappedSettings, paymentUpdate);
    return res.success;
  }

  static async saveCustomUrlSlug(slug: string, seasonSlug = 'season-4'): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      const existing = await this.fetchFormConfig(seasonSlug);
      if (!existing) return false;
      const cleanSlug = slug.toLowerCase().trim().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
      const updatedConfig: RegistrationFormConfig = {
        ...existing,
        customUrlSlug: cleanSlug || 'register',
        appearance: {
          ...existing.appearance,
          customUrlSlug: cleanSlug || 'register',
        },
      };
      return await this.saveFormConfig(updatedConfig, false);
    } catch {
      return false;
    }
  }

  // ============================================================================
  // 6. REGISTRATION TOKENS (Shareable Links)
  // ============================================================================
  static async fetchTokens(seasonSlug = 'season-4'): Promise<{ tokens: RegistrationTokenRecord[]; activeToken: RegistrationTokenRecord | null } | null> {
    if (!this.isAvailable()) return null;
    try {
      const { data, error } = await supabase
        .from('registration_tokens')
        .select('*')
        .eq('season_slug', seasonSlug)
        .order('created_at', { ascending: false });

      if (error || !data) return null;

      const tokenRecords: RegistrationTokenRecord[] = (data as DbRegistrationToken[]).map((t) => ({
        id: t.id,
        token: t.token,
        seasonSlug: t.season_slug,
        label: t.label || undefined,
        createdAt: new Date(t.created_at).getTime(),
        isActive: t.is_active,
        revokedAt: t.revoked_at ? new Date(t.revoked_at).getTime() : undefined,
        submissionsCount: t.submissions_count || 0,
      }));

      const active = tokenRecords.find((t) => t.isActive) || tokenRecords[0] || null;
      return { tokens: tokenRecords, activeToken: active };
    } catch {
      return null;
    }
  }

  static async saveToken(tokenRecord: RegistrationTokenRecord): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      const payload = {
        id: tokenRecord.id,
        token: tokenRecord.token,
        season_slug: tokenRecord.seasonSlug,
        label: tokenRecord.label || null,
        is_active: tokenRecord.isActive,
        submissions_count: tokenRecord.submissionsCount || 0,
        revoked_at: tokenRecord.revokedAt ? new Date(tokenRecord.revokedAt).toISOString() : null,
        created_at: new Date(tokenRecord.createdAt).toISOString(),
      };

      const { error } = await supabase.from('registration_tokens').upsert(payload as any);
      return !error;
    } catch {
      return false;
    }
  }

  static async incrementTokenSubmission(token: string): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      const { data } = await supabase
        .from('registration_tokens')
        .select('*')
        .eq('token', token)
        .maybeSingle();

      if (!data) return false;
      const count = ((data as any).submissions_count || 0) + 1;
      const { error } = await (supabase.from('registration_tokens') as any)
        .update({ submissions_count: count })
        .eq('token', token);
      return !error;
    } catch {
      return false;
    }
  }

  // ============================================================================
  // 7. TOURNAMENT STANDINGS
  // ============================================================================
  static async syncStandings(season = 'season-4', standings: StandingsRecord[]): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      const rows = standings.map((s, idx) => ({
        season_slug: season,
        team_id: s.team.id,
        played: s.played,
        won: s.won,
        lost: s.lost,
        tied: 0,
        no_result: 0,
        points: s.points,
        points_for: s.pointsFor,
        points_against: s.pointsAgainst,
        net_run_rate: s.diff,
        form: s.form || [],
        rank: idx + 1,
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from('tournament_standings')
        .upsert(rows as any, { onConflict: 'season_slug,team_id' });

      return !error;
    } catch {
      return false;
    }
  }

  static async fetchStandings(season = 'season-4'): Promise<StandingsRecord[] | null> {
    if (!this.isAvailable()) return null;
    try {
      const { data, error } = await supabase
        .from('tournament_standings')
        .select('*, teams(*)')
        .eq('season_slug', season)
        .order('rank', { ascending: true });
      if (error || !data) return null;
      return (data as any[]).map((r) => ({
        team: {
          id: r.team_id,
          name: r.teams?.name || r.team_id,
          avatarColor: r.teams?.avatar_color || 'from-amber-500 to-orange-600',
          badge: r.teams?.badge || '🏸',
          players: [],
        },
        played: r.played,
        won: r.won,
        lost: r.lost,
        points: r.points,
        diff: r.net_run_rate || 0,
        pointsFor: r.points_for || 0,
        pointsAgainst: r.points_against || 0,
        form: r.form || [],
      }));
    } catch {
      return null;
    }
  }

  // ============================================================================
  // 8. AUDIT LOGGING
  // ============================================================================
  static async logAudit(action: string, entityType: string, entityId?: string, details?: any, user?: any): Promise<void> {
    if (!this.isAvailable()) return;
    try {
      await supabase.from('audit_logs').insert({
        action,
        entity_type: entityType,
        entity_id: entityId || null,
        user_id: user?.id || null,
        user_email: user?.email || null,
        details_json: details || {},
        created_at: new Date().toISOString(),
      } as any);
    } catch {}
  }

  // ============================================================================
  // 9. SUPABASE REALTIME LIVE SCORE & REGISTRATION SUBSCRIPTIONS
  // ============================================================================
  private static cleanupExistingChannels(channelName: string) {
    try {
      const existingChannels = supabase.getChannels?.() || [];
      for (const ch of existingChannels) {
        const topic = (ch as any)?.topic || '';
        if (topic === channelName || topic === `realtime:${channelName}`) {
          void supabase.removeChannel(ch);
        }
      }
    } catch {}
  }

  static subscribeLiveMatches(onMatchChange: (payload: any) => void) {
    if (!this.isAvailable()) return () => {};
    try {
      const channelName = 'spl-live-matches-channel';
      this.cleanupExistingChannels(channelName);
      const channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'matches' },
          (payload) => {
            onMatchChange(payload);
          }
        )
        .subscribe();

      return () => {
        try {
          void supabase.removeChannel(channel);
        } catch {}
      };
    } catch {
      return () => {};
    }
  }

  static subscribeRegistrations(onRegChange: (payload: any) => void) {
    if (!this.isAvailable()) return () => {};
    try {
      const channelName = 'spl-live-registrations-channel';
      this.cleanupExistingChannels(channelName);
      const channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'registrations' },
          (payload) => {
            onRegChange(payload);
          }
        )
        .subscribe();

      return () => {
        try {
          void supabase.removeChannel(channel);
        } catch {}
      };
    } catch {
      return () => {};
    }
  }

  static subscribePlayers(onPlayerChange: (payload: any) => void) {
    if (!this.isAvailable()) return () => {};
    try {
      const channelName = 'spl-live-players-channel';
      this.cleanupExistingChannels(channelName);
      const channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'players' },
          (payload) => {
            onPlayerChange(payload);
          }
        )
        .subscribe();

      return () => {
        try {
          void supabase.removeChannel(channel);
        } catch {}
      };
    } catch {
      return () => {};
    }
  }

  static subscribeTournamentMaster(handlers: TournamentRealtimeHandlers): () => void {
    if (!this.isAvailable()) return () => {};
    let disposed = false;
    try {
      const channelName = 'spl-master-realtime-channel';
      this.cleanupExistingChannels(channelName);

      const channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'matches' },
          (payload: any) => {
            if (!disposed) handlers.onMatchChange?.(payload);
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'players' },
          (payload: any) => {
            if (!disposed) handlers.onPlayerChange?.(payload);
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'teams' },
          (payload: any) => {
            if (!disposed) handlers.onTeamChange?.(payload);
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'team_players' },
          (payload: any) => {
            if (!disposed) handlers.onTeamPlayerChange?.(payload);
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'registrations' },
          (payload: any) => {
            if (!disposed) handlers.onRegistrationChange?.(payload);
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'tournament_standings' },
          (payload: any) => {
            if (!disposed) handlers.onStandingsChange?.(payload);
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'registration_form_config' },
          (payload: any) => {
            if (!disposed) handlers.onFormConfigChange?.(payload);
          }
        )
        .subscribe((status) => {
          if (!disposed) handlers.onStatusChange?.(status);
        });

      return () => {
        disposed = true;
        try {
          void supabase.removeChannel(channel);
        } catch {}
      };
    } catch {
      return () => {};
    }
  }
}

export interface RealtimeChangeEvent<T = any> {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: T;
  old: T;
  table: string;
  schema: string;
  commit_timestamp?: string;
  errors?: any[];
}

export interface TournamentRealtimeHandlers {
  onMatchChange?: (payload: RealtimeChangeEvent) => void;
  onPlayerChange?: (payload: RealtimeChangeEvent) => void;
  onTeamChange?: (payload: RealtimeChangeEvent) => void;
  onTeamPlayerChange?: (payload: RealtimeChangeEvent) => void;
  onRegistrationChange?: (payload: RealtimeChangeEvent) => void;
  onFormConfigChange?: (payload: RealtimeChangeEvent) => void;
  onStandingsChange?: (payload: RealtimeChangeEvent) => void;
  onStatusChange?: (status: string) => void;
}
