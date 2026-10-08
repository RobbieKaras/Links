// Ad placeholders.
//
// The two display ad spots (the banner under the board and the box on the
// results screen) are plain <div class="ad-slot"> elements in index.html.
// Search index.html for "PASTE AD CODE HERE" to find them.
//
// This file handles the "Watch an ad for a hint" button. For now the ad is
// faked with a countdown.

import { CONFIG } from './config.js';

// Shows the hint "ad" and resolves to true if the player watched it to the
// end, or false if they closed it early.
//
// ============================ PASTE AD CODE HERE ============================
// To use a real rewarded ad, replace the body of this function with a call
// to your ad provider, and resolve(true) only when the provider reports that
// the reward was earned. Nothing else in the game needs to change.
//
// Note: standard AdSense display units cannot be used as "watch to unlock"
// ads. Rewarded ads on the web come from Google's rewarded formats (the Ad
// Placement API / Google Ad Manager), which need separate approval.
// ===========================================================================
export function showHintAd(dialog) {
  return new Promise((resolve) => {
    const counter = dialog.querySelector('[data-countdown]');
    let remaining = CONFIG.HINT_AD_SECONDS;
    let earned = false;

    const tick = () => {
      counter.textContent = remaining;
      if (remaining <= 0) {
        earned = true;
        dialog.close();
        return;
      }
      remaining--;
      timer = setTimeout(tick, 1000);
    };
    let timer;

    dialog.addEventListener(
      'close',
      () => {
        clearTimeout(timer);
        resolve(earned);
      },
      { once: true }
    );
    dialog.showModal();
    tick();
  });
}
