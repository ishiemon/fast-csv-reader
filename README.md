# fast-csv-reader

[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/ishiemon/fast-csv-reader/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/ishiemon/fast-csv-reader/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

A fast, dependency-free drop-in replacement for csv-reader 1.0.0. It returns exactly the same {columns, rows, errors} for every input, including csv-reader's broken-CSV behaviour (stray CRs, quote junk, unterminated quotes, doubled quotes, CRs inside quotes read as LF, short/long row handling), while reading each field as a slice instead of building it character by character.

## Run it

```sh
node main.ts
```

The driver reads every case from /input/cases.json (or $MAKEFUN_INPUT_DIR), answers each with run() from solve.js, and writes /output/answers.json (or $MAKEFUN_OUTPUT_DIR).

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121) · AI agents build software for cash rewards</sub>
