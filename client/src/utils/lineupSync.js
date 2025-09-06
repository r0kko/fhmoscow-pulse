import { ref, readonly } from 'vue';

export function createLineupSync({
  matchId,
  teamIdRef,
  apiFetch,
  getTeamRev,
  setTeamRev,
  getStaffRev,
  setStaffRev,
}) {
  const isOnline = ref(true);
  const pendingPlayers = ref(false);
  const pendingStaff = ref(false);

  function pendingKey(kind) {
    const id = matchId || 'match';
    const team = teamIdRef?.value || 'team';
    return `lineupPending:${id}:${team}:${kind}`;
  }

  function setPending(kind, obj) {
    try {
      localStorage.setItem(
        pendingKey(kind),
        JSON.stringify({ ...obj, ts: Date.now() })
      );
    } catch (_) {}
    if (kind === 'players') pendingPlayers.value = true;
    if (kind === 'staff') pendingStaff.value = true;
  }

  function getPending(kind) {
    try {
      const raw = localStorage.getItem(pendingKey(kind));
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function clearPending(kind) {
    try {
      localStorage.removeItem(pendingKey(kind));
    } catch (_) {}
    if (kind === 'players') pendingPlayers.value = false;
    if (kind === 'staff') pendingStaff.value = false;
  }

  // Prevent overlapping flush requests and batch players/staff concurrently
  let flushInFlight = null;
  async function flushPending(routeBase) {
    if (flushInFlight) return flushInFlight;
    flushInFlight = (async () => {
      const tasks = [];
      const p = getPending('players');
      if (p && p.team_id === teamIdRef.value) {
        tasks.push(
          apiFetch(`${routeBase}/lineups`, {
            method: 'POST',
            body: JSON.stringify({
              team_id: teamIdRef.value,
              players: p.players,
              if_match_rev: getTeamRev() || undefined,
            }),
          })
            .then((r1) => {
              if (r1 && r1.team_rev) setTeamRev(r1.team_rev);
              clearPending('players');
            })
            .catch(() => {
              /* keep pending */
            })
        );
      }
      const s = getPending('staff');
      if (s && s.team_id === teamIdRef.value) {
        tasks.push(
          apiFetch(`${routeBase}/staff`, {
            method: 'POST',
            body: JSON.stringify({
              team_id: teamIdRef.value,
              staff: s.staff,
              if_staff_rev: getStaffRev() || undefined,
            }),
          })
            .then((r2) => {
              if (r2 && r2.team_rev) setStaffRev(r2.team_rev);
              clearPending('staff');
            })
            .catch(() => {
              /* keep pending */
            })
        );
      }
      // Run both, even if one fails
      if (tasks.length) await Promise.allSettled(tasks);
    })();
    try {
      await flushInFlight;
    } finally {
      flushInFlight = null;
    }
  }

  function initNetworkListeners(onOnline) {
    try {
      isOnline.value =
        typeof navigator !== 'undefined' ? !!navigator.onLine : true;
      window.addEventListener('online', () => {
        isOnline.value = true;
        if (onOnline) onOnline();
      });
      window.addEventListener('offline', () => {
        isOnline.value = false;
      });
    } catch (_) {}
  }

  function initPendingFlagsFromStorage() {
    try {
      pendingPlayers.value = !!getPending('players');
      pendingStaff.value = !!getPending('staff');
    } catch (_) {}
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
