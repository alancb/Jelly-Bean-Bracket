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
  apiKey:            'AIzaSyDQjD9v42CIzZW_oV7DBdij0xkrnffRHmw',
  authDomain:        'jelly-bean-bracket-a9602.firebaseapp.com',
  // databaseURL: verify this in Firebase console → Realtime Database → Data tab
  // It should look like: https://jelly-bean-bracket-a9602-default-rtdb.firebaseio.com
  databaseURL:       'https://jelly-bean-bracket-a9602-default-rtdb.firebaseio.com',
  projectId:         'jelly-bean-bracket-a9602',
  storageBucket:     'jelly-bean-bracket-a9602.firebasestorage.app',
  messagingSenderId: '396968042830',
  appId:             '1:396968042830:web:51988b2cb05ea844a73e1f',
};
