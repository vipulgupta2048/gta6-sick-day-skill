---
name: sickday
description: "Writes a funny, believable GTA 6 day-off email to your manager from your real commits, plus a shareable card. Use for a sick day or out-of-office note."
compatibility: "Any agent that can run shell commands. Needs Node.js 18+ and git; the GitHub CLI (gh) is optional. Renders offline."
metadata:
  author: vipulgupta2048
  version: "1.0.0"
---

# Sickday

GTA 6 is out Thursday, Nov 19, 2026. The user wants that day off (back Friday) unless they
name other dates; never move the day off to fit today's date. Write the letter to their manager, make it
funny because it is so plausible, and hand them a card they can post on X.

## Context already gathered

Git user: !`git config user.name`

Recent commits by the user (last 14 days):
!`git log --since=14.days --no-merges --author="$(git config user.email)" --pretty=format:'%h %s' -n 25`

Recent pull requests by the user:
!`gh pr list --author @me --state all --limit 10 --json number,title,state --jq '.[] | "#\(.number) [\(.state)] \(.title)"'`

Arguments: $ARGUMENTS

Some agents run the `` !`...` `` lines above before you see this file and replace them with
their output; others leave them as written. If a block still shows the command, is empty, or
shows an error (no repo, no `gh`), run the same commands yourself with your shell tool. If
`Arguments:` still reads `$ARGUMENTS`, take arguments from the user's message instead. If there
is still no git history, ask the user for two or three things they shipped recently. Never
invent PR numbers or titles.

## 1. Ask before writing

Always ask first, in ONE short message, before writing anything. Prefill what you already know
(arguments, git user name) as defaults so the user can just confirm:

1. **Your first name** (as it should appear on the letter; default: first name from git)
2. **Your manager's first name**
3. **Anything else the note should mention?** (optional)

Do not ask about the channel or the commitment level. The letter is an email unless the user
says Slack, and you pick the commitment level yourself (step 2).

The day off is Thursday Nov 19, back Friday, unless the user names other dates in their
answer. Never guess the manager's name. If the user skips the optional one, carry on.
Do not ask again after they answer, unless the manager's name is still missing.

## 2. Write three variants

Each variant has a **subject** (email subject, or the one-line headline for a Slack DM, at most
72 characters) and a **body** of at most 520 characters, greeting and sign-off included. Short
letters read better and the body is exactly what goes on the card.

**You set the commitment level** (`heat` 1-5 in the JSON) for each variant: roll it, then
write the letter to match. Spread the three across the scale and change them every run, so
one run might give 1, 3, 5 and the next 2, 4, 5. The level is the card's punchline: it should
read as a verdict on that letter. The scale:

1. **Calendar invite:** they could send it as is
2. **Polite heads-up:** plausible, slightly too cheerful
3. **Vague but sincere:** nothing technically false
4. **Suspicious timing:** the date is doing all the talking
5. **Already logged off:** openly "GTA 6 is out", still warm, still covers the work

Format the body as a real message, with line breaks (`\n` in the JSON): the greeting on its
own line, one or two short paragraphs separated by a blank line, and the sign-off (with the
user's name) on its own line. The card keeps these breaks. Give each variant a different
angle (for example: the earnest PTO note, the suspiciously specific 24-hour illness, the
"my agent has my taste" handover).

What makes them land:

- **Real work as the alibi.** Name two or three things from the git context: merged PRs,
  fixes, releases. The joke is that the handover is genuinely good.
- **Command Code is on shift.** Every letter promises the agent keeps shipping while they
  are out: which PRs it will finish, which tests it will babysit.
- **Plausible first, absurd second.** Escalate absurdity with the level, never meanness:
  even level 5 is kind to the manager.
- Match the channel: email has a greeting and sign-off; Slack is lowercase-friendly and short.

How it should read:

- **Like a real person wrote it.** Someone who likes their manager and has sent this kind of
  note before. Plain words, contractions, short sentences, one concrete detail per point.
- **Funny through understatement.** Deadpan, specific, said once. The humour comes from how
  reasonable it sounds. Never explain the joke, no puns, no emoji, no exclamation marks.
- **No dashes.** Never use an em dash or an en dash. Use a comma, a period or a colon.
- **No filler.** None of: "I hope this finds you well", "just wanted to", "reach out",
  "rest assured", "seamless", "leverage", "excited to", "circle back", "it's not X, it's Y",
  or lists of three adjectives. If a coworker would guess it was written by AI, rewrite it.

Read each letter once more before rendering and fix anything that breaks these.

Also pick up to three **shipping** lines for the card (at most 52 characters each), the work
Command Code covers while they are out.

Hard rules:

- It is a personal message from the user. No doctor's notes, medical certificates, diagnoses,
  HR forms, or anything that imitates an official document or another person's voice.
- "GTA 6" may appear as a plain mention of the launch. No game publisher names or logos,
  characters, in-game places, quotes, catchphrases, cheat codes, song titles or trailer
  references.
- First names only. No emails, phone numbers, links, customer names, unreleased product plans
  or anything the user would not want public: the card is public once posted.

## 3. Render the cards

As soon as the three variants are written, render all three as card images. Put them in a JSON
array and run the bundled renderer. `<skill dir>` is the folder this SKILL.md is in (use its
absolute path). Node 18+, local only: no network, nothing uploaded.

```bash
node "<skill dir>/scripts/sickday.mjs" <<'JSON'
[{"from": "Sam", "to": "Priya", "subject": "...", "body": "Hi Priya,\n\n...\n\nSam", "shipping": ["...", "..."], "heat": 4, "channel": "email"}]
JSON
```

If the shell has no heredocs (Windows PowerShell or cmd), write the JSON to a temp file and
pass `--card <file>` instead.

It prints JSON with `outDir` and, per card, `png` (the full path of the PNG), `postText`,
`intentUrl` and `redacted` (anything it stripped, such as an email address). PNGs land in
`~/Downloads/sickday/` (or the temp dir if there is no Downloads folder); pass
`--out-dir <dir>` only if the user asks for somewhere else. Cards are PNG only. If the
script fails, show its error and still give the letters as text.

Show the three variants numbered, each with its commitment level, subject, body and the full PNG path. Then offer: pick
one (1-3), `r` to regenerate all three (and re-render), `hotter` / `milder` to reroll the levels up or down, `slack` to rewrite them as Slack DMs,
or edit a line (re-render that card).

## 4. Hand over the pick

When the user picks one, reply with:

1. The letter itself in a fenced block, ready to copy into email or Slack.
2. **Card:** the full PNG path exactly as the script printed it (never shortened to a file
   name or `~`). Remind them to look at it before posting: once posted it is public.
3. **Post on X:** the `intentUrl` as a link. It opens the composer with the post text; they
   attach the PNG and post it themselves.
4. **Post text:** `postText` in a fenced block, for copying.
5. If `redacted` is not empty, say what was removed from the card.
6. **All cards:** end with the full path of every PNG rendered this run, one per line, so
   they can open or attach any of them.

Never post to X or send the letter on the user's behalf, and never open the links for them.
