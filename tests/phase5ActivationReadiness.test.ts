import assert from 'node:assert/strict';
import { spawn, ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

import { buildSeasonInitialHeroConfig } from '../src/utils/heroDefaults';
import { SeasonArchiveSnapshot, SeasonSummaryCounts, TournamentSeason } from '../src/types/tournament';

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
    // keep raw string
  }
  return { status: res.status, data: parsed };
}

function runHeroSpl4DefaultsUnitCheck() {
  const spl4Hero = buildSeasonInitialHeroConfig({
    seasonNumber: '4.0',
    editionName: 'To Be Announced',
    leagueName: 'SMASH PREMIER LEAGUE',
    seasonSlug: 'spl-4-0',
  });
  assert.equal(spl4Hero.text.mainHeading.text, 'SMASH PREMIER LEAGUE 4.0');
  assert.equal(spl4Hero.text.kickerText, 'TO BE ANNOUNCED');
  assert.equal(spl4Hero.logo.subtitle, 'SPL 4.0 · TO BE ANNOUNCED');
  console.log('✓ Unit check: SPL 4.0 Hero initial config renders SMASH PREMIER LEAGUE 4.0 & TO BE ANNOUNCED');
}

async function runPhase5Tests() {
  runHeroSpl4DefaultsUnitCheck();

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spl-phase5-test-'));
  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  let serverProc: ChildProcess | null = null;

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

    const loginRes = await apiJson(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: { identifier: 'admin', password: 'smash2026' },
    });
    assert.equal(loginRes.status, 200);
    const adminToken: string = loginRes.data.token;

    // 1. Seed verified SPL 3.0 historical records (10 paid @ ₹250 = ₹2,500 + Grand Final result)
    const spl3Slug = 'season-4';
    for (let i = 1; i <= 10; i++) {
      const regRes = await apiJson(baseUrl, `/api/registrations?season=${spl3Slug}`, {
        method: 'POST',
        body: {
          name: `SPL3 Player ${i}`,
          mobile: `99000000${String(i).padStart(2, '0')}`,
          gender: 'Male',
          category: 'Doubles',
          experience: 'Pro',
          feeAmount: 250,
          paymentStatus: 'paid',
        },
      });
      assert.equal(regRes.status, 201);
      // Confirm paid fee amount in admin update if public POST normalized defaults
      await apiJson(baseUrl, `/api/registrations/${regRes.data.registration.id}`, {
        method: 'PATCH',
        token: adminToken,
        body: {
          status: 'approved',
          paymentStatus: 'paid',
          fee: 250,
          paidAmount: 250,
          seasonSlug: spl3Slug,
        },
      });
    }

    const seedSpl3State = await apiJson(baseUrl, `/api/tournament/state?season=${spl3Slug}`, {
      method: 'POST',
      token: adminToken,
      body: {
        settings: {
          name: 'Smash Premier League',
          date: '2026-10-25',
          venue: 'Maharajganj Indoor Badminton Stadium',
          organizer: 'SPL Committee',
          courts: 2,
          courtNames: ['Court 1', 'Court 2'],
          format: '21',
          entryFee: 250,
          slotLimit: 32,
          season: 'SPL 3.0 (Champion Edition)',
          announcement: 'Congratulations Champions Karan & Saptrishi!',
        },
        players: [
          { id: 'p_karan', name: 'Karan', gender: 'M', skillLevel: 'Pro', createdAt: 1 },
          { id: 'p_saptrishi', name: 'Saptrishi', gender: 'M', skillLevel: 'Pro', createdAt: 2 },
          { id: 'p_alok', name: 'Alok', gender: 'M', skillLevel: 'Pro', createdAt: 3 },
          { id: 'p_ravi', name: 'Ravi', gender: 'M', skillLevel: 'Pro', createdAt: 4 },
        ],
        teams: [
          { id: 't_karan', name: 'Team Karan', players: ['p_karan', 'p_saptrishi'], createdAt: 1 },
          { id: 't_alok', name: 'Team Alok', players: ['p_alok', 'p_ravi'], createdAt: 2 },
        ],
        matches: [
          {
            id: 'm_league_1',
            teamA: 't_karan',
            teamB: 't_alok',
            scoreA: 21,
            scoreB: 16,
            winner: 't_karan',
            status: 'completed',
            court: 1,
            round: 1,
            createdAt: 1,
          },
        ],
        knockout: {
          format: 'top4',
          published: true,
          showOnPublicHomepage: true,
          matches: [
            {
              id: 'ko_final',
              stage: 'F',
              slot: 1,
              teamA: 't_karan',
              teamB: 't_alok',
              scoreA: 21,
              scoreB: 18,
              winner: 't_karan',
              status: 'completed',
            },
          ],
        },
      },
    });
    assert.equal(seedSpl3State.status, 200);

    // 2. Create SPL 4.0 cleanly without invented dates or operational data
    const createSpl4 = await apiJson<{ season: TournamentSeason }>(baseUrl, '/api/seasons', {
      method: 'POST',
      token: adminToken,
      body: {
        seasonNumber: '4.0',
        editionName: 'To Be Announced',
        seasonSlug: 'spl-4-0',
        tournamentYear: 2026,
        status: 'upcoming',
        activateNow: false,
        entryFee: 250,
        maxSlots: 32,
      },
    });
    assert.equal(createSpl4.status, 201);
    assert.equal(createSpl4.data.season.seasonNumber, '4.0');
    assert.equal(createSpl4.data.season.editionName, 'To Be Announced');
    assert.equal(createSpl4.data.season.status, 'upcoming');
    assert.equal(createSpl4.data.season.tournamentYear, 2026);
    assert.equal(createSpl4.data.season.isActive, false);
    assert.equal(createSpl4.data.season.date || '', '');
    assert.equal(createSpl4.data.season.startDate || '', '');

    // Verify SPL 4.0 state has ZERO invented dates, registrations, teams, players, matches, or announcements
    const spl4InitState = await apiJson(baseUrl, '/api/tournament/state?season=spl-4-0', {
      token: adminToken,
    });
    assert.equal(spl4InitState.status, 200);
    assert.equal(spl4InitState.data.players.length, 0);
    assert.equal(spl4InitState.data.teams.length, 0);
    assert.equal(spl4InitState.data.matches.length, 0);
    assert.equal(spl4InitState.data.knockout.matches.length, 0);
    assert.equal(spl4InitState.data.settings.date || '', '');
    assert.equal(spl4InitState.data.settings.announcement || '', '');

    // 3. Activate SPL 4.0 safely (0 live matches in SPL 3.0)
    const activateRes = await apiJson(baseUrl, '/api/seasons/active', {
      method: 'POST',
      token: adminToken,
      body: {
        seasonIdOrSlug: 'spl-4-0',
        checkOngoingMatches: true,
        force: false,
      },
    });
    assert.equal(activateRes.status, 200);
    assert.equal(activateRes.data.activeSeason.seasonSlug, 'spl-4-0');
    assert.equal(activateRes.data.activeSeason.isActive, true);
    assert.equal(activateRes.data.activeSeason.status, 'active');

    // Verify public active season & Hero branding
    const publicSeasons = await apiJson<{ activeSeason: TournamentSeason; seasons: TournamentSeason[] }>(
      baseUrl,
      '/api/seasons'
    );
    assert.equal(publicSeasons.status, 200);
    assert.equal(publicSeasons.data.activeSeason.seasonSlug, 'spl-4-0');
    const spl3Meta = publicSeasons.data.seasons.find((s) => s.seasonSlug === 'season-4');
    assert.ok(spl3Meta);
    assert.equal(spl3Meta.status, 'completed');
    assert.equal(spl3Meta.historicalSummary?.champions, 'Karan & Saptrishi');
    assert.equal(spl3Meta.historicalSummary?.runnersUp, 'Alok & Ravi');

    const spl4Hero = await apiJson(baseUrl, '/api/hero/published?season=spl-4-0');
    assert.equal(spl4Hero.status, 200);
    assert.equal(spl4Hero.data.heroConfig.text.mainHeading.text, 'SMASH PREMIER LEAGUE 4.0');
    assert.equal(spl4Hero.data.heroConfig.text.kickerText, 'TO BE ANNOUNCED');

    // 4. Verify unauthenticated snapshot is blocked & authenticated SPL 3.0 snapshot preserves 100% of history
    const unauthSnap = await apiJson(baseUrl, '/api/seasons/season-4/snapshot');
    assert.equal(unauthSnap.status, 401);

    const spl3Snap = await apiJson<SeasonArchiveSnapshot>(baseUrl, '/api/seasons/season-4/snapshot', {
      token: adminToken,
    });
    assert.equal(spl3Snap.status, 200);
    assert.equal(spl3Snap.data.season.seasonSlug, 'season-4');
    assert.equal(spl3Snap.data.registrations.length, 10);
    assert.equal(spl3Snap.data.paidCount, 10);
    assert.equal(spl3Snap.data.revenueCollected, 2500);
    assert.equal(spl3Snap.data.teams.length, 2);
    assert.equal(spl3Snap.data.players.length, 4);
    assert.equal(spl3Snap.data.matches.length, 1);
    assert.equal(spl3Snap.data.knockout.matches.length, 1);
    assert.equal(spl3Snap.data.knockout.matches[0].winner, 't_karan');

    // 5. Summaries reflect strict isolation between SPL 3.0 and active SPL 4.0
    const summariesRes = await apiJson<{ summaries: Record<string, SeasonSummaryCounts> }>(
      baseUrl,
      '/api/seasons/summaries',
      { token: adminToken }
    );
    assert.equal(summariesRes.status, 200);
    assert.equal(summariesRes.data.summaries['season-4'].registeredPlayers, 10);
    assert.equal(summariesRes.data.summaries['season-4'].teamsCount, 2);
    assert.equal(summariesRes.data.summaries['season-4'].matchesCount, 2);
    assert.equal(summariesRes.data.summaries['spl-4-0'].registeredPlayers, 0);
    assert.equal(summariesRes.data.summaries['spl-4-0'].teamsCount, 0);
    assert.equal(summariesRes.data.summaries['spl-4-0'].matchesCount, 0);

    console.log('✓ All Phase 5 activation readiness, SPL 3.0 preservation, and SPL 4.0 isolation assertions passed');
  } finally {
    if (serverProc && !serverProc.killed) {
      serverProc.kill('SIGTERM');
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

void runPhase5Tests().catch((err) => {
  console.error('❌ Phase 5 activation readiness tests failed:', err);
  process.exit(1);
});
