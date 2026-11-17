import assert from 'node:assert/strict';
import { spawn, ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

import {
  DEFAULT_HERO_CONFIG,
  DEFAULT_SEASON_BRANDING,
  SEASON_DESIGN_PRESETS,
  applySeasonDesignPreset,
  buildSeasonInitialHeroConfig,
  isDefaultSpl3OriginalBranding,
  normalizeSeasonBranding,
} from '../src/utils/heroDefaults';
import { SeasonSummaryCounts, TournamentSeason } from '../src/types/tournament';

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

function runHeroDefaultsUnitTests() {
  // 1. Default SPL 3.0 branding preservation check
  assert.equal(isDefaultSpl3OriginalBranding(DEFAULT_SEASON_BRANDING), true);
  assert.equal(DEFAULT_SEASON_BRANDING.presetId, 'spl-3-original');
  assert.equal(DEFAULT_SEASON_BRANDING.primaryGradientColor, '#fde68a');
  assert.equal(DEFAULT_SEASON_BRANDING.midGradientColor, '#fbbf24');
  assert.equal(DEFAULT_SEASON_BRANDING.secondaryGradientColor, '#f97316');
  assert.equal(DEFAULT_SEASON_BRANDING.editionBadgeBgOpacity, 0);

  // 2. Preset lookup & application
  assert.equal(SEASON_DESIGN_PRESETS.length, 5);
  const electricConfig = applySeasonDesignPreset(DEFAULT_HERO_CONFIG, 'electric-red');
  assert.equal(electricConfig.seasonBranding?.presetId, 'electric-red');
  assert.equal(electricConfig.seasonBranding?.glowEnabled, true);
  assert.equal(electricConfig.seasonBranding?.glowColor, '#f43f5e');
  assert.equal(electricConfig.text.kickerColor, '#fda4af');
  assert.equal(isDefaultSpl3OriginalBranding(electricConfig.seasonBranding), false);

  // 3. Normalization bounds & legacy versionColor bridge
  const legacyBridged = normalizeSeasonBranding(undefined, '#22d3ee');
  assert.equal(legacyBridged.presetId, 'custom');
  assert.equal(legacyBridged.useGradient, false);
  assert.equal(legacyBridged.textColor, '#22d3ee');
  assert.equal(isDefaultSpl3OriginalBranding(legacyBridged, '#22d3ee'), false);

  const clamped = normalizeSeasonBranding({
    fontSizeDesktop: 999,
    fontSizeMobile: 5,
    outlineThickness: 20,
    glowIntensity: 200,
    editionBadgeBgOpacity: -10,
  });
  assert.equal(clamped.fontSizeDesktop, 120);
  assert.equal(clamped.fontSizeMobile, 20);
  assert.equal(clamped.outlineThickness, 4);
  assert.equal(clamped.glowIntensity, 100);
  assert.equal(clamped.editionBadgeBgOpacity, 0);

  // 4. Isolated initial Hero config builder for new seasons
  const spl4Hero = buildSeasonInitialHeroConfig({
    seasonNumber: '4.0',
    editionName: 'Grand Slam Edition',
    leagueName: 'Smash Premier League',
    seasonSlug: 'spl-4-0',
  });
  assert.equal(spl4Hero.text.mainHeading.text, 'SMASH PREMIER LEAGUE 4.0');
  assert.equal(spl4Hero.text.kickerText, 'GRAND SLAM EDITION');
  assert.equal(spl4Hero.logo.subtitle, 'SPL 4.0 · GRAND SLAM EDITION');
  assert.equal(isDefaultSpl3OriginalBranding(spl4Hero.seasonBranding), true);

  console.log('✓ Unit tests: heroDefaults Season Design presets, sanitization & SPL 3.0 lock passed');
}

async function runPhase4Tests() {
  runHeroDefaultsUnitTests();

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spl-phase4-test-'));
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
    console.log(`[Harness] Isolated Phase 4 API server ready at ${baseUrl}`);

    // Admin Login
    const loginRes = await apiJson(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: { identifier: 'admin', password: 'smash2026' },
    });
    assert.equal(loginRes.status, 200, `Admin login failed: ${JSON.stringify(loginRes.data)}`);
    const adminToken: string = loginRes.data.token;

    // -------------------------------------------------------------------------
    // 1. Original SPL 3.0 verification & seed operational records
    // -------------------------------------------------------------------------
    const initialSeasons = await apiJson<{ activeSeason: TournamentSeason; seasons: TournamentSeason[] }>(
      baseUrl,
      '/api/seasons'
    );
    assert.equal(initialSeasons.status, 200);
    const spl3Slug = initialSeasons.data.activeSeason.seasonSlug;
    assert.equal(spl3Slug, 'season-4');
    assert.equal(initialSeasons.data.activeSeason.seasonNumber, '3.0');

    const spl3HeroInit = await apiJson(baseUrl, `/api/hero/published?season=${spl3Slug}`);
    assert.equal(spl3HeroInit.status, 200);
    assert.equal(
      isDefaultSpl3OriginalBranding(spl3HeroInit.data.heroConfig?.seasonBranding),
      true,
      'SPL 3.0 must preserve exact spl-3-original branding initially'
    );

    // Seed 1 registration + 2 teams + 1 live match + custom rules in SPL 3.0
    const s3Reg = await apiJson(baseUrl, `/api/registrations?season=${spl3Slug}`, {
      method: 'POST',
      body: {
        name: 'SPL3 Legend',
        mobile: '9800011122',
        gender: 'Male',
        category: 'Doubles',
        experience: 'Pro',
      },
    });
    assert.equal(s3Reg.status, 201);

    const s3SeedState = await apiJson(baseUrl, `/api/tournament/state?season=${spl3Slug}`, {
      method: 'POST',
      token: adminToken,
      body: {
        settings: {
          name: 'Smash Premier League',
          date: '2026-10-25',
          venue: 'Maharajganj Arena',
          organizer: 'SPL Committee',
          courts: 3,
          courtNames: ['Center Court', 'Court 2', 'Court 3'],
          format: '21',
          entryFee: 750,
          slotLimit: 48,
          season: 'Season III (Champion Edition)',
          announcement: 'SPL 3.0 Live',
          scoringRules: {
            pointTarget: 21,
            setsToWin: 3,
            deuceEnabled: true,
            maxPointCap: 30,
            changeEndsAtInterval: true,
          },
          playoffSettings: {
            enabled: true,
            format: 'top5',
            qualifyingTeamsCount: 5,
          },
        },
        players: [
          { id: 's3p1', name: 'A1', gender: 'M', skillLevel: 'Pro', createdAt: Date.now() },
          { id: 's3p2', name: 'A2', gender: 'M', skillLevel: 'Pro', createdAt: Date.now() },
          { id: 's3p3', name: 'B1', gender: 'M', skillLevel: 'Advanced', createdAt: Date.now() },
          { id: 's3p4', name: 'B2', gender: 'M', skillLevel: 'Advanced', createdAt: Date.now() },
        ],
        teams: [
          { id: 's3t1', name: 'Smash Kings', players: ['s3p1', 's3p2'], createdAt: Date.now() },
          { id: 's3t2', name: 'Net Ninjas', players: ['s3p3', 's3p4'], createdAt: Date.now() },
        ],
        matches: [
          {
            id: 's3m1',
            teamA: 's3t1',
            teamB: 's3t2',
            scoreA: 14,
            scoreB: 11,
            status: 'live',
            court: 1,
            round: 1,
            createdAt: Date.now(),
          },
        ],
      },
    });
    assert.equal(s3SeedState.status, 200);
    console.log('✓ 1. SPL 3.0 original branding & operational baseline verified');

    // -------------------------------------------------------------------------
    // 2. Create SPL 4.0 cleanly (not active yet, safe rule copy, zero operational records)
    // -------------------------------------------------------------------------
    const spl4Slug = 'spl-4-0';
    const createSpl4 = await apiJson(baseUrl, '/api/seasons', {
      method: 'POST',
      token: adminToken,
      body: {
        seasonNumber: '4.0',
        editionName: 'Electric Smash Edition',
        seasonSlug: spl4Slug,
        tournamentYear: 2027,
        startDate: '2027-11-10',
        endDate: '2027-11-12',
        description: 'Fourth championship season with custom arena branding.',
        status: 'upcoming',
        activateNow: false,
        copySettingsFromSeasonSlug: spl3Slug,
      },
    });
    assert.equal(createSpl4.status, 201, `Create SPL 4.0 failed: ${JSON.stringify(createSpl4.data)}`);
    assert.equal(createSpl4.data.season.isActive, false);
    assert.equal(createSpl4.data.season.status, 'upcoming');
    assert.equal(createSpl4.data.season.entryFee, 750);
    assert.equal(createSpl4.data.season.maxSlots, 48);
    assert.equal(createSpl4.data.season.courtsCount, 3);
    assert.equal(createSpl4.data.season.startDate, '2027-11-10');
    assert.equal(createSpl4.data.season.endDate, '2027-11-12');
    assert.equal(createSpl4.data.season.description, 'Fourth championship season with custom arena branding.');

    // Verify safe copy preserved rules but zero operational rows
    const spl4State = await apiJson(baseUrl, `/api/tournament/state?season=${spl4Slug}`, { token: adminToken });
    assert.equal(spl4State.status, 200);
    assert.equal(spl4State.data.players.length, 0);
    assert.equal(spl4State.data.teams.length, 0);
    assert.equal(spl4State.data.matches.length, 0);
    assert.equal(spl4State.data.settings.scoringRules?.setsToWin, 3);
    assert.equal(spl4State.data.settings.playoffSettings?.qualifyingTeamsCount, 5);

    const summariesAfterCreate = await apiJson<{ summaries: Record<string, SeasonSummaryCounts> }>(
      baseUrl,
      '/api/seasons/summaries',
      { token: adminToken }
    );
    assert.equal(summariesAfterCreate.status, 200);
    assert.equal(summariesAfterCreate.data.summaries[spl3Slug].registeredPlayers, 1);
    assert.equal(summariesAfterCreate.data.summaries[spl3Slug].teamsCount, 2);
    assert.equal(summariesAfterCreate.data.summaries[spl3Slug].matchesCount, 1);
    assert.equal(summariesAfterCreate.data.summaries[spl3Slug].liveMatchesCount, 1);
    assert.equal(summariesAfterCreate.data.summaries[spl4Slug].registeredPlayers, 0);
    assert.equal(summariesAfterCreate.data.summaries[spl4Slug].teamsCount, 0);
    assert.equal(summariesAfterCreate.data.summaries[spl4Slug].matchesCount, 0);

    // Active season must still be SPL 3.0
    const seasonsAfterCreate = await apiJson(baseUrl, '/api/seasons');
    assert.equal(seasonsAfterCreate.data.activeSeason.seasonSlug, spl3Slug);
    console.log('✓ 2. SPL 4.0 creation: safe rule copy, zero historical records, active season preserved');

    // -------------------------------------------------------------------------
    // 3. Edit SPL 4.0 metadata (PATCH /api/seasons/:slug) & hero label auto-sync
    // -------------------------------------------------------------------------
    const editSpl4 = await apiJson(baseUrl, `/api/seasons/${spl4Slug}`, {
      method: 'PATCH',
      token: adminToken,
      body: {
        editionName: 'Apex Masters Edition',
        description: 'Updated Season 4.0 championship details.',
        startDate: '2027-11-18',
        entryFee: 850,
      },
    });
    assert.equal(editSpl4.status, 200);
    assert.equal(editSpl4.data.season.editionName, 'Apex Masters Edition');
    assert.equal(editSpl4.data.season.description, 'Updated Season 4.0 championship details.');
    assert.equal(editSpl4.data.season.startDate, '2027-11-18');
    assert.equal(editSpl4.data.season.entryFee, 850);

    const spl4HeroAfterRename = await apiJson(baseUrl, `/api/hero/published?season=${spl4Slug}`);
    assert.equal(spl4HeroAfterRename.data.heroConfig.text.kickerText, 'APEX MASTERS EDITION');
    console.log('✓ 3. SPL 4.0 metadata update & Hero kicker sync passed');

    // -------------------------------------------------------------------------
    // 4. Customize SPL 4.0 Design Studio Draft -> Publish isolation
    // -------------------------------------------------------------------------
    const spl4AdminHero = await apiJson(baseUrl, `/api/hero/admin/state?season=${spl4Slug}`, {
      token: adminToken,
    });
    assert.equal(spl4AdminHero.status, 200);

    const customElectricDraft = applySeasonDesignPreset(spl4AdminHero.data.draft, 'electric-red');
    customElectricDraft.seasonBranding = {
      ...customElectricDraft.seasonBranding!,
      textShadowEnabled: true,
      textShadowBlur: 18,
      glowEnabled: true,
      glowIntensity: 70,
      outlineThickness: 2,
      outlineColor: '#1f2937',
      editionBadgeBgOpacity: 65,
      editionItalic: true,
    };

    const saveDraftRes = await apiJson(baseUrl, `/api/hero/draft?season=${spl4Slug}`, {
      method: 'POST',
      token: adminToken,
      body: { config: customElectricDraft, author: 'Studio Admin' },
    });
    assert.equal(saveDraftRes.status, 200);
    assert.equal(saveDraftRes.data.draft.seasonBranding.presetId, 'electric-red');

    // Published hero for SPL 4.0 MUST remain untouched before publish!
    const spl4PubBeforePublish = await apiJson(baseUrl, `/api/hero/published?season=${spl4Slug}`);
    assert.equal(isDefaultSpl3OriginalBranding(spl4PubBeforePublish.data.heroConfig.seasonBranding), true);

    // Publish SPL 4.0 custom branding
    const publishSpl4Res = await apiJson(baseUrl, `/api/hero/publish?season=${spl4Slug}`, {
      method: 'POST',
      token: adminToken,
      body: {
        config: saveDraftRes.data.draft,
        author: 'Studio Admin',
        summary: 'Applied Electric Red season design preset',
      },
    });
    assert.equal(publishSpl4Res.status, 200);
    assert.equal(publishSpl4Res.data.published.seasonBranding.presetId, 'electric-red');
    assert.equal(publishSpl4Res.data.published.seasonBranding.glowIntensity, 70);
    assert.equal(publishSpl4Res.data.published.seasonBranding.outlineThickness, 2);
    assert.equal(publishSpl4Res.data.published.seasonBranding.editionItalic, true);

    // Confirm SPL 3.0 published branding stayed untouched as spl-3-original
    const spl3PubAfterSpl4Design = await apiJson(baseUrl, `/api/hero/published?season=${spl3Slug}`);
    assert.equal(isDefaultSpl3OriginalBranding(spl3PubAfterSpl4Design.data.heroConfig.seasonBranding), true);
    console.log('✓ 4. Draft vs Publish isolation & SPL 4.0 Electric Red design publish passed');

    // -------------------------------------------------------------------------
    // 5. Safe Season Activation Guard (409 on live match -> force: true succeeds)
    // -------------------------------------------------------------------------
    const guardedActivateRes = await apiJson(baseUrl, '/api/seasons/active', {
      method: 'POST',
      token: adminToken,
      body: { seasonIdOrSlug: spl4Slug, checkOngoingMatches: true },
    });
    assert.equal(guardedActivateRes.status, 409, 'Expected 409 conflict when SPL 3.0 has live match');
    assert.equal(guardedActivateRes.data.requiresConfirmation, true);
    assert.equal(guardedActivateRes.data.liveMatchesCount, 1);

    const forceActivateRes = await apiJson(baseUrl, '/api/seasons/active', {
      method: 'POST',
      token: adminToken,
      body: { seasonIdOrSlug: spl4Slug, checkOngoingMatches: true, force: true },
    });
    assert.equal(forceActivateRes.status, 200);
    assert.equal(forceActivateRes.data.activeSeason.seasonSlug, spl4Slug);
    assert.equal(forceActivateRes.data.activeSeason.isActive, true);
    assert.equal(
      forceActivateRes.data.seasons.filter((s: TournamentSeason) => s.isActive).length,
      1,
      'Exactly one season must be active'
    );
    console.log('✓ 5. Live-match activation guard (409) & force activation passed');

    // -------------------------------------------------------------------------
    // 6. Create & activate SPL 5.0 -> Re-activate SPL 4.0 (retains Electric Red design)
    // -------------------------------------------------------------------------
    const spl5Slug = 'spl-5-0';
    const createSpl5 = await apiJson(baseUrl, '/api/seasons', {
      method: 'POST',
      token: adminToken,
      body: {
        seasonNumber: '5.0',
        editionName: 'Platinum Slam',
        seasonSlug: spl5Slug,
        tournamentYear: 2028,
        activateNow: true,
      },
    });
    assert.equal(createSpl5.status, 201);
    assert.equal(createSpl5.data.season.isActive, true);

    const spl5Hero = await apiJson(baseUrl, `/api/hero/published?season=${spl5Slug}`);
    assert.equal(isDefaultSpl3OriginalBranding(spl5Hero.data.heroConfig.seasonBranding), true);
    assert.equal(spl5Hero.data.heroConfig.text.mainHeading.text, 'SMASH PREMIER LEAGUE 5.0');

    // Re-activate SPL 4.0 and check its Electric Red design remained isolated & intact
    const reactivateSpl4 = await apiJson(baseUrl, '/api/seasons/active', {
      method: 'POST',
      token: adminToken,
      body: { seasonIdOrSlug: spl4Slug, checkOngoingMatches: true },
    });
    assert.equal(reactivateSpl4.status, 200);
    assert.equal(reactivateSpl4.data.activeSeason.seasonSlug, spl4Slug);

    const spl4HeroAfterSwitch = await apiJson(baseUrl, `/api/hero/published?season=${spl4Slug}`);
    assert.equal(spl4HeroAfterSwitch.data.heroConfig.seasonBranding.presetId, 'electric-red');
    assert.equal(spl4HeroAfterSwitch.data.heroConfig.seasonBranding.outlineThickness, 2);
    console.log('✓ 6. Multi-season SPL 5.0 clean design & SPL 4.0 persisted design on re-activation passed');

    // -------------------------------------------------------------------------
    // 7. Archive Lock (blocks season edit, hero draft, hero publish) & Unarchive
    // -------------------------------------------------------------------------
    const archiveS3 = await apiJson(baseUrl, `/api/seasons/${spl3Slug}/status`, {
      method: 'PATCH',
      token: adminToken,
      body: { status: 'archived' },
    });
    assert.equal(archiveS3.status, 200);
    assert.equal(archiveS3.data.season.status, 'archived');
    assert.equal(archiveS3.data.season.isLocked, true);

    const lockedPatch = await apiJson(baseUrl, `/api/seasons/${spl3Slug}`, {
      method: 'PATCH',
      token: adminToken,
      body: { editionName: 'Should Fail While Archived' },
    });
    assert.equal(lockedPatch.status, 403);

    const lockedHeroDraft = await apiJson(baseUrl, `/api/hero/draft?season=${spl3Slug}`, {
      method: 'POST',
      token: adminToken,
      body: { config: customElectricDraft },
    });
    assert.equal(lockedHeroDraft.status, 403);

    const lockedHeroPublish = await apiJson(baseUrl, `/api/hero/publish?season=${spl3Slug}`, {
      method: 'POST',
      token: adminToken,
      body: { config: customElectricDraft },
    });
    assert.equal(lockedHeroPublish.status, 403);

    // Unarchive SPL 3.0 cleanly
    const unarchiveS3 = await apiJson(baseUrl, `/api/seasons/${spl3Slug}/status`, {
      method: 'PATCH',
      token: adminToken,
      body: { status: 'completed' },
    });
    assert.equal(unarchiveS3.status, 200);
    assert.equal(unarchiveS3.data.season.status, 'completed');
    assert.equal(unarchiveS3.data.season.isLocked, false);

    // Verify original SPL 3.0 records & branding never corrupted
    const summariesFinal = await apiJson<{ summaries: Record<string, SeasonSummaryCounts> }>(
      baseUrl,
      '/api/seasons/summaries',
      { token: adminToken }
    );
    assert.equal(summariesFinal.data.summaries[spl3Slug].registeredPlayers, 1);
    assert.equal(summariesFinal.data.summaries[spl3Slug].teamsCount, 2);
    assert.equal(summariesFinal.data.summaries[spl3Slug].matchesCount, 1);
    console.log('✓ 7. Archive read-only lock across season metadata & Design Studio + Unarchive passed');

    // -------------------------------------------------------------------------
    // 8. Reset SPL 4.0 design to default & restore Electric Red from version history
    // -------------------------------------------------------------------------
    const spl4AdminBeforeReset = await apiJson(baseUrl, `/api/hero/admin/state?season=${spl4Slug}`, {
      token: adminToken,
    });
    assert.ok(spl4AdminBeforeReset.data.versions.length >= 1, 'Expected at least 1 saved design version');
    const electricVersion = spl4AdminBeforeReset.data.versions[0];

    const resetHeroCfg = buildSeasonInitialHeroConfig(reactivateSpl4.data.activeSeason);
    const publishReset = await apiJson(baseUrl, `/api/hero/publish?season=${spl4Slug}`, {
      method: 'POST',
      token: adminToken,
      body: { config: resetHeroCfg, summary: 'Reset SPL 4.0 to SPL 3.0 Original default' },
    });
    assert.equal(publishReset.status, 200);
    assert.equal(isDefaultSpl3OriginalBranding(publishReset.data.published.seasonBranding), true);

    const restoreElectric = await apiJson(baseUrl, `/api/hero/publish?season=${spl4Slug}`, {
      method: 'POST',
      token: adminToken,
      body: {
        config: electricVersion.config,
        action: 'restore',
        summary: `Restored v${electricVersion.versionNum}`,
      },
    });
    assert.equal(restoreElectric.status, 200);
    assert.equal(restoreElectric.data.published.seasonBranding.presetId, 'electric-red');
    assert.equal(restoreElectric.data.version.action, 'restore');
    console.log('✓ 8. Design reset & version history restore passed');

    if (serverLogs.includes('[stderr]')) {
      console.warn('[Phase 4 server stderr logs]', serverLogs);
    }
    console.log('\n✅ ALL PHASE 4 SEASON MANAGEMENT & DESIGN STUDIO TESTS PASSED!');
  } finally {
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

runPhase4Tests().catch((err) => {
  console.error('❌ Phase 4 test suite failed:', err);
  process.exit(1);
});
