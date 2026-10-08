// The archive pop-up: lists every past hole, newest first. Today's hole
// and future holes are never listed. A past hole has to be unlocked by
// watching an ad before it can be played.

import { formatDiff } from './game.js';
import { todayHole, msForHole, formatDate } from './dates.js';
import { saveStore, isFinished, recordResult } from './storage.js';
import { showRewardAd } from './ads.js';

const $ = (id) => document.getElementById(id);

export function openArchive(store, puzzles) {
  const today = todayHole();
  const items = [];

  for (let hole = today - 1; hole >= 1; hole--) {
    const par = puzzles[(hole - 1) % puzzles.length].par;
    const onDay = store.daily[hole];
    const record = isFinished(onDay) ? onDay : store.archive[hole];

    let status = '🔒 Watch an ad to play';
    if (isFinished(record)) {
      const result = recordResult(record);
      status = record.status === 'won' ? `${result.label} (${formatDiff(result.diff)})` : 'X (out of strokes)';
    } else if (record) {
      status = record.strokes > 0 || record.hints.length > 0 ? 'In progress' : 'Unlocked';
    }

    const item = document.createElement('li');
    item.innerHTML =
      '<a><span class="hole-name"></span><span class="hole-meta"></span><span class="hole-result"></span></a>';
    const link = item.firstChild;
    link.href = `./?hole=${hole}`;
    link.children[0].textContent = `Hole ${hole}`;
    link.children[1].textContent = `${formatDate(msForHole(hole), { month: 'short', day: 'numeric', year: 'numeric' })} · Par ${par}`;
    link.children[2].textContent = status;
    link.children[2].classList.toggle('unplayed', !isFinished(record));

    if (!record) {
      link.addEventListener('click', async (event) => {
        event.preventDefault();
        $('ad-reward').textContent = `Hole ${hole} unlocks`;
        const watched = await showRewardAd($('ad-dialog'));
        if (!watched) return;
        // An empty saved game marks the hole as unlocked.
        store.archive[hole] = { rows: null, hints: [], strokes: 0, status: 'playing', par };
        saveStore(store);
        location.href = link.href;
      });
    }
    items.push(item);
  }

  $('archive-empty').hidden = items.length > 0;
  $('archive-list').replaceChildren(...items);
  if (!$('archive-dialog').open) $('archive-dialog').showModal();
}
