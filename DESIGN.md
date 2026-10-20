---
version: alpha
name: Worksheet Studio
description: Warm, friendly and calm, made for a teacher who is not a computer expert. Adapted from a warm consumer-marketplace system (white canvas, one coral accent, soft rounded cards), with sizes raised for older eyes and hands.

colors:
  primary: "#e8505b"          # coral: primary actions, active tool, selection handles
  primary-active: "#cc3943"
  primary-soft: "#fde8e9"     # active tool background, the big "Open a photo" area
  ink: "#222222"
  body: "#3f3f3f"
  muted: "#6a6a6a"
  hairline: "#e4ddd6"
  canvas: "#fffaf6"           # warm off-white app background
  surface: "#ffffff"
  surface-soft: "#f6f1ec"
  work: "#ece6df"             # area behind the page
  blue: "#1f5fbf"             # selection box, focus ring
  danger: "#c13515"
  erase-mark: "#ff2d55"       # magic-eraser marks, shown at 50% opacity

typography:
  ui: "'Nunito Variable', system-ui, sans-serif"   # rounded, very readable
  base-size: 18px            # never below 15px anywhere
  title: 32px / 800
  button: 18px / 700
  worksheet-fonts: [Andika (Clear), Fredoka (Round), Comic Neue (Fun)]

rounded: { sm: 10px, md: 16px, lg: 24px, full: 9999px }
spacing: { xs: 4px, sm: 8px, md: 12px, base: 16px, lg: 24px, xl: 32px }
sizes:
  tap-target: 56px            # buttons; chips and swatches at least 48px
  tool-button: 72px tall
  transformer-anchor: 22px    # crop anchors 26px
---

## Rules

1. **One thing at a time.** A bottom bar of six labelled tools; only one options panel is open, and it sits right above the bar.
2. **Words, not only icons.** Every button has a text label. Icons support the words.
3. **Undo is always visible** at the top, next to Home and the zoom controls.
4. **One coral accent.** The primary action in each panel is coral; everything else is white with a soft border. Erase/Delete actions use the danger colour.
5. **Plain-language hints.** Each panel starts with one sentence saying what to do ("Paint over what you want to remove, then press Erase").
6. **Never lose work.** Autosave runs after every change, and the top bar shows "Saving…" or "Saved".
7. **Busy states are explicit.** Slow work (AI erase, PDF) shows a centred card with a spinner and a plain message, plus a progress bar while the model downloads.
8. **Phone:** the top bar shows icons only; tool labels shrink to 12.5px but stay visible. The layout must work at 375px with no sideways scrolling.

## Don't

- Don't add hidden gestures as the only way to do something. Pinch-zoom always has the − / fit / + buttons as a fallback.
- Don't use colour alone to show state. The active tool also gets a tinted background.
- Don't use another product's name, logo or fonts.
