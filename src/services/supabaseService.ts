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
} from '../types/tournament';
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

  // ============================================================================
  // 2. TEAMS & ROSTERS
  // ============================================================================
  static async fetchTeams(): Promise<Team[] | null> {
    if (!this.isAvailable()) return null;
    try {
      const { data: teamsData, error: teamsErr } = await supabase
        .from('teams')
        .select('*')
        .order('name', { ascending: true });

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

      return (teamsData as DbTeam[]).map((t) => ({
        id: t.id,
        name: t.name,
        captainId: t.captain_id || undefined,
        avatarColor: t.avatar_color || 'from-amber-500 to-orange-600',
        badge: t.badge || '🏸',
        locked: t.locked,
        players: rosterMap.get(t.id) || [],
      }));
    } catch {
      return null;
    }
  }

  static async saveTeam(team: Team): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      const teamPayload = {
        id: team.id,
        name: team.name,
        captain_id: team.captainId || null,
        avatar_color: team.avatarColor || 'from-amber-500 to-orange-600',
        badge: team.badge || '🏸',
        locked: Boolean(team.locked),
        updated_at: new Date().toISOString(),
      };

      await supabase.from('teams').upsert(teamPayload as any);

      // Replace roster junction
      await supabase.from('team_players').delete().eq('team_id', team.id);

      if (team.players && team.players.length > 0) {
        const rows = team.players.map((playerId, idx) => ({
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
      for (const t of teams) {
        await this.saveTeam(t);
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

      for (const m of data as DbMatch[]) {
        if (m.match_type === 'knockout') {
          koMatches.push({
            id: m.id,
            stage: (m.stage as any) || 'SF',
            slot: m.slot || 1,
            teamA: m.team_a_id || undefined,
            teamB: m.team_b_id || undefined,
            scoreA: m.score_a != null ? m.score_a : undefined,
            scoreB: m.score_b != null ? m.score_b : undefined,
            status: m.status === 'live' ? 'live' : m.status === 'completed' ? 'completed' : 'upcoming',
            winner: m.winner_id || undefined,
          });
        } else {
          groupMatches.push({
            id: m.id,
            round: m.round,
            court: typeof m.court === 'number' ? m.court : parseInt(String(m.court || '').replace(/\D/g, '') || '1', 10),
            teamA: m.team_a_id || '',
            teamB: m.team_b_id || '',
            scoreA: m.score_a != null ? m.score_a : undefined,
            scoreB: m.score_b != null ? m.score_b : undefined,
            status: m.status,
            winner: m.winner_id || undefined,
            time: m.time || undefined,
            sets: m.sets_json || undefined,
            mvpPlayerId: m.mvp_player_id || undefined,
          });
        }
      }

      return { matches: groupMatches, knockout: koMatches };
    } catch {
      return null;
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

      if (updates.scoreA !== undefined) payload.score_a = updates.scoreA;
      if (updates.scoreB !== undefined) payload.score_b = updates.scoreB;
      if (updates.status !== undefined) payload.status = updates.status;
      if (updates.winner !== undefined) payload.winner_id = updates.winner;
      if ('sets' in updates && updates.sets) payload.sets_json = updates.sets;
      if ('teamA' in updates && updates.teamA) payload.team_a_id = updates.teamA;
      if ('teamB' in updates && updates.teamB) payload.team_b_id = updates.teamB;
      if ('stage' in updates && (updates as any).stage) payload.stage = (updates as any).stage;
      if ('slot' in updates && (updates as any).slot) payload.slot = (updates as any).slot;
      if (isKnockout) payload.match_type = 'knockout';

      const { error } = await supabase
        .from('matches')
        .upsert({ id: matchId, tournament_season: season, ...payload } as any);

      return !error;
    } catch {
      return false;
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
      const { error } = await supabase.from('matches').delete().eq('id', id);
      return !error;
    } catch {
      return false;
    }
  }

  static async clearSeasonMatches(season = 'season-4'): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      const { error } = await supabase.from('matches').delete().eq('tournament_season', season);
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
        court: 1,
        match_type: 'knockout' as const,
        stage: m.stage || 'SF',
        slot: m.slot || 1,
        team_a_id: m.teamA || null,
        team_b_id: m.teamB || null,
        score_a: m.scoreA != null ? m.scoreA : null,
        score_b: m.scoreB != null ? m.scoreB : null,
        status: m.status,
        winner_id: m.winner || null,
        updated_at: new Date().toISOString(),
      }));
      const { error } = await supabase.from('matches').upsert(rows as any);
      return !error;
    } catch {
      return false;
    }
  }

  static async clearKnockoutMatches(season = 'season-4'): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
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
    if (!this.isAvailable()) return false;
    try {
      const payload = {
        id: reg.id,
        reg_id: reg.regId,
        season_slug: reg.season || 'season-4',
        player_id: reg.playerId || null,
        name: reg.name,
        mobile: reg.mobile,
        whatsapp: reg.whatsapp || null,
        age: reg.age || null,
        gender: reg.gender || 'M',
        experience: reg.experience || null,
        category: reg.category || null,
        style: reg.style || null,
        city: reg.city || null,
        notes: reg.notes || null,
        fee: reg.fee,
        status: reg.status,
        payment_status: reg.paymentStatus || 'unpaid',
        method: reg.method || 'upi',
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
        console.error('Supabase saveRegistration error:', error.message);
        return false;
      }
      return true;
    } catch (e: any) {
      console.error('Supabase saveRegistration exception:', e?.message);
      return false;
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
  // 5. REGISTRATION FORM CONFIG & VERSIONS
  // ============================================================================
  static async fetchFormConfig(seasonSlug = 'season-4'): Promise<RegistrationFormConfig | null> {
    if (!this.isAvailable()) return null;
    try {
      // 1. Try fetching exact slug match
      let row: DbRegistrationFormConfig | null = null;
      const { data, error } = await supabase
        .from('registration_form_config')
        .select('*')
        .eq('season_slug', seasonSlug)
        .maybeSingle();

      if (!error && data) {
        row = data as DbRegistrationFormConfig;
      } else {
        // Fallback to active published config
        const { data: fallbackData } = await supabase
          .from('registration_form_config')
          .select('*')
          .eq('is_published', true)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (fallbackData) {
          row = fallbackData as DbRegistrationFormConfig;
        } else {
          // Fallback to default season-4
          const { data: season4Data } = await supabase
            .from('registration_form_config')
            .select('*')
            .eq('season_slug', 'season-4')
            .maybeSingle();
          if (season4Data) row = season4Data as DbRegistrationFormConfig;
        }
      }

      if (!row) return null;

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
    } catch {
      return null;
    }
  }

  static async saveFormConfig(config: RegistrationFormConfig, publish = false): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      const slug = config.seasonSlug || 'season-4';
      const now = new Date().toISOString();

      // Get current version number
      const { data } = await supabase
        .from('registration_form_config')
        .select('version')
        .eq('season_slug', slug)
        .maybeSingle();

      const existing = data as any;
      const nextVersion = existing ? (existing.version || 1) + 1 : 1;

      const payload = {
        id: slug,
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
        appearance_json: config.appearance || {},
        fields_json: config.fields || [],
        version: nextVersion,
        published_at: publish ? now : undefined,
        updated_at: now,
      };

      const { error } = await supabase.from('registration_form_config').upsert(payload as any);

      if (!error) {
        // Record version snapshot in audit table
        await supabase.from('registration_form_versions').insert({
          form_config_id: slug,
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

  static async updateTournamentSettings(
    seasonSlug = 'season-4',
    settingsUpdate?: Partial<{ tournamentName: string; venue: string; date: string; maxSlots: number; entryFee: number; status: string }>,
    paymentUpdate?: any
  ): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      const existing = await this.fetchFormConfig(seasonSlug);
      const updatedConfig: RegistrationFormConfig = {
        seasonSlug,
        tournamentName: settingsUpdate?.tournamentName || existing?.tournamentName || 'Smash Premier League',
        seasonTitle: existing?.seasonTitle || 'Season IV (Championship Edition)',
        venue: settingsUpdate?.venue !== undefined ? settingsUpdate.venue : existing?.venue,
        date: settingsUpdate?.date !== undefined ? settingsUpdate.date : existing?.date,
        maxSlots: settingsUpdate?.maxSlots !== undefined ? settingsUpdate.maxSlots : (existing?.maxSlots ?? 32),
        entryFee: settingsUpdate?.entryFee !== undefined ? settingsUpdate.entryFee : (existing?.entryFee ?? 500),
        enabled: existing?.enabled ?? true,
        isPublished: existing?.isPublished ?? true,
        payment: paymentUpdate ? { ...(existing?.payment || {}), ...paymentUpdate } : (existing?.payment || { upiId: 'karan-hdfc@ybl', upiName: 'SPL Admin', qrUrl: '', instructions: '' }),
        appearance: existing?.appearance || {
          formTitle: 'Player Entry & Registration Form',
          formDescription: 'Official Smash Premier League athlete entry form.',
          welcomeMessage: 'Welcome athletes! Please fill in your details accurately.',
          accentColor: '#10b981',
          accentName: 'Emerald Green',
          submitButtonText: 'Submit Registration & Confirm Entry',
          successTitle: 'Registration Submitted Successfully!',
          successMessage: 'Thank you for registering for Smash Premier League.',
        },
        fields: existing?.fields || [],
      };
      return await this.saveFormConfig(updatedConfig, false);
    } catch {
      return false;
    }
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
  static subscribeLiveMatches(onMatchChange: (payload: any) => void) {
    if (!this.isAvailable()) return () => {};
    try {
      const channel = supabase
        .channel('spl-live-matches-channel')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'matches' },
          (payload) => {
            onMatchChange(payload);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } catch {
      return () => {};
    }
  }

  static subscribeRegistrations(onRegChange: (payload: any) => void) {
    if (!this.isAvailable()) return () => {};
    try {
      const channel = supabase
        .channel('spl-live-registrations-channel')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'registrations' },
          (payload) => {
            onRegChange(payload);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } catch {
      return () => {};
    }
  }

  static subscribePlayers(onPlayerChange: (payload: any) => void) {
    if (!this.isAvailable()) return () => {};
    try {
      const channel = supabase
        .channel('spl-live-players-channel')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'players' },
          (payload) => {
            onPlayerChange(payload);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } catch {
      return () => {};
    }
  }

  static subscribeTournamentMaster(handlers: TournamentRealtimeHandlers): () => void {
    if (!this.isAvailable()) return () => {};
    try {
      const channel = supabase
        .channel('spl-master-realtime-channel')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'matches' },
          (payload: any) => handlers.onMatchChange?.(payload)
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'players' },
          (payload: any) => handlers.onPlayerChange?.(payload)
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'teams' },
          (payload: any) => handlers.onTeamChange?.(payload)
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'team_players' },
          (payload: any) => handlers.onTeamPlayerChange?.(payload)
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'registrations' },
          (payload: any) => handlers.onRegistrationChange?.(payload)
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'tournament_standings' },
          (payload: any) => handlers.onStandingsChange?.(payload)
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'registration_form_config' },
          (payload: any) => handlers.onFormConfigChange?.(payload)
        )
        .subscribe((status) => {
          handlers.onStatusChange?.(status);
        });

      return () => {
        try {
          supabase.removeChannel(channel);
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
