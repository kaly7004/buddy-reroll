# buddy-reroll

Reroll your [Claude Code](https://docs.anthropic.com/en/docs/claude-code) `/buddy` companion to any species, rarity, eye, hat, and shiny combination.

<img width="1390" height="1010" alt="CleanShot 2026-04-02 at 19 53 02@2x" src="https://github.com/user-attachments/assets/0786f4b8-35e2-4433-90af-25a0d9ebe1a9" />

<p align="center" width="100%">
<video src="https://github.com/user-attachments/assets/5de52c98-ce3c-428f-bd2d-7f208e1a6d38" width="80%" controls></video>
</p>


## Install

```bash
# Recommended (fastest brute-force)
bun install -g buddy-reroll

# Also works with Node.js >= 20
npm install -g buddy-reroll
npx buddy-reroll
```

Bun is recommended for the fastest brute-force search (native wyhash), but Node.js is fully supported via a bundled pure-JS wyhash implementation.

Optional runtime overrides:

- `CLAUDE_BINARY_PATH` forces a specific Claude Code binary path when auto-discovery via `PATH` is not enough.
- `CLAUDE_CONFIG_DIR` forces a specific Claude config directory when you do not want the default home-based lookup.

## Usage

```bash
# Interactive mode (recommended)
buddy-reroll

# Non-interactive
buddy-reroll --species dragon --rarity legendary --eye ✦ --hat propeller --shiny

# Partial spec (unspecified fields are left random)
buddy-reroll --species cat --rarity epic

# Show current companion
buddy-reroll --current

# Diagnose binary/config discovery
buddy-reroll --doctor

# Restore original binary
buddy-reroll --restore
```

## Options

| Flag | Values |
|---|---|
| `--species` | duck, goose, blob, cat, dragon, octopus, owl, penguin, turtle, snail, ghost, axolotl, capybara, cactus, robot, rabbit, mushroom, chonk |
| `--rarity` | common, uncommon, rare, epic, legendary |
| `--eye` | `·` `✦` `×` `◉` `@` `°` |
| `--hat` | none, crown, tophat, propeller, halo, wizard, beanie, tinyduck |
| `--shiny` | `--shiny` / `--no-shiny` |

## Requirements

- Node.js >= 20 or [Bun](https://bun.sh) (Bun recommended for faster brute-force)
- Claude Code

## Runtime Notes

- Bun provides ~45x faster hashing via native wyhash. Node.js uses a bundled pure-JS wyhash implementation that produces identical results.
- `buddy-reroll` first tries to discover Claude Code dynamically from `PATH`, then checks user-scoped install locations derived from the current OS.
- `--current`, `--help`, and `--list` work with read-only/system-managed Claude installs.
- `--restore` and any reroll command require write access to the real Claude binary because the tool creates `<binary>.backup` and patches the executable in place.

## Troubleshooting

If something is not working, start with:

```bash
buddy-reroll --doctor
```

This prints the detected binary path, config path, whether `--current` can run, whether the real binary is writable, and the next troubleshooting step.

If you see a message saying the Claude install is not writable, `buddy-reroll` successfully found Claude Code but cannot patch that installation as the current user. This is common when Claude was installed as a system package and the real binary lives in a root-owned directory outside your user-writable paths.

For fully automatic local validation, run:

```bash
bun run verify
```

This command runs the basic CLI checks, discovers Claude dynamically, and only runs the `--current` smoke check when both the binary and config were found on the machine.

## License

MIT
