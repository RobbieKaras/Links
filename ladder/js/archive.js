// The archive page: lists every past hole, newest first. Today's hole and
// future holes are never listed.

import './site.js';
import { formatDiff } from './game.js';
import { todayHole, msForHole, formatDate } from './dates.js';
import { loadStore, isFinished, recordResult } from './storage.js';

async function init() {
  const puzzles = await fetch('data/puzzles.json').then((res) => res.json());
  const store = loadStore();
  const today = todayHole();
  const list = document.getElementById('archive-list');

  document.getElementById('archive-empty').hidden = today > 1;

  for (let hole = today - 1; hole >= 1; hole--) {
    const par = puzzles[(hole - 1) % puzzles.length].par;
    const onDay = store.daily[hole];
    const record = isFinished(onDay) ? onDay : store.archive[hole];

    let status = 'Not played';
    if (isFinished(record)) {
      const result = recordResult(record);
      status = record.status === 'won' ? `${result.label} (${formatDiff(result.diff)})` : 'X (out of moves)';
    } else if (record && record.guesses.length > 0) {
      status = 'In progress';
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
    list.append(item);
  }
}

init();
