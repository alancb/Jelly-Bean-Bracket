/**
 * host.js — Live voting host mode for the Jelly Belly Bracket
 *
 * Firebase config is loaded from firebase-config.js (loaded before this script).
 * Fill in your values there, then commit and push.
 */

(function () {
  'use strict';

  // Config is set by firebase-config.js via window.FIREBASE_CONFIG
  const FIREBASE_CONFIG = window.FIREBASE_CONFIG || {};
  const FIREBASE_CONFIGURED = FIREBASE_CONFIG.apiKey &&
    FIREBASE_CONFIG.apiKey !== 'PASTE_YOUR_API_KEY';

  // ============================================================
  // STATE
  // ============================================================
  let db = null;
  let sessionId = null;
  let sessionRef = null;
  let votesListener = null;
  let voterCountListener = null;
  let activeMatchId = null;

  // Access the bracket app's public interface (set by script.js)
  const app = window.bracketApp;

  // ============================================================
  // SESSION ID GENERATION
  // ============================================================
  const CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I/L

  function generateSessionId() {
    let id = '';
    for (let i = 0; i < 4; i++) {
      id += CHARSET[Math.floor(Math.random() * CHARSET.length)];
    }
    return id;
  }

  // ============================================================
  // INIT HOST MODE
  // ============================================================
  function initHostMode() {
    if (!FIREBASE_CONFIGURED) {
      alert(
        'Firebase is not configured yet.\n\n' +
        'Open host.js and paste your Firebase project config at the top of the file.\n\n' +
        'See the comments in host.js for setup instructions.'
      );
      return;
    }

    try {
      // Initialize Firebase (only once)
      if (!firebase.apps.length) {
        firebase.initializeApp(FIREBASE_CONFIG);
      }
      db = firebase.database();
    } catch (e) {
      alert('Firebase initialization failed. Check your config values in host.js.\n\n' + e.message);
      return;
    }

    sessionId = generateSessionId();
    sessionRef = db.ref('sessions/' + sessionId);

    // Write initial session to Firebase
    sessionRef.set({
      status: 'lobby',
      activeMatchId: null,
      bracket: app.getState(),
      voterCount: 0,
    }).then(() => {
      activateHostUI();
    }).catch(err => {
      alert('Could not create session: ' + err.message);
    });
  }

  // ============================================================
  // HOST UI ACTIVATION
  // ============================================================
  function activateHostUI() {
    document.body.classList.add('host-mode');
    document.getElementById('host-btn').textContent = 'Hosting…';
    document.getElementById('host-btn').classList.add('host-active');
    document.getElementById('reset-btn').disabled = true;

    const code = sessionId;
    const voteUrl = buildVoteUrl(code);

    document.getElementById('host-session-code').textContent = code;
    document.getElementById('host-join-url').textContent = voteUrl;
    document.getElementById('host-qr').src =
      'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' +
      encodeURIComponent(voteUrl);

    document.getElementById('host-panel').hidden = false;
    document.getElementById('host-lobby').hidden = false;
    document.getElementById('host-voting-panel').hidden = true;

    // Listen for voter count changes
    voterCountListener = db.ref('sessions/' + sessionId + '/voterCount')
      .on('value', snap => {
        const n = snap.val() || 0;
        document.getElementById('host-voter-count').textContent =
          n + ' voter' + (n !== 1 ? 's' : '') + ' connected';
      });

    // Re-render bracket and mark voteable matches
    app.rerenderBracket();
    markVoteableMatches();

    // Bracket click handler: clicking a voteable match opens voting
    document.getElementById('bracket').addEventListener('click', onBracketClick);
  }

  function buildVoteUrl(code) {
    const base = window.location.href
      .replace(/\/[^/]*$/, '')  // strip filename
      .replace(/\/$/, '');
    return base + '/vote.html?s=' + code;
  }

  // ============================================================
  // MARK VOTEABLE MATCHES (adds CSS class for hover/cursor)
  // ============================================================
  function markVoteableMatches() {
    document.querySelectorAll('.match:not(.match-final)').forEach(matchEl => {
      const matchId = matchEl.id;
      if (!matchId) return;
      const { round, matchIndex } = app.parseMatchId(matchId);
      const match = app.getState().rounds[round][matchIndex];

      const voteable = match.topSlot && match.bottomSlot &&
        !app.isByeSeed(match.topSlot) && !app.isByeSeed(match.bottomSlot) &&
        match.winnerId === null;

      matchEl.classList.toggle('match-voteable', voteable);
    });
  }

  function onBracketClick(e) {
    if (!document.body.classList.contains('host-mode')) return;
    const matchEl = e.target.closest('.match-voteable');
    if (!matchEl || !matchEl.id) return;
    openVoting(matchEl.id);
  }

  // ============================================================
  // OPEN VOTING FOR A MATCH
  // ============================================================
  function openVoting(matchId) {
    if (activeMatchId) {
      if (!confirm('Cancel current vote and switch to this match?')) return;
      cancelVoting(false);
    }

    activeMatchId = matchId;
    const { round, matchIndex } = app.parseMatchId(matchId);
    const match = app.getState().rounds[round][matchIndex];
    const topFlavor = app.getFlavorBySeed(match.topSlot);
    const bottomFlavor = app.getFlavorBySeed(match.bottomSlot);

    // Update Firebase
    sessionRef.update({
      status: 'voting',
      activeMatchId: matchId,
    });
    // Clear any previous votes for this match
    db.ref('sessions/' + sessionId + '/votes/' + matchId).remove();

    // Mark match in bracket DOM
    document.querySelectorAll('.match.match-voting').forEach(el => {
      el.classList.remove('match-voting');
    });
    const matchEl = document.getElementById(matchId);
    if (matchEl) matchEl.classList.add('match-voting');

    // Populate voting panel
    setContestantPill('host-top-pill', topFlavor);
    setContestantPill('host-bottom-pill', bottomFlavor);
    document.getElementById('host-top-count').textContent = '0';
    document.getElementById('host-bottom-count').textContent = '0';
    document.getElementById('host-top-bar').style.width = '0%';
    document.getElementById('host-bottom-bar').style.width = '0%';
    document.getElementById('host-total-votes').textContent = '0 votes cast';

    document.getElementById('host-lobby').hidden = true;
    document.getElementById('host-voting-panel').hidden = false;

    // Listen for live votes
    votesListener = db.ref('sessions/' + sessionId + '/votes/' + matchId)
      .on('value', snap => {
        const votes = snap.val() || {};
        const topCount = Object.values(votes).filter(v => v === match.topSlot).length;
        const bottomCount = Object.values(votes).filter(v => v === match.bottomSlot).length;
        const total = topCount + bottomCount;

        document.getElementById('host-top-count').textContent = topCount;
        document.getElementById('host-bottom-count').textContent = bottomCount;
        document.getElementById('host-total-votes').textContent =
          total + ' vote' + (total !== 1 ? 's' : '') + ' cast';

        const topPct = total > 0 ? (topCount / total) * 100 : 0;
        const bottomPct = total > 0 ? (bottomCount / total) * 100 : 0;
        document.getElementById('host-top-bar').style.width = topPct + '%';
        document.getElementById('host-bottom-bar').style.width = bottomPct + '%';
      });
  }

  function setContestantPill(elId, flavor) {
    const el = document.getElementById(elId);
    el.textContent = flavor.name;
    el.style.backgroundColor = flavor.color;
    el.style.color = app.getTextColor(flavor.color);
  }

  // ============================================================
  // REVEAL & ADVANCE
  // ============================================================
  function revealAndAdvance() {
    if (!activeMatchId) return;

    const { round, matchIndex } = app.parseMatchId(activeMatchId);
    const match = app.getState().rounds[round][matchIndex];

    db.ref('sessions/' + sessionId + '/votes/' + activeMatchId)
      .once('value')
      .then(snap => {
        const votes = snap.val() || {};
        const topCount = Object.values(votes).filter(v => v === match.topSlot).length;
        const bottomCount = Object.values(votes).filter(v => v === match.bottomSlot).length;

        // Determine winner (ties go to top seed)
        const winner = bottomCount > topCount ? match.bottomSlot : match.topSlot;

        // Apply winner to bracket (uses existing logic)
        app.pickWinner(activeMatchId, winner);

        // Push updated bracket + status to Firebase
        sessionRef.update({
          status: 'revealed',
          activeMatchId: activeMatchId,
          bracket: app.getState(),
          lastWinner: winner,
        });

        // Remove votes listener
        if (votesListener) {
          db.ref('sessions/' + sessionId + '/votes/' + activeMatchId)
            .off('value', votesListener);
          votesListener = null;
        }

        // Clear active match highlight
        const matchEl = document.getElementById(activeMatchId);
        if (matchEl) matchEl.classList.remove('match-voting');

        activeMatchId = null;

        // Return to lobby, re-mark voteable matches
        document.getElementById('host-voting-panel').hidden = true;
        document.getElementById('host-lobby').hidden = false;
        app.rerenderBracket();
        markVoteableMatches();
      });
  }

  // ============================================================
  // CANCEL VOTING
  // ============================================================
  function cancelVoting(resetPanel = true) {
    if (!activeMatchId) return;

    if (votesListener) {
      db.ref('sessions/' + sessionId + '/votes/' + activeMatchId)
        .off('value', votesListener);
      votesListener = null;
    }

    sessionRef.update({ status: 'lobby', activeMatchId: null });

    const matchEl = document.getElementById(activeMatchId);
    if (matchEl) matchEl.classList.remove('match-voting');

    activeMatchId = null;

    if (resetPanel) {
      document.getElementById('host-voting-panel').hidden = true;
      document.getElementById('host-lobby').hidden = false;
    }
  }

  // ============================================================
  // END SESSION
  // ============================================================
  function endSession() {
    if (!confirm('End the session? This will disconnect all voters.')) return;

    if (votesListener && activeMatchId) {
      db.ref('sessions/' + sessionId + '/votes/' + activeMatchId)
        .off('value', votesListener);
    }
    if (voterCountListener) {
      db.ref('sessions/' + sessionId + '/voterCount').off('value', voterCountListener);
    }

    // Remove session data from Firebase
    sessionRef.remove();

    // Reset UI
    document.body.classList.remove('host-mode');
    document.getElementById('host-btn').textContent = 'Host a Game';
    document.getElementById('host-btn').classList.remove('host-active');
    document.getElementById('reset-btn').disabled = false;
    document.getElementById('host-panel').hidden = true;

    // Remove bracket click listener and clean up classes
    document.getElementById('bracket').removeEventListener('click', onBracketClick);
    document.querySelectorAll('.match-voting, .match-voteable').forEach(el => {
      el.classList.remove('match-voting', 'match-voteable');
    });

    db = null;
    sessionId = null;
    sessionRef = null;
    activeMatchId = null;

    app.rerenderBracket();
  }

  // ============================================================
  // WIRE UP BUTTONS
  // ============================================================
  document.getElementById('host-btn').addEventListener('click', () => {
    if (sessionId) return; // already hosting
    initHostMode();
  });

  document.getElementById('host-end-btn').addEventListener('click', endSession);
  document.getElementById('host-reveal-btn').addEventListener('click', revealAndAdvance);
  document.getElementById('host-cancel-vote-btn').addEventListener('click', () => cancelVoting(true));

  // ============================================================
  // EXPOSE HELPERS TO vote.html (not needed in host.js itself,
  // but expose initHostMode for debugging convenience)
  // ============================================================
  window.hostApp = { initHostMode, endSession };

})();
