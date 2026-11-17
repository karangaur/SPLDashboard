import assert from 'node:assert/strict';
import { spawn, ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

import {
  calculateStandings,
  generateRoundRobinFixtures,
  getRegistrationPaymentBreakdown,
  calculateRegistrationStats,
  getSeasonStorageKey,
} from '../src/utils/tournamentEngine';
import {
  executeLotteryDraw,
  validateLotteryDrawResult,
} from '../src/utils/lotteryShuffleEngine';
import {
  normalizeScheduleSequence,
  updateMatchInDraft,
  addMatchToDraft,
  moveMatchAcrossOrWithinCourt,
  validateScheduleDraft,
} from '../src/utils/scheduleEditorEngine';
import {
  evaluateSetStatus,
  evaluateMatchOverall,
} from '../src/utils/badmintonEngine';
import {
  resolveStandingsQualificationInfo,
  calculatePlayoffLeagueStandings,
  generateFlexibleKnockoutBracket,
  progressKnockoutBracket,
  buildCustomKnockoutStageConfig,
  materializeCustomKnockoutMatches,
} from '../src/utils/playoffEngine';
import { Match, Player, Registration, Team } from '../src/types/tournament';

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      if (!addr || typeof addr === 'string') {
        srv.close(() => reject(new Error('Failed to allocate free port')));
        return;
      }
      const port = addr.port;
      srv.close((err) => (err ? reject(err) : resolve(port)));
    });
  });
}

async function waitForServerReady(
  baseUrl: string,
  child: ChildProcess,
  getLogs: () => string,
  timeoutMs = 25000
): Promise<void> {
  const start = Date.now();
  let exitedInfo: string | null = null;
  child.once('exit', (code, signal) => {
    exitedInfo = `code=${code}, signal=${signal}`;
  });
  while (Date.now() - start < timeoutMs) {
    if (exitedInfo !== null) {
      throw new Error(`SPL server exited early (${exitedInfo}). Logs:\n${getLogs()}`);
    }
    try {
      const res = await fetch(`${baseUrl}/api/seasons`);
      if (res.ok) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`Timed out waiting for SPL server at ${baseUrl}. Logs:\n${getLogs()}`);
}

async function apiJson<T = any>(
  baseUrl: string,
  pathname: string,
  options?: {
    method?: string;
    token?: string;
    body?: any;
  }
): Promise<{ status: number; data: T }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (options?.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }
  const res = await fetch(`${baseUrl}${pathname}`, {
    method: options?.method || 'GET',
    headers,
    body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const text = await res.text();
  let parsed: any = text;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    // keep raw
  }
  return { status: res.status, data: parsed };
}

interface SseEvent {
  event: string;
  data: any;
}

class SseCollector {
  private controller = new AbortController();
  public events: SseEvent[] = [];
  private connectedPromise: Promise<void>;
  private resolveConnected!: () => void;

  constructor(url: string) {
    this.connectedPromise = new Promise<void>((resolve) => {
      this.resolveConnected = resolve;
    });
    void this.connect(url);
  }

  private async connect(url: string) {
    try {
      const res = await fetch(url, { signal: this.controller.signal });
      if (!res.body) return;
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let sepIdx: number;
        while ((sepIdx = buffer.indexOf('\n\n')) !== -1) {
          const chunk = buffer.slice(0, sepIdx);
          buffer = buffer.slice(sepIdx + 2);
          if (!chunk.trim() || chunk.startsWith(':')) continue;
          let eventName = 'message';
          let dataRaw = '';
          for (const line of chunk.split('\n')) {
            if (line.startsWith('event:')) eventName = line.slice(6).trim();
            else if (line.startsWith('data:')) dataRaw += line.slice(5).trim();
          }
          let parsed: any = dataRaw;
          try {
            parsed = dataRaw ? JSON.parse(dataRaw) : {};
          } catch {
            // keep string
          }
          this.events.push({ event: eventName, data: parsed });
          if (eventName === 'connected') {
            this.resolveConnected();
          }
        }
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        console.warn('SSE listener error:', err?.message);
      }
    }
  }

  async waitConnected(timeoutMs = 5000): Promise<void> {
    await Promise.race([
      this.connectedPromise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('SSE connected timeout')), timeoutMs)
      ),
    ]);
  }

  close() {
    this.controller.abort();
  }
}

async function runTests() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spl-phase3-test-'));
  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  let serverProc: ChildProcess | null = null;
  let sseS3: SseCollector | null = null;
  let sseS4: SseCollector | null = null;

  try {
    const tsxBin = path.resolve(
      process.cwd(),
      'node_modules/.bin',
      process.platform === 'win32' ? 'tsx.cmd' : 'tsx'
    );
    serverProc = spawn(tsxBin, ['server.ts'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PORT: String(port),
        SPL_DATA_DIR: tempDir,
        SPL_DISABLE_SUPABASE: '1',
        SPL_API_ONLY: '1',
        NODE_ENV: 'development',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let serverLogs = '';
    serverProc.stdout?.on('data', (d) => {
      serverLogs += `[stdout] ${d.toString()}`;
    });
    serverProc.stderr?.on('data', (d) => {
      serverLogs += `[stderr] ${d.toString()}`;
    });

    await waitForServerReady(baseUrl, serverProc, () => serverLogs);
    console.log(`[Harness] Isolated SPL API server ready at ${baseUrl} (tempDir=${tempDir})`);

    // Authenticate admin
    const loginRes = await apiJson(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: { identifier: 'admin', password: 'smash2026' },
    });
    assert.equal(loginRes.status, 200, `Admin login failed: ${JSON.stringify(loginRes.data)}`);
    const adminToken: string = loginRes.data.token;
    assert.ok(adminToken.startsWith('spl_sess_'), 'Admin token should use spl_sess_ prefix');

    // Initial season is SPL 3.0 (slug 'season-4' by default in server.ts)
    const initialSeasonsRes = await apiJson(baseUrl, '/api/seasons');
    assert.equal(initialSeasonsRes.status, 200);
    const spl3Slug = initialSeasonsRes.data.activeSeason.seasonSlug;
    assert.equal(spl3Slug, 'season-4');
    assert.equal(initialSeasonsRes.data.activeSeason.seasonNumber, '3.0');

    // =========================================================================
    // 1. SPL 4.0 Registration Isolation
    // =========================================================================
    const spl4Slug = 'spl-4-0';
    const createSpl4Res = await apiJson(baseUrl, '/api/seasons', {
      method: 'POST',
      token: adminToken,
      body: {
        seasonNumber: '4.0',
        editionName: 'Grand Slam Edition',
        seasonSlug: spl4Slug,
        tournamentYear: 2027,
        entryFee: 600,
        maxSlots: 32,
        activateNow: false,
      },
    });
    assert.equal(createSpl4Res.status, 201, `Create SPL 4.0 failed: ${JSON.stringify(createSpl4Res.data)}`);
    assert.equal(createSpl4Res.data.season.seasonSlug, spl4Slug);
    assert.equal(createSpl4Res.data.season.seasonNumber, '4.0');

    // Update SPL 4.0 form entry fee to 600 explicitly so fee calculation reflects SPL 4.0
    const saveForm4 = await apiJson(baseUrl, `/api/forms/${spl4Slug}`, {
      method: 'POST',
      token: adminToken,
      body: {
        seasonSlug: spl4Slug,
        entryFee: 600,
        payment: {
          enabled: true,
          isMandatory: true,
          upiId: 'spl4@ybl',
          baseFee: 600,
          categoryFees: { Singles: 400, Doubles: 600, 'Mixed Doubles': 600, Both: 900 },
        },
      },
    });
    assert.equal(saveForm4.status, 200);

    const sharedMobile = '9876500001';
    const regS3Res = await apiJson(baseUrl, `/api/registrations?season=${spl3Slug}`, {
      method: 'POST',
      body: {
        name: 'Aarav Sharma',
        mobile: sharedMobile,
        gender: 'Male',
        category: 'Doubles',
        experience: 'Advanced',
        city: 'Maharajganj',
      },
    });
    assert.equal(regS3Res.status, 201, `SPL 3.0 registration failed: ${JSON.stringify(regS3Res.data)}`);
    const spl3Reg: Registration = regS3Res.data.registration;

    const spl4Athletes = [
      { name: 'Aarav Sharma', mobile: sharedMobile, gender: 'Male', experience: 'Pro' }, // repeat mobile!
      { name: 'Vivaan Verma', mobile: '9876500002', gender: 'Male', experience: 'Advanced' },
      { name: 'Reyansh Gupta', mobile: '9876500003', gender: 'Male', experience: 'Pro' },
      { name: 'Aditya Patel', mobile: '9876500004', gender: 'Male', experience: 'Intermediate' },
      { name: 'Ananya Singh', mobile: '9876500005', gender: 'Female', experience: 'Advanced' },
      { name: 'Diya Nair', mobile: '9876500006', gender: 'Female', experience: 'Pro' },
      { name: 'Kabir Mehta', mobile: '9876500007', gender: 'Male', experience: 'Advanced' },
      { name: 'Ishaan Joshi', mobile: '9876500008', gender: 'Male', experience: 'Intermediate' },
    ];

    const spl4Regs: Registration[] = [];
    for (const ath of spl4Athletes) {
      const r = await apiJson(baseUrl, `/api/registrations?season=${spl4Slug}`, {
        method: 'POST',
        body: { ...ath, category: 'Doubles' },
      });
      assert.equal(r.status, 201, `SPL 4.0 registration failed for ${ath.name}: ${JSON.stringify(r.data)}`);
      spl4Regs.push(r.data.registration);
    }

    // Duplicate mobile within same SPL 4.0 season must still be blocked (409)
    const dupS4 = await apiJson(baseUrl, `/api/registrations?season=${spl4Slug}`, {
      method: 'POST',
      body: { name: 'Duplicate Aarav', mobile: sharedMobile, gender: 'Male', category: 'Doubles' },
    });
    assert.equal(dupS4.status, 409, 'Same mobile within SPL 4.0 should be rejected as duplicate');

    const listS3 = await apiJson<Registration[]>(baseUrl, `/api/registrations?season=${spl3Slug}`, {
      token: adminToken,
    });
    const listS4 = await apiJson<Registration[]>(baseUrl, `/api/registrations?season=${spl4Slug}`, {
      token: adminToken,
    });
    assert.equal(listS3.data.length, 1);
    assert.equal(listS4.data.length, 8);
    assert.ok(listS4.data.every((r) => r.season === spl4Slug));
    assert.ok(listS3.data.every((r) => r.season === spl3Slug));
    console.log('✓ Workflow 1: SPL 4.0 Registration Isolation passed');

    // =========================================================================
    // 2. Team Shuffle (random, predefined, mixed, locked pairs, captaincy)
    // =========================================================================
    const players4: Player[] = spl4Regs.map((r, i) => ({
      id: `p4-${i + 1}`,
      name: r.name,
      gender: String(r.gender) === 'Female' || r.gender === 'F' ? 'F' : 'M',
      skillLevel: (r.experience as Player['skillLevel']) || 'Advanced',
      mobile: r.mobile,
      createdAt: Date.now(),
    }));

    const randomDraw = executeLotteryDraw({
      mode: 'random',
      players: players4,
      existingTeams: [],
      predefinedTeams: [],
      playersPerTeam: 2,
      numTeamsRequested: 4,
      selectedCaptains: [players4[0].id, players4[2].id, players4[4].id, players4[6].id],
    });
    assert.equal(randomDraw.success, true, randomDraw.error);
    assert.equal(randomDraw.teams.length, 4);
    assert.equal(
      validateLotteryDrawResult(
        {
          mode: 'random',
          players: players4,
          existingTeams: [],
          predefinedTeams: [],
          playersPerTeam: 2,
          numTeamsRequested: 4,
        },
        randomDraw.teams
      ).valid,
      true
    );
    assert.ok(randomDraw.teams.every((t) => Boolean(t.captainId) && t.players.includes(t.captainId!)));

    const lockedPairs = [{ id: 'pair-1', name: 'Locked Aces', players: [players4[0].id, players4[1].id] as [string, string] }];
    const predefinedDraw = executeLotteryDraw({
      mode: 'predefined',
      players: players4,
      existingTeams: randomDraw.teams,
      predefinedTeams: lockedPairs,
      playersPerTeam: 2,
      numTeamsRequested: 4,
    });
    assert.equal(predefinedDraw.success, true, predefinedDraw.error);
    assert.equal(
      validateLotteryDrawResult(
        {
          mode: 'predefined',
          players: players4,
          existingTeams: randomDraw.teams,
          predefinedTeams: lockedPairs,
          playersPerTeam: 2,
          numTeamsRequested: 4,
        },
        predefinedDraw.teams
      ).valid,
      true
    );

    const mixedDraw = executeLotteryDraw({
      mode: 'mixed',
      players: players4,
      existingTeams: predefinedDraw.teams,
      predefinedTeams: lockedPairs,
      playersPerTeam: 2,
      numTeamsRequested: 4,
    });
    assert.equal(mixedDraw.success, true, mixedDraw.error);
    const lockedTeamInMixed = mixedDraw.teams.find((t) => t.players.includes(players4[0].id));
    assert.ok(lockedTeamInMixed && lockedTeamInMixed.players.includes(players4[1].id), 'Locked pair stayed together in mixed mode');

    // Deterministic team list for scheduling & scoring tests
    const teams4: Team[] = mixedDraw.teams.map((t, idx) => ({
      ...t,
      name: `SPL4 Team ${idx + 1}`,
      captainId: t.players[0],
    }));

    const saveTeams4 = await apiJson(baseUrl, `/api/tournament/state?season=${spl4Slug}`, {
      method: 'POST',
      token: adminToken,
      body: { players: players4, teams: teams4 },
    });
    assert.equal(saveTeams4.status, 200);

    const checkS3State = await apiJson(baseUrl, `/api/tournament/state?season=${spl3Slug}`, { token: adminToken });
    assert.equal(checkS3State.data.teams.length, 0, 'SPL 3.0 teams must remain empty/isolated');
    console.log('✓ Workflow 2: Team Shuffle (random, predefined, mixed, locked pairs, captaincy) passed');

    // =========================================================================
    // 3. Schedule Generation
    // =========================================================================
    const generatedFixtures = normalizeScheduleSequence(
      generateRoundRobinFixtures(teams4, 2, ['Center Court', 'Court Alpha']),
      ['Center Court', 'Court Alpha']
    );
    assert.equal(generatedFixtures.length, 6, '4 teams round-robin produces 6 fixtures');
    assert.ok(generatedFixtures.every((m) => m.teamA !== m.teamB));
    assert.ok(generatedFixtures.some((m) => m.court === 1) && generatedFixtures.some((m) => m.court === 2));

    const replaceRes = await apiJson(baseUrl, `/api/tournament/schedule/replace?season=${spl4Slug}`, {
      method: 'POST',
      token: adminToken,
      body: { matches: generatedFixtures, courts: 2, courtNames: ['Center Court', 'Court Alpha'] },
    });
    assert.equal(replaceRes.status, 200);
    assert.equal(replaceRes.data.count, 6);
    console.log('✓ Workflow 3: Schedule Generation passed');

    // =========================================================================
    // 4. Manual Fixture Editing
    // =========================================================================
    const updatedM1 = updateMatchInDraft(
      generatedFixtures,
      generatedFixtures[0].id,
      { court: 2, date: '2027-10-25', startTime: '09:30' },
      ['Center Court', 'Court Alpha']
    );
    assert.equal(updatedM1.success, true, updatedM1.error);

    const movedM1 = moveMatchAcrossOrWithinCourt(
      updatedM1.matches,
      generatedFixtures[0].id,
      1,
      0,
      ['Center Court', 'Court Alpha']
    );
    const court1MovedList = movedM1.filter((m) => m.court === 1);
    assert.equal(court1MovedList[0].id, generatedFixtures[0].id);
    assert.equal(court1MovedList[0].court, 1);

    const addedDraft = addMatchToDraft(
      movedM1,
      {
        teamA: teams4[0].id,
        teamB: teams4[1].id,
        court: 2,
        round: 4,
        date: '2027-10-25',
        startTime: '18:00',
      },
      ['Center Court', 'Court Alpha']
    );
    assert.equal(addedDraft.success, true, addedDraft.error);
    assert.equal(addedDraft.matches.length, 7);

    const draftReport = validateScheduleDraft({
      draftMatches: addedDraft.matches,
      baselineMatches: generatedFixtures,
      teams: teams4,
      courtsCount: 2,
    });
    assert.equal(draftReport.valid, true, JSON.stringify(draftReport.errors));
    assert.equal(draftReport.hasChanges, true);

    // Check conflict detection (two matches on same court & time)
    const conflictDraft = updateMatchInDraft(
      addedDraft.matches,
      addedDraft.matches[1].id,
      { court: 1, date: '2027-10-25', startTime: '09:30' },
      ['Center Court', 'Court Alpha']
    );
    const conflictReport = validateScheduleDraft({
      draftMatches: conflictDraft.matches,
      baselineMatches: generatedFixtures,
      teams: teams4,
      courtsCount: 2,
    });
    assert.equal(conflictReport.valid, false);
    assert.ok(conflictReport.errors.some((e) => e.code === 'COURT_TIME_CONFLICT'));

    // Persist edited 6-match schedule (drop extra exhibition match before round-robin scoring)
    const saveEditedRes = await apiJson(baseUrl, `/api/tournament/schedule/replace?season=${spl4Slug}`, {
      method: 'POST',
      token: adminToken,
      body: { matches: movedM1, courts: 2, courtNames: ['Center Court', 'Court Alpha'] },
    });
    assert.equal(saveEditedRes.status, 200);
    const checkS3MatchesAfterEdit = await apiJson(baseUrl, `/api/tournament/state?season=${spl3Slug}`, { token: adminToken });
    assert.equal(checkS3MatchesAfterEdit.data.matches.length, 0);
    console.log('✓ Workflow 4: Manual Fixture Editing passed');

    // =========================================================================
    // 5. Live Match Scoring
    // =========================================================================
    assert.equal(evaluateSetStatus(21, 18).isFinished, true);
    assert.equal(evaluateSetStatus(21, 18).winner, 'A');
    assert.equal(evaluateSetStatus(20, 20).isDeuce, true);
    assert.equal(evaluateSetStatus(20, 20).isFinished, false);
    assert.equal(evaluateSetStatus(22, 20).isFinished, true);
    const bo3Check = evaluateMatchOverall(
      [
        { scoreA: 21, scoreB: 18, winner: 'A', isCompleted: true },
        { scoreA: 17, scoreB: 21, winner: 'B', isCompleted: true },
      ],
      21,
      15,
      { pointTarget: 21, setsToWin: 2, deuceEnabled: true, maxPointCap: 30, changeEndsAtInterval: true }
    );
    assert.equal(bo3Check.isMatchCompleted, true);
    assert.equal(bo3Check.matchWinner, 'A');

    // Score first match live, then complete all 6 matches deterministically:
    // Priority ranking: teams4[0] (3W), teams4[1] (2W), teams4[2] (1W), teams4[3] (0W)
    const rankWeight = new Map<string, number>(teams4.map((t, idx) => [t.id, idx]));

    const firstMatch = movedM1[0];
    const livePatch = await apiJson(baseUrl, `/api/tournament/matches/${firstMatch.id}?season=${spl4Slug}`, {
      method: 'PATCH',
      token: adminToken,
      body: { scoreA: 15, scoreB: 12, status: 'live' },
    });
    assert.equal(livePatch.status, 200);
    assert.equal(livePatch.data.match.status, 'live');
    assert.equal(livePatch.data.match.scoreA, 15);

    const scoredMatches: Match[] = [];
    for (const m of movedM1) {
      const wA = rankWeight.get(m.teamA)!;
      const wB = rankWeight.get(m.teamB)!;
      const aShouldWin = wA < wB;
      const scoreA = aShouldWin ? 21 : 14;
      const scoreB = aShouldWin ? 14 : 21;
      const patchRes = await apiJson(baseUrl, `/api/tournament/matches/${m.id}?season=${spl4Slug}`, {
        method: 'PATCH',
        token: adminToken,
        body: {
          scoreA,
          scoreB,
          status: 'completed',
          sets: [{ scoreA, scoreB, winner: aShouldWin ? 'A' : 'B', isCompleted: true }],
        },
      });
      assert.equal(patchRes.status, 200);
      assert.equal(patchRes.data.match.winner, aShouldWin ? m.teamA : m.teamB);
      scoredMatches.push(patchRes.data.match);
    }
    console.log('✓ Workflow 5: Live Match Scoring passed');

    // =========================================================================
    // 6. Standings & Recent Form
    // =========================================================================
    const standings4 = calculateStandings(teams4, scoredMatches);
    assert.equal(standings4.length, 4);
    assert.equal(standings4[0].team.id, teams4[0].id);
    assert.equal(standings4[0].played, 3);
    assert.equal(standings4[0].won, 3);
    assert.equal(standings4[0].lost, 0);
    assert.equal(standings4[0].points, 6);
    assert.deepEqual(standings4[0].form, ['W', 'W', 'W']);

    assert.equal(standings4[3].team.id, teams4[3].id);
    assert.equal(standings4[3].played, 3);
    assert.equal(standings4[3].won, 0);
    assert.equal(standings4[3].lost, 3);
    assert.equal(standings4[3].points, 0);
    assert.deepEqual(standings4[3].form, ['L', 'L', 'L']);

    const playoffStandings4 = calculatePlayoffLeagueStandings({
      teams: teams4,
      players: players4,
      matches: scoredMatches,
      qualifyingCutoff: 4,
    });
    assert.equal(playoffStandings4.rankedActive.map((r) => r.team.id).join(','), teams4.map((t) => t.id).join(','));
    console.log('✓ Workflow 6: Standings & Recent Form passed');

    // =========================================================================
    // 7. Knockout Qualification Cutoff
    // =========================================================================
    const rankedIds = standings4.map((s) => s.team.id);
    for (const [format, expectedCount, customCount] of [
      ['top3', 3, undefined],
      ['top4', 4, undefined],
      ['top5', 5, undefined],
      ['top6', 6, undefined],
      ['custom', 5, 5],
    ] as const) {
      const info = resolveStandingsQualificationInfo({
        knockout: {
          format,
          qualifyingTeamsCount: customCount,
          matches: [],
          published: true,
        },
        playoffSettings: { enabled: true, format, qualifyingTeamsCount: customCount ?? 4 },
        totalTeamsCount: 8,
        rankedTeamIds: [...rankedIds, 't5', 't6', 't7', 't8'],
      });
      assert.equal(info.configuredCount, expectedCount);
      assert.equal(info.effectiveCutoffCount, expectedCount);
      assert.equal(info.cutoffIndex, expectedCount - 1);
      assert.equal(info.cutoffLineDescription, `Green line signifies Top ${expectedCount} Knockout Qualification Cutoff`);
    }
    console.log('✓ Workflow 7: Knockout Qualification Cutoff passed');

    // =========================================================================
    // 8. Knockout Progression (Top 4 + Custom 5-team Eliminator -> SF -> Final)
    // =========================================================================
    const top4Bracket = generateFlexibleKnockoutBracket({
      format: 'top4',
      qualifiedTeamIds: rankedIds,
      courtsCount: 2,
      courtNames: ['Center Court', 'Court Alpha'],
    });
    assert.equal(top4Bracket.length, 3); // SF1, SF2, FINAL
    const sf1 = top4Bracket.find((m) => m.matchCode === 'SF1')!;
    const sf2 = top4Bracket.find((m) => m.matchCode === 'SF2')!;
    sf1.status = 'completed';
    sf1.scoreA = 21;
    sf1.scoreB = 14;
    sf1.winner = sf1.teamA;
    sf2.status = 'completed';
    sf2.scoreA = 21;
    sf2.scoreB = 18;
    sf2.winner = sf2.teamA;

    const progressedAfterSF = progressKnockoutBracket(top4Bracket, 'top4');
    const finalMatch = progressedAfterSF.matches.find((m) => m.matchCode === 'FINAL')!;
    assert.equal(finalMatch.teamA, sf1.teamA);
    assert.equal(finalMatch.teamB, sf2.teamA);

    finalMatch.status = 'completed';
    finalMatch.scoreA = 21;
    finalMatch.scoreB = 19;
    finalMatch.winner = finalMatch.teamA;
    const finalProgressed = progressKnockoutBracket(progressedAfterSF.matches, 'top4');
    assert.equal(finalProgressed.isCompleted, true);
    assert.equal(finalProgressed.championTeamId, sf1.teamA);
    assert.equal(finalProgressed.runnerUpTeamId, sf2.teamA);

    // Also test Custom Stage Builder progression (5 teams: 1 Eliminator -> 2 Semi Finals -> Grand Final)
    const fiveTeamIds = [...rankedIds, 'team-5-wild'];
    const customConfig = buildCustomKnockoutStageConfig({
      qualifyingTeamsCount: 5,
      eliminatorsCount: 1,
      semiFinalsCount: 2,
      courtsCount: 2,
      useSmartDefaults: true,
    });
    const customMatches = materializeCustomKnockoutMatches({
      config: customConfig,
      qualifiedTeamIds: fiveTeamIds,
      courtsCount: 2,
    });
    assert.equal(customMatches.length, 4); // E1, SF1, SF2, FINAL
    const cE1 = customMatches.find((m) => m.matchCode === 'E1')!;
    cE1.status = 'completed';
    cE1.scoreA = 21;
    cE1.scoreB = 16;
    cE1.winner = cE1.teamA;
    const afterCustomE1 = progressKnockoutBracket(customMatches, 'custom');
    const cSF1 = afterCustomE1.matches.find((m) => m.matchCode === 'SF1')!;
    assert.equal(cSF1.teamB, cE1.teamA, 'Eliminator winner advances into Semi Final 1');

    // Persist Top-4 knockout bracket into SPL 4.0 and verify live PATCH on knockout match
    const saveKoRes = await apiJson(baseUrl, `/api/tournament/state?season=${spl4Slug}`, {
      method: 'POST',
      token: adminToken,
      body: {
        knockout: {
          format: 'top4',
          qualifyingTeamsCount: 4,
          published: true,
          showOnPublicHomepage: true,
          matches: finalProgressed.matches,
          championTeamId: finalProgressed.championTeamId,
        },
      },
    });
    assert.equal(saveKoRes.status, 200);
    console.log('✓ Workflow 8: Knockout Progression passed');

    // =========================================================================
    // 9. Registration Payment & Pending Dues per Season
    // =========================================================================
    // Verify SPL 3.0 single registration as fully paid (500 INR)
    const payS3 = await apiJson(baseUrl, `/api/registrations/${spl3Reg.id}/verify-payment?season=${spl3Slug}`, {
      method: 'POST',
      token: adminToken,
      body: { paymentStatus: 'paid', method: 'upi', note: 'SPL 3.0 settled' },
    });
    assert.equal(payS3.status, 200);
    assert.equal(payS3.data.registration.fee, 500);
    assert.equal(payS3.data.registration.paidAmount, 500);

    // SPL 4.0: verify 2 full payments (600 each), 1 partial payment (250), bulk-approve first 3
    const payS4Full1 = await apiJson(baseUrl, `/api/registrations/${spl4Regs[0].id}/verify-payment?season=${spl4Slug}`, {
      method: 'POST',
      token: adminToken,
      body: { paymentStatus: 'paid', method: 'upi' },
    });
    const payS4Full2 = await apiJson(baseUrl, `/api/registrations/${spl4Regs[1].id}/verify-payment?season=${spl4Slug}`, {
      method: 'POST',
      token: adminToken,
      body: { paymentStatus: 'paid', method: 'cash' },
    });
    const payS4Partial = await apiJson(baseUrl, `/api/registrations/${spl4Regs[2].id}/verify-payment?season=${spl4Slug}`, {
      method: 'POST',
      token: adminToken,
      body: { paymentStatus: 'pending_verification', paidAmount: 250, method: 'upi' },
    });
    assert.equal(payS4Full1.status, 200);
    assert.equal(payS4Full2.status, 200);
    assert.equal(payS4Partial.status, 200);
    assert.equal(payS4Partial.data.registration.paidAmount, 250);

    const bulkAppRes = await apiJson(baseUrl, `/api/registrations/bulk-approve?season=${spl4Slug}`, {
      method: 'POST',
      token: adminToken,
      body: { ids: [spl4Regs[0].id, spl4Regs[1].id, spl4Regs[2].id] },
    });
    assert.equal(bulkAppRes.status, 200);

    const finalS3Regs = (await apiJson<Registration[]>(baseUrl, `/api/registrations?season=${spl3Slug}`, { token: adminToken })).data;
    const finalS4Regs = (await apiJson<Registration[]>(baseUrl, `/api/registrations?season=${spl4Slug}`, { token: adminToken })).data;

    const statsS3 = calculateRegistrationStats(finalS3Regs);
    const statsS4 = calculateRegistrationStats(finalS4Regs);
    assert.equal(statsS3.totalPayableAmount, 500);
    assert.equal(statsS3.collected, 500);
    assert.equal(statsS3.pendingAmount, 0);

    // SPL 4.0: 8 players * 600 = 4800 total; collected = 600 + 600 + 250 = 1450; pending = 3350
    const partialBreakdown = getRegistrationPaymentBreakdown(finalS4Regs.find((r) => r.id === spl4Regs[2].id)!);
    assert.equal(partialBreakdown.verifiedPaidAmount, 250);
    assert.equal(partialBreakdown.outstandingDue, 350);
    assert.equal(statsS4.totalPayableAmount, 4800);
    assert.equal(statsS4.collected, 1450);
    assert.equal(statsS4.pendingAmount, 3350);
    assert.equal(statsS4.byUpi, 850);
    assert.equal(statsS4.byCash, 600);
    console.log('✓ Workflow 9: Registration Payment & Pending Dues per Season passed');

    // =========================================================================
    // 10. Season Switching
    // =========================================================================
    const switchToS4 = await apiJson(baseUrl, '/api/seasons/active', {
      method: 'POST',
      token: adminToken,
      body: { seasonIdOrSlug: spl4Slug },
    });
    assert.equal(switchToS4.status, 200);
    assert.equal(switchToS4.data.activeSeason.seasonSlug, spl4Slug);

    const defaultStateNow = await apiJson(baseUrl, '/api/tournament/state', { token: adminToken });
    assert.equal(defaultStateNow.data.seasonSlug, spl4Slug);
    assert.equal(defaultStateNow.data.teams.length, 4);

    const switchBackToS3 = await apiJson(baseUrl, '/api/seasons/active', {
      method: 'POST',
      token: adminToken,
      body: { seasonIdOrSlug: spl3Slug },
    });
    assert.equal(switchBackToS3.status, 200);
    assert.equal(switchBackToS3.data.activeSeason.seasonSlug, spl3Slug);

    const defaultStateS3 = await apiJson(baseUrl, '/api/tournament/state', { token: adminToken });
    assert.equal(defaultStateS3.data.seasonSlug, spl3Slug);
    assert.equal(defaultStateS3.data.teams.length, 0);
    console.log('✓ Workflow 10: Season Switching passed');

    // =========================================================================
    // 11. Cross-Season Realtime / SSE / Storage Key Isolation
    // =========================================================================
    assert.notEqual(
      getSeasonStorageKey('smash-premier-league-v8', 'season-3'),
      getSeasonStorageKey('smash-premier-league-v8', 'season-4')
    );
    assert.notEqual(
      getSeasonStorageKey('smash-premier-league-v8', spl3Slug),
      getSeasonStorageKey('smash-premier-league-v8', spl4Slug)
    );

    sseS3 = new SseCollector(`${baseUrl}/api/tournament/stream?season=${spl3Slug}`);
    sseS4 = new SseCollector(`${baseUrl}/api/tournament/stream?season=${spl4Slug}`);
    await Promise.all([sseS3.waitConnected(), sseS4.waitConnected()]);

    const eventsS3Before = sseS3.events.length;
    const eventsS4Before = sseS4.events.length;

    const sseMutation = await apiJson(baseUrl, `/api/tournament/matches/${scoredMatches[0].id}?season=${spl4Slug}`, {
      method: 'PATCH',
      token: adminToken,
      body: { scoreA: 21, scoreB: 15, status: 'completed' },
    });
    assert.equal(sseMutation.status, 200);

    // Allow SSE chunks to arrive
    await new Promise((r) => setTimeout(r, 250));

    const newS4Events = sseS4.events.slice(eventsS4Before);
    const newS3Events = sseS3.events.slice(eventsS3Before);
    assert.ok(
      newS4Events.some((e) => e.event === 'match_score' && e.data?.seasonSlug === spl4Slug),
      `Expected match_score SSE event for ${spl4Slug}, got: ${JSON.stringify(newS4Events)}`
    );
    assert.equal(
      newS3Events.filter((e) => e.data?.seasonSlug === spl4Slug).length,
      0,
      `SPL 3.0 SSE stream received leaked SPL 4.0 events: ${JSON.stringify(newS3Events)}`
    );
    sseS3.close();
    sseS4.close();
    sseS3 = null;
    sseS4 = null;
    console.log('✓ Workflow 11: Cross-Season Realtime / SSE / Storage Key Isolation passed');

    // =========================================================================
    // 12. Security Checks & Season Status Transitions
    // =========================================================================
    // Unauthenticated & forged session/token rejection
    for (const badToken of [undefined, 'spl_sess_forgedtoken12345', 'spl_tk_forgedtoken12345']) {
      const unauthSeason = await apiJson(baseUrl, '/api/seasons', {
        method: 'POST',
        token: badToken,
        body: { seasonNumber: '5.0', editionName: 'Unauthorized', seasonSlug: 'season-5' },
      });
      assert.equal(unauthSeason.status, 401, `Expected 401 for token=${badToken}`);

      const unauthState = await apiJson(baseUrl, `/api/tournament/state?season=${spl4Slug}`, {
        method: 'POST',
        token: badToken,
        body: { announcement: 'Hacked' },
      });
      assert.equal(unauthState.status, 401);

      const unauthMatch = await apiJson(baseUrl, `/api/tournament/matches/${scoredMatches[0].id}?season=${spl4Slug}`, {
        method: 'PATCH',
        token: badToken,
        body: { scoreA: 99, scoreB: 0 },
      });
      assert.equal(unauthMatch.status, 401);
    }

    // Status transitions: upcoming & completed on a temporary season work cleanly
    const tempStatusRes = await apiJson(baseUrl, `/api/seasons/${spl4Slug}/status`, {
      method: 'PATCH',
      token: adminToken,
      body: { status: 'upcoming' },
    });
    assert.equal(tempStatusRes.status, 200);
    assert.equal(tempStatusRes.data.season.status, 'upcoming');

    const activeStatusRes = await apiJson(baseUrl, `/api/seasons/${spl4Slug}/status`, {
      method: 'PATCH',
      token: adminToken,
      body: { status: 'active' },
    });
    assert.equal(activeStatusRes.status, 200);
    assert.equal(activeStatusRes.data.season.status, 'active');

    // Archive SPL 3.0 and assert read-only locks across mutations & public registrations
    const archiveS3Res = await apiJson(baseUrl, `/api/seasons/${spl3Slug}/status`, {
      method: 'PATCH',
      token: adminToken,
      body: { status: 'archived' },
    });
    assert.equal(archiveS3Res.status, 200);
    assert.equal(archiveS3Res.data.season.status, 'archived');
    assert.equal(archiveS3Res.data.season.isLocked, true);

    const archivedRegRes = await apiJson(baseUrl, `/api/registrations?season=${spl3Slug}`, {
      method: 'POST',
      body: { name: 'Late Entry', mobile: '9876599999', gender: 'Male', category: 'Doubles' },
    });
    assert.equal(archivedRegRes.status, 403, 'Archived season must block new registrations');

    const archivedStateRes = await apiJson(baseUrl, `/api/tournament/state?season=${spl3Slug}`, {
      method: 'POST',
      token: adminToken,
      body: { announcement: 'Attempt edit archived' },
    });
    assert.equal(archivedStateRes.status, 403, 'Archived season must block state writes');

    const archivedSchedRes = await apiJson(baseUrl, `/api/tournament/schedule/replace?season=${spl3Slug}`, {
      method: 'POST',
      token: adminToken,
      body: { matches: [], courts: 2, courtNames: [] },
    });
    assert.equal(archivedSchedRes.status, 403, 'Archived season must block schedule replacement');

    const archivedPayRes = await apiJson(baseUrl, `/api/registrations/${spl3Reg.id}/verify-payment?season=${spl3Slug}`, {
      method: 'POST',
      token: adminToken,
      body: { paymentStatus: 'unpaid' },
    });
    assert.equal(archivedPayRes.status, 403, 'Archived season must block payment modifications');

    // Confirm SPL 4.0 remains fully writable after SPL 3.0 is archived
    const writableS4Res = await apiJson(baseUrl, `/api/tournament/state?season=${spl4Slug}`, {
      method: 'POST',
      token: adminToken,
      body: {
        settings: {
          name: 'Smash Premier League',
          date: '2027-10-25',
          venue: 'Maharajganj Indoor Stadium',
          organizer: 'SPL Committee',
          courts: 2,
          format: '21',
          entryFee: 600,
          slotLimit: 32,
          season: 'Season 4.0 (Grand Slam Edition)',
          announcement: 'SPL 4.0 Live!',
        },
      },
    });
    assert.equal(writableS4Res.status, 200, 'SPL 4.0 must stay writable when SPL 3.0 is archived');
    console.log('✓ Workflow 12: Security Checks (401 unauth/forged + 403 archived lock + SPL 4.0 writable) passed');

    if (serverLogs.includes('[stderr]')) {
      console.warn('[Server logs had stderr output]', serverLogs);
    }
    console.log('\n✅ ALL 12 PHASE 3 SEASON REGRESSION WORKFLOWS PASSED!');
  } finally {
    sseS3?.close();
    sseS4?.close();
    if (serverProc && !serverProc.killed) {
      serverProc.kill('SIGTERM');
      await new Promise((r) => setTimeout(r, 300));
      if (!serverProc.killed) {
        serverProc.kill('SIGKILL');
      }
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

runTests().catch((err) => {
  console.error('❌ Phase 3 regression suite failed:', err);
  process.exit(1);
});
