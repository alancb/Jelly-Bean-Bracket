/**
 * firebase-config.js
 *
 * Firebase client config for Jelly Belly Bracket live voting.
 *
 * NOTE: Firebase client credentials are NOT secret — they identify your project
 * and are safe to commit to a public repo. Security is enforced by Firebase
 * Security Rules in the console, not by keeping this file private.
 */
window.FIREBASE_CONFIG = {
  apiKey:            'AIzaSyDeMzyVNLk_fIY1XkNAo-Wxfk2a-qeqkbU',
  authDomain:        'jelly-bean-bracket.firebaseapp.com',
  // databaseURL: verify this in Firebase console → Realtime Database → Data tab
  // It should look like: https://jelly-bean-bracket-default-rtdb.firebaseio.com
  databaseURL:       'https://jelly-bean-bracket-default-rtdb.firebaseio.com',
  projectId:         'jelly-bean-bracket',
  storageBucket:     'jelly-bean-bracket.firebasestorage.app',
  messagingSenderId: '743960351360',
  appId:             '1:743960351360:web:af548920831ff91100cc65',
};
