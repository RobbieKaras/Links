# Links

A daily word chain scored like golf. Each word links to the next to make a phrase or compound word (peanut **butter**, butter**cup**, cup**cake**). The first and last words are shown; players fill in the ones between from just their first letters.

Plain HTML, CSS and JavaScript with no backend, so it can be hosted for free on GitHub Pages.

The game's name is set in one place: `GAME_NAME` in [js/config.js](js/config.js).

## Run it on your computer

You need [Node.js](https://nodejs.org) (you already have it installed).

1. Open the project folder in VS Code.
2. Open a terminal: menu **Terminal > New Terminal**.
3. Type this and press Enter:

   ```
   npm start
   ```

4. Open your browser and go to **http://localhost:8000**
5. To stop the game server, click in the terminal and press **Ctrl+C**.

Double-clicking `index.html` will not work. Browsers block the game's files from loading that way, which is why step 3 is needed.

To test on your phone, it is easiest to put the game online first (see below).

## Run the tests

```
npm test
```

This checks the chain generator, the game rules, scoring, streaks and the weekly scorecard. Every line should start with a tick.

## How the game works

- A chain has 7 words. The first and last are shown in full.
- The 5 words between show only their first letter. The length is not shown.
- Players can solve the words in any order. Every guess is one stroke, right or wrong.
- Past holes are in the archive. Each one has to be unlocked by watching an ad, and stays unlocked on that device. Archive games never count toward stats, streaks or the scorecard.
- A wrong guess reveals the next letter of that word. If every letter ends up revealed, the word is filled in (shown in yellow instead of green).
- Par is the number of hidden words + 2, so par 7. The best possible score is 5 strokes, an Eagle.
- The stroke limit is par + 4. Running out is scored as an "X".

## Settings you can change

Everything is in [js/config.js](js/config.js):

| Setting | What it does |
|---|---|
| `GAME_NAME` | The name shown in the header, page titles and share text |
| `LAUNCH_DATE` | The date of Hole 1. **Set this before you launch** |
| `CHAIN_LENGTH` | Words per chain, including the two shown (currently 7) |
| `PAR_OFFSET` | Par = hidden words + this number (currently 2) |
| `MAX_STROKES_OVER_PAR` | Stroke limit = par + this number (currently 4) |
| `LOSS_OVER_PAR` | What an "X" counts as in the weekly total (currently par + 5) |
| `HINTS_PER_GAME` | Hints allowed per hole (currently 1) |
| `REWARD_AD_SECONDS` | Length of the placeholder "ad" for hints and archive unlocks (currently 3) |
| `MAX_WORD_LENGTH` | Longest word allowed in a chain (currently 9, so rows fit on a phone) |
| `PUZZLE_COUNT` | How many daily puzzles to generate (currently 365) |

Two things to remember:

- After changing `CHAIN_LENGTH`, `PAR_OFFSET`, `MAX_WORD_LENGTH` or `PUZZLE_COUNT`, run `npm run puzzles` to rebuild the puzzle file. Then run `npm test`.
- The "How to play" pop-up in [index.html](index.html) describes the scoring in words ("two more than the number of missing words", "four strokes more than par", "5 over par"). If you change those numbers, update that text too.

### About the launch date

`LAUNCH_DATE` is currently a placeholder (`2026-10-07`), so you can already see past holes in the archive while testing. Before you go live, set it to your real launch day. Do this **before** people start playing: changing it later changes which puzzle is "today", and players' saved results would no longer line up.

The daily hole switches at midnight UTC for everyone.

## The pair list and puzzles

The whole game is built from one file you can edit: [scripts/wordlists/pairs.txt](scripts/wordlists/pairs.txt).

Each line looks like this:

```
butter: cup fly milk scotch ball knife nut finger
```

It means "butter cup", "butter fly", "butter milk" and so on are all good links. Chains are made by following pairs from word to word.

- **To remove a link** that feels obscure or unfair, delete that word from its line.
- **To add links**, add words to a line, or add a new line. More pairs means more variety. Words that appear both first on a line and after the colon on other lines are the most useful, because chains can pass through them.

After editing, run:

```
npm run pairs
npm run puzzles
npm test
```

**Warning:** rebuilding the puzzles after changing the pair list changes the daily holes. Do it before launch, not after.

| File | What it is |
|---|---|
| `scripts/wordlists/pairs.txt` | The pair list you edit |
| `data/pairs.json` | The same pairs in the form the puzzle generator reads |
| `data/puzzles.json` | The daily holes, generated ahead of time |

How puzzles are chosen:

- Every chain uses known pairs only, and no word appears twice in a chain.
- A chain is thrown out if any hidden word has a rival: another word in the list with the same first letter that fits between the same two neighbours. That stops a player from giving a correct-looking answer and being marked wrong. It can only check against words in the list, so a rival that is not in `pairs.txt` can still slip through.
- Chains are picked to reuse the same pairs as little as possible.

The list currently has about 1,500 pairs, written by hand. A year of holes uses roughly half of them, and the most-repeated pair appears 9 times in the year. Adding pairs reduces that repetition.

The hidden words in `puzzles.json` are lightly scrambled so they cannot be read at a glance. This is not real security. Because there is no server, a determined player can work out the answers, and can see future holes by changing the clock on their device.

## Ads

Ads are placeholders for now. Search the project for **`PASTE AD CODE HERE`** to find every spot:

1. **`index.html`, in the `<head>`**: where the site-wide AdSense script tag goes (`privacy.html` has the same marker).
2. **`index.html`, the banner at the bottom of the page** (`#ad-banner`): the space is reserved in advance (50px tall on phones, 90px on wide screens) so the page does not jump when an ad loads.
3. **`index.html`, the results screen** (`#ad-result`): room for a 300 x 250 ad.
4. **`js/ads.js`, the two "watch an ad" rewards** (the hint button, and unlocking a hole in the archive): currently a 3-second countdown. Standard AdSense display ads cannot be used as "watch to unlock" ads. That needs one of Google's rewarded ad formats, which require separate approval, so check what your account offers when you apply.

No ad pops up or interrupts play. The reward ads only appear when the player taps the hint button or a locked archive hole.

**Privacy policy:** [privacy.html](privacy.html) is its own page, opened from the small Privacy link in the top corner. Before applying for AdSense, fill in the date and contact email, marked with square brackets. It is a starting template, not legal advice.

## Put it online with GitHub Pages

You only need to do steps 1 to 4 once.

### 1. Create a GitHub account

Go to [github.com](https://github.com) and sign up (free).

### 2. Create a repository

1. On GitHub, click the **+** at the top right, then **New repository**.
2. Give it a name, for example `links`. This becomes part of your web address.
3. Choose **Public**. (GitHub Pages is only free for public repositories.)
4. Do **not** tick "Add a README". Leave everything else as it is.
5. Click **Create repository**. Keep the page open: you need the address it shows, which looks like `https://github.com/YOUR-USERNAME/links.git`.

### 3. Upload the project

In the VS Code terminal, run these one line at a time. Replace the address in the fourth line with your own.

```
git init -b main
git add .
git commit -m "First version"
git remote add origin https://github.com/YOUR-USERNAME/links.git
git push -u origin main
```

- If Git asks who you are, run these two lines with your own details, then repeat the `git commit` line:

  ```
  git config --global user.name "Your Name"
  git config --global user.email "you@example.com"
  ```

- The first `git push` opens a browser window asking you to sign in to GitHub. Sign in and approve it.

### 4. Turn on GitHub Pages

1. On your repository page on GitHub, click **Settings**.
2. In the left menu, click **Pages**.
3. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
4. Set **Branch** to **main** and the folder to **/ (root)**, then click **Save**.
5. Wait a minute or two and refresh the page. Your address appears at the top:
   `https://YOUR-USERNAME.github.io/links/`

That address is your live game. Open it on your phone to test it there.

### 5. Updating the game later

After you change anything, run these three lines to publish the change:

```
git add .
git commit -m "Describe what you changed"
git push
```

The live site updates a minute or two later. If you do not see the change, refresh with **Ctrl+F5**.

### A custom domain (optional, but useful for AdSense)

AdSense generally wants a site on a domain you own (like `yourgame.com`) rather than a `github.io` address. You can buy a domain from any registrar, then add it under **Settings > Pages > Custom domain** and follow GitHub's instructions for the DNS settings. The game needs no changes for this.

## The earlier word ladder game

The first game (a word ladder with a hidden target) is kept, complete and working, in the [ladder/](ladder/) folder. Nothing in Links links to it, but while it is in the project it is also published, at `/ladder/` on your site. Delete the folder if you do not want that. Its tests run as part of `npm test`.

## Project layout

```
index.html            the whole game, plus the pop-ups (archive, how to play, stats, scorecard)
privacy.html          privacy policy page
css/style.css
js/config.js          settings
js/game.js            game rules and golf scoring
js/chain-gen.js       chain generator
js/dates.js           hole numbers and UTC dates
js/storage.js         saved games, stats, weekly scorecard
js/share.js           share text
js/ads.js             hint ad placeholder
js/codec.js           scrambles hidden words in puzzles.json
js/main.js            the game page
js/archive.js         the archive pop-up
js/site.js            puts the game name into the page
data/                 pairs and puzzles
scripts/              pair list, puzzle generator, local server
tests/                tests
ladder/               the earlier word ladder game
```
