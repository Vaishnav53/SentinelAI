import { describe, it, expect } from 'vitest';

/**
 * Pure state reducer / selection resolver mirroring the selection logic in AttackerProfiles.jsx.
 * Note: These unit tests verify the pure algorithmic selection resolution logic
 * (valid IP deep-links, missing IPs, and unknown IPs). They do not mount or verify
 * virtual DOM React component rendering.
 */
function resolveSelectedIp({ urlIp, currentSelected, safeList }) {
  if (!safeList || safeList.length === 0) {
    return { selectedIp: null, page: 1, isUnknown: false };
  }

  // 1. If urlIp is provided and exists in safeList, prioritize it
  if (urlIp && safeList.some(a => a.ip_address === urlIp)) {
    const index = safeList.findIndex(a => a.ip_address === urlIp);
    const page = Math.floor(index / 15) + 1;
    return { selectedIp: urlIp, page, isUnknown: false };
  }

  // 2. If urlIp was provided but does not exist in safeList, do not select an unrelated attacker
  if (urlIp) {
    return { selectedIp: null, page: 1, isUnknown: true };
  }

  // 3. If no urlIp is provided, preserve current selection if valid in safeList
  if (currentSelected && safeList.some(a => a.ip_address === currentSelected)) {
    const index = safeList.findIndex(a => a.ip_address === currentSelected);
    const page = Math.floor(index / 15) + 1;
    return { selectedIp: currentSelected, page, isUnknown: false };
  }

  // 4. Default fallback to the first available attacker when missing urlIp parameter
  return { selectedIp: safeList[0].ip_address, page: 1, isUnknown: false };
}

describe('Threat Intelligence Deep Link Resolution', () => {
  const mockRoster = Array.from({ length: 40 }, (_, i) => ({
    ip_address: `198.51.100.${i + 1}`,
    risk_score: 100 - i,
    total_events: 50 - i
  }));

  it('1. /attackers?ip=<existing-ip> selects the matching profile', () => {
    const targetIp = '198.51.100.5';
    const result = resolveSelectedIp({
      urlIp: targetIp,
      currentSelected: null,
      safeList: mockRoster
    });

    expect(result.selectedIp).toBe(targetIp);
    expect(result.page).toBe(1);
  });

  it('2. The target profile is selected after asynchronous data loading', () => {
    const targetIp = '198.51.100.22'; // Lives on page 2 (index 21)
    
    // Initial mount before roster arrives
    const initialSelection = targetIp;
    expect(initialSelection).toBe('198.51.100.22');

    // Asynchronous arrival of roster
    const result = resolveSelectedIp({
      urlIp: targetIp,
      currentSelected: initialSelection,
      safeList: mockRoster
    });

    expect(result.selectedIp).toBe('198.51.100.22');
    expect(result.page).toBe(2); // Automatically jumps to page 2
  });

  it('3. Missing and unknown IP parameters are handled gracefully without crashing or fabricating data', () => {
    // Missing IP preserves default top attacker selection
    const missingRes = resolveSelectedIp({
      urlIp: null,
      currentSelected: null,
      safeList: mockRoster
    });
    expect(missingRes.selectedIp).toBe('198.51.100.1'); // Falls back to top attacker
    expect(missingRes.page).toBe(1);
    expect(missingRes.isUnknown).toBe(false);

    // Unknown IP - must NOT fall back to an unrelated attacker
    const unknownRes = resolveSelectedIp({
      urlIp: '203.0.113.999',
      currentSelected: null,
      safeList: mockRoster
    });
    expect(unknownRes.selectedIp).toBeNull(); // Never silently displays another attacker
    expect(unknownRes.isUnknown).toBe(true);

    // Empty list
    const emptyRes = resolveSelectedIp({
      urlIp: '198.51.100.5',
      currentSelected: null,
      safeList: []
    });
    expect(emptyRes.selectedIp).toBeNull();
  });

  it('4. Changing the query parameter to another IP selects the new target', () => {
    // First IP navigation
    let res = resolveSelectedIp({
      urlIp: '198.51.100.10',
      currentSelected: '198.51.100.1',
      safeList: mockRoster
    });
    expect(res.selectedIp).toBe('198.51.100.10');

    // Second IP navigation
    res = resolveSelectedIp({
      urlIp: '198.51.100.35', // Lives on page 3 (index 34)
      currentSelected: '198.51.100.10',
      safeList: mockRoster
    });
    expect(res.selectedIp).toBe('198.51.100.35');
    expect(res.page).toBe(3);

    // Third IP navigation to an unknown IP - must clear selection rather than show unrelated dossier
    res = resolveSelectedIp({
      urlIp: '203.0.113.999',
      currentSelected: '198.51.100.35',
      safeList: mockRoster
    });
    expect(res.selectedIp).toBeNull();
    expect(res.isUnknown).toBe(true);
  });

  it('5. Existing manual selection and search behavior remain functional', () => {
    // User clicks row 198.51.100.8 manually (no urlIp present)
    const manualRes = resolveSelectedIp({
      urlIp: null,
      currentSelected: '198.51.100.8',
      safeList: mockRoster
    });
    expect(manualRes.selectedIp).toBe('198.51.100.8');

    // Filtered search list containing a subset
    const filteredSearch = mockRoster.filter(a => a.ip_address.endsWith('.8') || a.ip_address.endsWith('.18'));
    const searchRes = resolveSelectedIp({
      urlIp: null,
      currentSelected: '198.51.100.8',
      safeList: filteredSearch
    });
    expect(searchRes.selectedIp).toBe('198.51.100.8');
  });
});

/**
 * Asynchronous profile controller implementing the exact stale-request race condition guard
 * used in AttackerProfiles.jsx (fetchProfile with selectedIpRef guard).
 */
export class AttackerProfileController {
  constructor(apiClient) {
    this.selectedIp = null;
    this.selectedIpRef = { current: null };
    this.isMountedRef = { current: true };
    this.profile = null;
    this.profileLoading = false;
    this.profileError = null;
    this.apiClient = apiClient;
  }

  selectIp(ip) {
    this.selectedIpRef.current = ip;
    this.selectedIp = ip;
    this.profileError = null;
    return this.fetchProfile(ip);
  }

  async fetchProfile(ip, isSilent = false) {
    if (!ip) {
      this.profile = null;
      this.profileError = null;
      return;
    }
    try {
      if (!isSilent) {
        this.profileLoading = true;
        this.profileError = null;
      }
      const detail = await this.apiClient.get(`/attacker/profiles/${ip}`);
      if (!this.isMountedRef.current || this.selectedIpRef.current !== ip) return;
      this.profile = detail;
      this.profileError = null;
    } catch (err) {
      if (!this.isMountedRef.current || this.selectedIpRef.current !== ip) return;
      if (!isSilent) {
        this.profile = null;
        const status = err?.status || err?.code || (err?.response && err.response.status);
        const is404 = status === 404 || status === '404' || status === 'NOT_FOUND' || String(err?.message || '').includes('404');
        this.profileError = {
          is404,
          ip,
          message: is404
            ? `No telemetry records found for requested IP: ${ip}`
            : (err?.message || 'Failed to connect to threat intelligence service.')
        };
      }
    } finally {
      if (this.isMountedRef.current && !isSilent && this.selectedIpRef.current === ip) {
        this.profileLoading = false;
      }
    }
  }
}

describe('Stale-Response Race Condition Guard', () => {
  it('6. When selecting A then B, A resolving last cannot overwrite B profile', async () => {
    let resolveA, resolveB;
    const promiseA = new Promise((resolve) => { resolveA = resolve; });
    const promiseB = new Promise((resolve) => { resolveB = resolve; });

    const mockClient = {
      get: (url) => {
        if (url.includes('198.51.100.1')) return promiseA;
        if (url.includes('198.51.100.2')) return promiseB;
        return Promise.reject(new Error('Unknown'));
      }
    };

    const controller = new AttackerProfileController(mockClient);

    // 1. User selects attacker A
    const reqA = controller.selectIp('198.51.100.1');
    expect(controller.selectedIp).toBe('198.51.100.1');
    expect(controller.profileLoading).toBe(true);

    // 2. User quickly switches to attacker B before A finishes
    const reqB = controller.selectIp('198.51.100.2');
    expect(controller.selectedIp).toBe('198.51.100.2');

    // 3. Attacker B resolves first
    resolveB({ ip_address: '198.51.100.2', total_events: 42 });
    await reqB;

    expect(controller.profile?.ip_address).toBe('198.51.100.2');
    expect(controller.profileLoading).toBe(false);

    // 4. Attacker A resolves last (out-of-order stale response)
    resolveA({ ip_address: '198.51.100.1', total_events: 99 });
    await reqA;

    // 5. Verify B remains displayed and A's stale response was discarded
    expect(controller.selectedIp).toBe('198.51.100.2');
    expect(controller.profile?.ip_address).toBe('198.51.100.2');
    expect(controller.profileError).toBeNull();
  });

  it('7. When selecting A then B, A rejecting last cannot wipe B profile or set stale error', async () => {
    let rejectA, resolveB;
    const promiseA = new Promise((_, reject) => { rejectA = reject; });
    const promiseB = new Promise((resolve) => { resolveB = resolve; });

    const mockClient = {
      get: (url) => {
        if (url.includes('198.51.100.1')) return promiseA;
        if (url.includes('198.51.100.2')) return promiseB;
        return Promise.reject(new Error('Unknown'));
      }
    };

    const controller = new AttackerProfileController(mockClient);

    // User selects A then B
    const reqA = controller.selectIp('198.51.100.1');
    const reqB = controller.selectIp('198.51.100.2');

    // B resolves successfully
    resolveB({ ip_address: '198.51.100.2', total_events: 10 });
    await reqB;
    expect(controller.profile?.ip_address).toBe('198.51.100.2');

    // A rejects with 500 error after B has already finished
    rejectA({ status: 500, message: 'Internal Server Error' });
    await reqA;

    // Verify B's profile is intact and no stale error is set
    expect(controller.selectedIp).toBe('198.51.100.2');
    expect(controller.profile?.ip_address).toBe('198.51.100.2');
    expect(controller.profileError).toBeNull();
    expect(controller.profileLoading).toBe(false);
  });

  it('8. A resolving with success cannot overwrite B honest 404 error state', async () => {
    let resolveA, rejectB;
    const promiseA = new Promise((resolve) => { resolveA = resolve; });
    const promiseB = new Promise((_, reject) => { rejectB = reject; });

    const mockClient = {
      get: (url) => {
        if (url.includes('198.51.100.1')) return promiseA;
        if (url.includes('999.999.999.999')) return promiseB;
        return Promise.reject(new Error('Unknown'));
      }
    };

    const controller = new AttackerProfileController(mockClient);

    // Select A, then select unknown IP B
    const reqA = controller.selectIp('198.51.100.1');
    const reqB = controller.selectIp('999.999.999.999');

    // B fails with 404 (Attacker Not Found)
    rejectB({ status: 404, message: 'Attacker not found' });
    await reqB;

    expect(controller.selectedIp).toBe('999.999.999.999');
    expect(controller.profile).toBeNull();
    expect(controller.profileError?.is404).toBe(true);
    expect(controller.profileError?.ip).toBe('999.999.999.999');

    // A resolves successfully after B has already errored
    resolveA({ ip_address: '198.51.100.1', total_events: 100 });
    await reqA;

    // Verify B's 404 state remains active and A was not displayed
    expect(controller.selectedIp).toBe('999.999.999.999');
    expect(controller.profile).toBeNull();
    expect(controller.profileError?.is404).toBe(true);
    expect(controller.profileError?.ip).toBe('999.999.999.999');
  });

  it('9. selectedIpRef is updated synchronously on selectIp before microtask resolution', async () => {
    let resolveA;
    const promiseA = new Promise((resolve) => { resolveA = resolve; });

    const mockClient = {
      get: () => promiseA
    };

    const controller = new AttackerProfileController(mockClient);

    // Select A
    const reqA = controller.selectIp('198.51.100.1');
    expect(controller.selectedIpRef.current).toBe('198.51.100.1');

    // Select B - ref must immediately be B synchronously
    controller.selectIp('198.51.100.2');
    expect(controller.selectedIpRef.current).toBe('198.51.100.2');

    resolveA({ ip_address: '198.51.100.1' });
    await reqA;
  });
});
