# /sickday

A skill for GTA 6 launch week (Thursday, Nov 19, 2026). It writes a believable, funny day-off
letter to your manager that cites your real recent commits and PRs and promises your coding
agent keeps shipping while you are out. It also renders each letter as a shareable card PNG.

![A /sickday card: an out of office request from Sam to Priya, with what the agent ships while Sam is out and the commitment level](docs/card.png)

## What it does

1. Asks for your first name, your manager's first name, email or Slack, a commitment level
   (1 calendar invite, 2 polite heads-up, 3 vague but sincere, 4 suspicious timing,
   5 already logged off) and optional details: team, days off, things to mention or leave out.
2. Writes three letter variants from your own git history.
3. Renders each as a 2400x1260 PNG card in `~/Downloads/sickday/`, printed with its full path.
4. Lets you pick one, regenerate, go hotter or milder, or edit a line.
5. Hands over the letter to copy, the card path, and a pre-filled X post link. You attach the
   card and post it yourself. Nothing is sent or posted for you.

Rendering is fully local (Node 18+, no install, no network). Emails, links and phone
numbers are stripped from cards, and cards show first names only.

## Install

Command Code:

```bash
git clone https://github.com/vipulgupta2048/gta6-sick-day-skill
mkdir -p ~/.commandcode/skills && cp -R gta6-sick-day-skill/skills/sickday ~/.commandcode/skills/
```

Other agents that read `~/.agents/skills` work the same way. Then run `/sickday`.

## Credits

- Fonts: Geist Mono, SIL Open Font License (`skills/sickday/fonts/OFL.txt`).
- Renderer: resvg-wasm, Mozilla Public License 2.0 (`skills/sickday/vendor/resvg-wasm/LICENSE`).
