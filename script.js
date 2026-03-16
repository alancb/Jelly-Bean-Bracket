(function () {
  'use strict';

  // ============================================================
  // CONSTANTS
  // ============================================================

  const STORAGE_KEY = 'jellyBracket_v1';
  const TOTAL_ROUNDS = 5;

  const FLAVORS = [
    { id: 1,  name: 'Very Cherry',         color: '#C0152B' },
    { id: 2,  name: 'Strawberry Jam',       color: '#E8304A' },
    { id: 3,  name: 'Red Apple',            color: '#C62C1E' },
    { id: 4,  name: 'Sizzling Cinnamon',    color: '#B3220F' },
    { id: 5,  name: 'Orange Soda',          color: '#F47B20' },
    { id: 6,  name: 'Sweet Peach',          color: '#F4A460' },
    { id: 7,  name: 'Chili Mango',          color: '#F4952A' },
    { id: 8,  name: 'Orange Sherbet',       color: '#FFA040' },
    { id: 9,  name: 'Pink Grapefruit',      color: '#F2738C' },
    { id: 10, name: 'Tangerine',            color: '#F28500' },
    { id: 11, name: 'Top Banana',           color: '#FFDD00' },
    { id: 12, name: 'Lemon',               color: '#FFF44F' },
    { id: 13, name: 'Piña Colada',          color: '#FFFACD' },
    { id: 14, name: 'Buttered Popcorn',     color: '#E8C840' },
    { id: 15, name: 'Vanilla Bean',         color: '#F5F0DC' },
    { id: 16, name: 'Cream Soda',           color: '#F5DEB3' },
    { id: 17, name: 'Coconut',             color: '#F8F8F0' },
    { id: 18, name: 'Lemon Lime',           color: '#A8D400' },
    { id: 19, name: 'Juicy Pear',           color: '#B8D878' },
    { id: 20, name: 'Sour Apple',           color: '#5CB800' },
    { id: 21, name: 'Watermelon',           color: '#FC5C7D' },
    { id: 22, name: 'Blue Raspberry',       color: '#0099CC' },
    { id: 23, name: 'Blueberry',            color: '#4A5FA5' },
    { id: 24, name: 'Grape Soda',           color: '#7B3FA0' },
    { id: 25, name: 'Wild Blackberry',      color: '#4B0082' },
    { id: 26, name: 'Licorice',             color: '#1C1C1C' },
    { id: 27, name: 'Root Beer',            color: '#5C3317' },
    { id: 28, name: 'Toasted Marshmallow',  color: '#D2A679' },
    { id: 29, name: 'Tutti-Fruitti',        color: '#FF69B4' },
    { id: 30, name: 'Cotton Candy',         color: '#FFB7D5' },
    { id: 31, name: 'BYE',                  color: '#DDDDDD' },
    { id: 32, name: 'BYE',                  color: '#DDDDDD' },
  ];

  // Standard 32-team seeding pairs (round 0).
  // Matches 0-7 = left half, 8-15 = right half.
  // Seeds 31 and 32 are BYEs (auto-advance opponents).
  const SEED_PAIRS = [
    [1, 32], [16, 17], [8, 25], [9, 24],   // left half
    [5, 28], [12, 21], [4, 29], [13, 20],
    [3, 30], [14, 19], [6, 27], [11, 22],  // right half
    [7, 26], [10, 23], [2, 31], [15, 18],
  ];

  // ============================================================
  // STATE
  // ============================================================

  let state = null;

  function buildInitialState() {
    const rounds = [];

    // Round 0: 16 matches from SEED_PAIRS
    rounds[0] = SEED_PAIRS.map(([top, bottom], i) => ({
      matchId: `r0m${i}`,
      topSlot: top,
      bottomSlot: bottom,
      winnerId: null,
    }));

    // Rounds 1-4: empty matches
    for (let r = 1; r < TOTAL_ROUNDS; r++) {
      const count = Math.pow(2, TOTAL_ROUNDS - 1 - r); // 8,4,2,1
      rounds[r] = Array.from({ length: count }, (_, i) => ({
        matchId: `r${r}m${i}`,
        topSlot: null,
        bottomSlot: null,
        winnerId: null,
      }));
    }

    return { rounds, champion: null };
  }

  function isByeSeed(seed) {
    return seed === 31 || seed === 32;
  }

  // Propagate a winner from match (round, matchIndex) into the next round.
  // Returns true if a BYE auto-advance was triggered upstream.
  function propagateWinner(s, round, matchIndex) {
    const winner = s.rounds[round][matchIndex].winnerId;
    if (winner === null) return;

    const nextRound = round + 1;
    if (nextRound >= TOTAL_ROUNDS) {
      s.champion = winner;
      return;
    }

    const parentMatchIndex = Math.floor(matchIndex / 2);
    const parentMatch = s.rounds[nextRound][parentMatchIndex];

    if (matchIndex % 2 === 0) {
      parentMatch.topSlot = winner;
    } else {
      parentMatch.bottomSlot = winner;
    }

    // If the newly filled slot faces a BYE, auto-advance
    if (parentMatch.topSlot !== null && isByeSeed(parentMatch.topSlot)) {
      parentMatch.winnerId = parentMatch.bottomSlot;
      if (parentMatch.winnerId !== null) propagateWinner(s, nextRound, parentMatchIndex);
    } else if (parentMatch.bottomSlot !== null && isByeSeed(parentMatch.bottomSlot)) {
      parentMatch.winnerId = parentMatch.topSlot;
      if (parentMatch.winnerId !== null) propagateWinner(s, nextRound, parentMatchIndex);
    }
  }

  function autoAdvanceByes(s) {
    s.rounds[0].forEach((match, i) => {
      if (isByeSeed(match.topSlot)) {
        match.winnerId = match.bottomSlot;
        propagateWinner(s, 0, i);
      } else if (isByeSeed(match.bottomSlot)) {
        match.winnerId = match.topSlot;
        propagateWinner(s, 0, i);
      }
    });
  }

  // Clear all picks derived from match (round, matchIndex).
  function clearDownstream(s, round, matchIndex) {
    const nextRound = round + 1;
    if (nextRound >= TOTAL_ROUNDS) {
      s.champion = null;
      return;
    }

    const parentMatchIndex = Math.floor(matchIndex / 2);
    const parentMatch = s.rounds[nextRound][parentMatchIndex];
    const isTop = matchIndex % 2 === 0;

    const oldSeed = isTop ? parentMatch.topSlot : parentMatch.bottomSlot;

    if (isTop) {
      parentMatch.topSlot = null;
    } else {
      parentMatch.bottomSlot = null;
    }

    // If the winner of the parent was the seed we just cleared, recurse
    if (parentMatch.winnerId !== null && parentMatch.winnerId === oldSeed) {
      parentMatch.winnerId = null;
      clearDownstream(s, nextRound, parentMatchIndex);
    }
  }

  function pickWinner(matchId, seedNum) {
    const { round, matchIndex } = parseMatchId(matchId);
    const match = state.rounds[round][matchIndex];

    // Guard: not a valid slot
    if (match.topSlot !== seedNum && match.bottomSlot !== seedNum) return;
    // Guard: BYE can't be picked
    if (isByeSeed(seedNum)) return;

    // If re-clicking same winner, deselect and clear downstream
    if (match.winnerId === seedNum) {
      clearDownstream(state, round, matchIndex);
      match.winnerId = null;
      saveState();
      rerenderBracket();
      return;
    }

    // If there was a previous winner, clear downstream from it
    if (match.winnerId !== null) {
      clearDownstream(state, round, matchIndex);
    }

    match.winnerId = seedNum;
    propagateWinner(state, round, matchIndex);
    saveState();
    rerenderBracket();
  }

  // ============================================================
  // PERSISTENCE
  // ============================================================

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      // Storage unavailable, silently continue
    }
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      // Basic validation
      if (!parsed.rounds || parsed.rounds.length !== TOTAL_ROUNDS) return null;
      return parsed;
    } catch (e) {
      return null;
    }
  }

  function resetBracket() {
    if (!confirm('Reset all picks and start over?')) return;
    localStorage.removeItem(STORAGE_KEY);
    state = buildInitialState();
    autoAdvanceByes(state);
    rerenderBracket();
  }

  // ============================================================
  // HELPERS
  // ============================================================

  function parseMatchId(matchId) {
    const [rPart, mPart] = matchId.split('m');
    return {
      round: parseInt(rPart.replace('r', ''), 10),
      matchIndex: parseInt(mPart, 10),
    };
  }

  function getFlavorBySeed(seed) {
    return FLAVORS[seed - 1];
  }

  // WCAG relative luminance → pick black or white text
  function getTextColor(hex) {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const linearize = (c) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    const lum = 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
    return lum > 0.35 ? '#1a1a1a' : '#ffffff';
  }

  function getSlotState(match, seed) {
    if (seed === null) return 'empty';
    if (isByeSeed(seed)) return 'bye';
    if (match.winnerId === seed) return 'winner';
    if (match.winnerId !== null) return 'loser';
    return 'normal';
  }

  // ============================================================
  // RENDERING
  // ============================================================

  function renderSlot(seed, match) {
    const slotState = getSlotState(match, seed);

    const slot = document.createElement('div');
    slot.className = `slot slot-${slotState}`;
    if (seed !== null) slot.dataset.seed = seed;
    slot.dataset.matchId = match.matchId;

    const seedNum = document.createElement('span');
    seedNum.className = 'seed-num';
    seedNum.textContent = seed !== null && !isByeSeed(seed) ? seed : '';

    const pill = document.createElement('span');
    pill.className = 'flavor-pill';

    if (seed === null) {
      pill.textContent = '—';
      pill.style.setProperty('--flavor-bg', '#efefef');
      pill.style.setProperty('--flavor-text', '#ccc');
    } else {
      const flavor = getFlavorBySeed(seed);
      pill.textContent = flavor.name;
      pill.style.setProperty('--flavor-bg', flavor.color);
      pill.style.setProperty('--flavor-text', getTextColor(flavor.color));
    }

    slot.appendChild(seedNum);
    slot.appendChild(pill);
    return slot;
  }

  function renderMatch(match, round, isFinal) {
    const el = document.createElement('div');
    el.className = 'match' + (isFinal ? ' match-final' : '');
    el.id = match.matchId;
    el.dataset.round = round;

    el.appendChild(renderSlot(match.topSlot, match));
    el.appendChild(renderSlot(match.bottomSlot, match));
    return el;
  }

  function renderRound(round, matchStart, matchEnd, side) {
    const el = document.createElement('div');
    el.className = 'round';
    el.dataset.round = round;
    el.dataset.side = side;

    for (let i = matchStart; i <= matchEnd; i++) {
      el.appendChild(renderMatch(state.rounds[round][i], round, false));
    }
    return el;
  }

  function rerenderBracket() {
    const bracket = document.getElementById('bracket');
    bracket.innerHTML = '';

    // Left side: rounds 0-3, matches 0-7 → 0-3 → 0-1 → 0
    const leftSide = document.createElement('div');
    leftSide.className = 'bracket-side bracket-left';

    // Each round's left half: match indices 0 to (halfCount - 1)
    // Round 0: 16 total → left half = 0-7
    // Round 1: 8 total  → left half = 0-3
    // Round 2: 4 total  → left half = 0-1
    // Round 3: 2 total  → left half = 0
    for (let r = 0; r <= 3; r++) {
      const totalMatches = state.rounds[r].length;
      const halfEnd = Math.ceil(totalMatches / 2) - 1;
      leftSide.appendChild(renderRound(r, 0, halfEnd, 'left'));
    }
    bracket.appendChild(leftSide);

    // Championship center
    const center = document.createElement('div');
    center.id = 'championship';

    const finalMatch = renderMatch(state.rounds[4][0], 4, true);
    center.appendChild(finalMatch);

    const championDisplay = document.createElement('div');
    championDisplay.id = 'champion-display';
    if (state.champion !== null) {
      const flavor = getFlavorBySeed(state.champion);
      const crown = document.createElement('span');
      crown.className = 'champion-crown';
      crown.textContent = '🏆';
      const pill = document.createElement('span');
      pill.className = 'champion-pill';
      pill.textContent = flavor.name;
      pill.style.setProperty('--flavor-bg', flavor.color);
      pill.style.setProperty('--flavor-text', getTextColor(flavor.color));
      championDisplay.appendChild(crown);
      championDisplay.appendChild(pill);
    }
    center.appendChild(championDisplay);
    bracket.appendChild(center);

    // Right side: rounds 3→0 appended in order, giving visual R3 R2 R1 R0
    // (flex-direction: row so DOM order = visual order)
    // Round 3: match index 1 (right half of 2 total)
    // Round 2: match indices 2-3 (right half of 4 total)
    // Round 1: match indices 4-7 (right half of 8 total)
    // Round 0: match indices 8-15 (right half of 16 total)
    const rightSide = document.createElement('div');
    rightSide.className = 'bracket-side bracket-right';

    for (let r = 3; r >= 0; r--) {
      const totalMatches = state.rounds[r].length;
      const halfStart = Math.ceil(totalMatches / 2);
      const halfEnd = totalMatches - 1;
      rightSide.appendChild(renderRound(r, halfStart, halfEnd, 'right'));
    }
    bracket.appendChild(rightSide);

  }

  // ============================================================
  // EVENT HANDLING
  // ============================================================

  function attachListeners() {
    const bracket = document.getElementById('bracket');

    bracket.addEventListener('click', function (e) {
      // In host mode, clicks are handled by host.js
      if (document.body.classList.contains('host-mode')) return;

      const slot = e.target.closest('.slot');
      if (!slot) return;

      const seed = slot.dataset.seed ? parseInt(slot.dataset.seed, 10) : null;
      const matchId = slot.dataset.matchId;
      if (!seed || !matchId) return;

      // Only act on pickable slots (not bye or empty)
      if (slot.classList.contains('slot-bye')) return;
      if (slot.classList.contains('slot-empty')) return;

      pickWinner(matchId, seed);
    });
  }

  // ============================================================
  // INIT
  // ============================================================

  function printEmptyBracket() {
    window.print();
  }

  function init() {
    document.getElementById('reset-btn').addEventListener('click', resetBracket);
    document.getElementById('print-btn').addEventListener('click', printEmptyBracket);

    const saved = loadState();
    if (saved) {
      state = saved;
    } else {
      state = buildInitialState();
      autoAdvanceByes(state);
    }

    rerenderBracket();
    attachListeners();
  }

  init();

  // ============================================================
  // PUBLIC INTERFACE (used by host.js)
  // ============================================================
  window.bracketApp = {
    getState:          () => state,
    setState:          (newState) => { state = newState; },
    pickWinner:        pickWinner,
    rerenderBracket:   rerenderBracket,
    parseMatchId:      parseMatchId,
    getFlavorBySeed:   getFlavorBySeed,
    getTextColor:      getTextColor,
    isByeSeed:         isByeSeed,
    FLAVORS:           FLAVORS,
    SEED_PAIRS:        SEED_PAIRS,
    buildInitialState: buildInitialState,
    autoAdvanceByes:   autoAdvanceByes,
    propagateWinner:   propagateWinner,
  };

})();
