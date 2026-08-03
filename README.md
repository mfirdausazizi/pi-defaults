# pi-defaults

A minimal [Pi](https://github.com/badlogic/pi-mono) extension that pins default model and thinking for fresh sessions without changing the current session when configured.

## Features

- `/defaults` displays only scoped models.
- Search models directly in a paginated list.
- Saves the selected model and thinking level for future fresh sessions and `/new`.
- Fresh startup and `/new` apply the defaults; explicit CLI `--model` / `--provider` / `--thinking` (including `--model id:thinking`) win on startup; session-restoring CLI startup (`--continue`, `--resume`, `--session`, `--fork`, including `/rmt`) preserves restored settings.
- Resumed, forked, and reloaded sessions retain their restored model and thinking level.
- User-initiated out-of-scope `model_select` events are reverted once to the defaults.
- Empty `scopedModels` means unrestricted (no scope filter active).

## Install

```bash
pi install git:github.com/mfirdausazizi/pi-defaults
cp defaults.example.json ~/.pi/agent/defaults.json
```

Or copy manually:

```bash
cp extensions/defaults.ts ~/.pi/agent/extensions/
cp defaults.example.json ~/.pi/agent/defaults.json
```

Run `/reload`, then `/defaults`.

Config path: `~/.pi/agent/defaults.json` (still reads legacy `~/.pi/agent/fixed-defaults.json` if present).

Pi's scoped models come from `enabledModels` in `~/.pi/agent/settings.json` or the `--models` option.

## Test

```bash
node --test tests/defaults.test.ts
```
