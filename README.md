# pi-fixed-defaults

A minimal [Pi](https://github.com/badlogic/pi-mono) extension that keeps a fixed model and thinking level for fresh sessions without changing the current session when configured.

## Features

- `/defaults` displays only scoped models.
- Search models directly in a paginated list.
- Saves the selected model and thinking level for future fresh sessions and `/new`.
- Startup and `/new` always apply the fixed defaults.
- Resumed, forked, and reloaded sessions keep an allowed saved model.
- Missing or out-of-scope restored models fall back to the fixed defaults.
- Later out-of-scope `model_select` events are reverted once to the fixed defaults.
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
