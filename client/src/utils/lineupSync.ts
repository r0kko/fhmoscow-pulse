import { ref, readonly, type Ref } from 'vue';
import type { apiFetch as ApiFetchType } from '../api';

const STORAGE_PREFIX = 'lineupPending';

type ApiFetch = typeof ApiFetchType;

type PendingKind = 'players' | 'staff';

type ReadonlyRef<T> = Readonly<Ref<T>>;

interface BasePendingPayload {
  team_id: string;
  ts?: number;
}

export interface PendingPlayersPayload extends BasePendingPayload {
  players: unknown;
}

export interface PendingStaffPayload extends BasePendingPayload {
  staff: unknown;
}

type PendingMap = {
  players: PendingPlayersPayload;
  staff: PendingStaffPayload;
};

export interface LineupSyncOptions {
  matchId?: string | number | null;
  teamIdRef: Ref<string>;
  apiFetch: ApiFetch;
  getTeamRev: () => string | null | undefined;
  setTeamRev: (rev: string) => void;
  getStaffRev: () => string | null | undefined;
  setStaffRev: (rev: string) => void;
}

export interface LineupSync {
  isOnline: ReadonlyRef<boolean>;
  pendingPlayers: ReadonlyRef<boolean>;
  pendingStaff: ReadonlyRef<boolean>;
  setPending: <K extends PendingKind>(kind: K, payload: PendingMap[K]) => void;
  getPending: <K extends PendingKind>(kind: K) => PendingMap[K] | null;
  clearPending: (kind: PendingKind) => void;
  flushPending: (routeBase: string) => Promise<void>;
  initNetworkListeners: (onOnline?: () => void) => void;
  initPendingFlagsFromStorage: () => void;
}

function storageKey(
  kind: PendingKind,
  matchId?: string | number | null,
  teamId?: string
): string {
  const id = matchId ?? 'match';
  const team = teamId ?? 'team';
  return `${STORAGE_PREFIX}:${id}:${team}:${kind}`;
}

function serializePending(
  payload: PendingPlayersPayload | PendingStaffPayload
): string | null {
  try {
    return JSON.stringify({ ...payload, ts: Date.now() });
  } catch (error) {
    console.warn('Failed to serialize pending lineup payload', error);
    return null;
  }
}

export function createLineupSync(options: LineupSyncOptions): LineupSync {
  const {
    matchId,
    teamIdRef,
    apiFetch,
    getTeamRev,
    setTeamRev,
    getStaffRev,
    setStaffRev,
  } = options;

  const isOnline = ref(true);
  const pendingPlayers = ref(false);
  const pendingStaff = ref(false);

  function setPending<K extends PendingKind>(
    kind: K,
    payload: PendingMap[K]
  ): void {
    const key = storageKey(kind, matchId, teamIdRef.value);
    const serialized = serializePending(payload);
    if (!serialized) return;
    try {
      localStorage.setItem(key, serialized);
    } catch (error) {
      console.warn('Failed to persist pending lineup item', error);
    }
    if (kind === 'players') pendingPlayers.value = true;
    if (kind === 'staff') pendingStaff.value = true;
  }

  function getPending<K extends PendingKind>(kind: K): PendingMap[K] | null {
    const key = storageKey(kind, matchId, teamIdRef.value);
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as PendingMap[K];
      return parsed ?? null;
    } catch (error) {
      console.warn('Failed to read pending lineup item', error);
      return null;
    }
  }

  function clearPending(kind: PendingKind): void {
    const key = storageKey(kind, matchId, teamIdRef.value);
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.warn('Failed to clear pending lineup item', error);
    }
    if (kind === 'players') pendingPlayers.value = false;
    if (kind === 'staff') pendingStaff.value = false;
  }

  let flushInFlight: Promise<void> | null = null;

  async function flushPending(routeBase: string): Promise<void> {
    if (flushInFlight) return flushInFlight;

    flushInFlight = (async () => {
      const tasks: Promise<unknown>[] = [];
      const pendingPlayersPayload = getPending('players');
      if (
        pendingPlayersPayload &&
        pendingPlayersPayload.team_id === teamIdRef.value
      ) {
        tasks.push(
          apiFetch(`${routeBase}/lineups`, {
            method: 'POST',
            body: JSON.stringify({
              team_id: teamIdRef.value,
              players: pendingPlayersPayload.players,
              if_match_rev: getTeamRev() || undefined,
            }),
          })
            .then((response: unknown) => {
              const { team_rev } = (response as { team_rev?: string }) ?? {};
              if (team_rev) setTeamRev(team_rev);
              clearPending('players');
            })
            .catch(() => {
              /* keep pending data for retry */
            })
        );
      }

      const pendingStaffPayload = getPending('staff');
      if (
        pendingStaffPayload &&
        pendingStaffPayload.team_id === teamIdRef.value
      ) {
        tasks.push(
          apiFetch(`${routeBase}/staff`, {
            method: 'POST',
            body: JSON.stringify({
              team_id: teamIdRef.value,
              staff: pendingStaffPayload.staff,
              if_staff_rev: getStaffRev() || undefined,
            }),
          })
            .then((response: unknown) => {
              const { team_rev } = (response as { team_rev?: string }) ?? {};
              if (team_rev) setStaffRev(team_rev);
              clearPending('staff');
            })
            .catch(() => {
              /* keep pending data for retry */
            })
        );
      }

      if (tasks.length) await Promise.allSettled(tasks);
    })();

    try {
      await flushInFlight;
    } finally {
      flushInFlight = null;
    }
  }

  function initNetworkListeners(onOnline?: () => void): void {
    try {
      isOnline.value =
        typeof navigator !== 'undefined' ? Boolean(navigator.onLine) : true;
      window.addEventListener('online', () => {
        isOnline.value = true;
        onOnline?.();
      });
      window.addEventListener('offline', () => {
        isOnline.value = false;
      });
    } catch (error) {
      console.warn('Failed to attach network listeners', error);
    }
  }

  function initPendingFlagsFromStorage(): void {
    pendingPlayers.value = Boolean(getPending('players'));
    pendingStaff.value = Boolean(getPending('staff'));
  }

  return {
    isOnline: readonly(isOnline),
    pendingPlayers: readonly(pendingPlayers),
    pendingStaff: readonly(pendingStaff),
    setPending,
    getPending,
    clearPending,
    flushPending,
    initNetworkListeners,
    initPendingFlagsFromStorage,
  };
}
