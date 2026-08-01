# pi-fixed-defaults

A minimal [Pi](https://github.com/badlogic/pi-mono) extension that keeps a fixed model and thinking level for fresh sessions without changing the current session when configured.

## Features

- `/defaults` displays only scoped models.
- Search models directly in a paginated list.
- Saves the selected model and thinking level for future fresh sessions and `/new`.
- Resumed and forked sessions keep their saved model and thinking level.

## Install

```bash
cp fixed-defaults.ts ~/.pi/agent/extensions/
cp fixed-defaults.example.json ~/.pi/agent/fixed-defaults.json
```

Run `/reload`, then `/defaults`.

Pi's scoped models come from `enabledModels` in `~/.pi/agent/settings.json` or the `--models` option.

## Test

```bash
node --test tests/fixed-defaults.test.ts
```
