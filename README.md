# pi-fixed-defaults

A minimal [Pi](https://github.com/badlogic/pi-mono) extension that keeps a fixed model and thinking level for fresh sessions without changing the current session when configured.

## Features

- `/defaults` displays only scoped models.
- Search models directly in a paginated list.
- Saves the selected model and thinking level for future fresh sessions and `/new`.
- Fresh startup and `/new` apply the fixed defaults; session-restoring CLI startup (`--continue`, `--resume`, `--session`, `--fork`, including `/rmt`) preserves restored settings.
- Resumed, forked, and reloaded sessions retain their restored model and thinking level.
- User-initiated out-of-scope `model_select` events are reverted once to the fixed defaults.
- Empty `scopedModels` means unrestricted (no scope filter active).

## Install

```bash
cp extensions/fixed-defaults.ts ~/.pi/agent/extensions/
cp fixed-defaults.example.json ~/.pi/agent/fixed-defaults.json
```

Run `/reload`, then `/defaults`.

Pi's scoped models come from `enabledModels` in `~/.pi/agent/settings.json` or the `--models` option.

## Test

```bash
node --test tests/fixed-defaults.test.ts
```
