# buddy-reroll

Reroll your [Claude Code](https://docs.anthropic.com/en/docs/claude-code) `/buddy` companion to any species, rarity, eye, hat, and shiny combination.

## Install

```bash
bun install -g buddy-reroll
```

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

- [Bun](https://bun.sh) (uses `Bun.hash()` to match Claude Code's internal hashing)
- Claude Code

## License

MIT
