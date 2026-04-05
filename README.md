# buddy-reroll

Pick the perfect [Claude Code](https://docs.anthropic.com/en/docs/claude-code) `/buddy` companion — any species, rarity, eye, hat, shiny, and stat combination you want.

<img width="1390" height="1010" alt="buddy-reroll screenshot" src="https://github.com/user-attachments/assets/0786f4b8-35e2-4433-90af-25a0d9ebe1a9" />

<p align="center" width="100%">
<video src="https://github.com/user-attachments/assets/5de52c98-ce3c-428f-bd2d-7f208e1a6d38" width="80%" controls></video>
</p>

## Install

```bash
# Bun (recommended)
bunx buddy-reroll

# npm
npx buddy-reroll
```

Bun is faster, but Node.js >= 20 produces identical results — no Bun required.

## Usage

```bash
# Interactive — pick your buddy step by step
buddy-reroll

# Know what you want? Go direct
buddy-reroll --species dragon --rarity legendary --eye ✦ --hat propeller --shiny

# Just pick a few things, leave the rest to chance
buddy-reroll --species cat --rarity epic

# Choose your buddy's strengths
buddy-reroll --peak WISDOM --dump CHAOS

# See what's available
buddy-reroll --list

# Check your current buddy
buddy-reroll --current

# Keep your buddy after Claude updates
buddy-reroll --hook

# Stop keeping after updates
buddy-reroll --unhook

# Something wrong? Check your setup
buddy-reroll --doctor

# Undo everything
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
| `--peak` | Best stat — DEBUGGING, PATIENCE, CHAOS, WISDOM, SNARK |
| `--dump` | Weakest stat (can't match `--peak`) |
| `--list` | See all options |
| `--current` | Show your current buddy |
| `--restore` | Undo changes and go back to default |
| `--doctor` | Check if everything is set up right |
| `--hook` | Keep your buddy after Claude Code updates |
| `--unhook` | Stop keeping after updates |
| `--version`, `-v` | Print version |

## Keeping your buddy

Claude Code updates can reset your companion. `--hook` tells Claude to automatically restore your buddy every time it starts up.

```bash
buddy-reroll --hook    # set it up once
buddy-reroll --unhook  # remove whenever you want
```

## How fast is it?

buddy-reroll uses all your CPU cores (up to 8) to find the right companion. Both runtimes use the same wyhash algorithm as Claude Code, so your buddy will always match `/buddy` exactly.

| Runtime | Speed | Hash |
|---|---|---|
| Bun | Faster (native `Bun.hash`) | wyhash ✓ |
| Node.js >= 20 | Slightly slower (pure JS) | wyhash ✓ |

## Requirements

- Node.js >= 20 or [Bun](https://bun.sh)
- Claude Code

## Troubleshooting

```bash
buddy-reroll --doctor
```

This checks your setup — where Claude is installed, whether buddy-reroll can write to it, and what to do next if something's off.

If Claude was installed system-wide and isn't writable, you can point to a different location:

```bash
CLAUDE_BINARY_PATH=/path/to/claude buddy-reroll --doctor
```

## License

MIT
