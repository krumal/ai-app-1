---
name: ux-best-practices
description: Review UI code for Web Interface Guidelines compliance. Use when asked to "review my UI", "check accessibility", "audit design", "review UX", or "check my site against best practices".
---

# UX Best Practices

Psychology-based UX principles from Laws of UX and design audit frameworks.

## Quick Reference Structure

### Foundational Frameworks (references/audit/)
- `00-core-framework.md` — 3 pillars, decisioning workflow, macro bets
- `01-anchors.md` — 7 foundational mindsets for design resilience
- `02-information-scaffold.md` — Psychology, economics, accessibility, defaults

### Checklists (references/audit/)
- `10-checklist-new-interfaces.md` — 6-step process for designing new interfaces
- `11-checklist-fidelity.md` — Component states, interactions, scalability, feedback
- `12-checklist-visual-style.md` — Spacing, color, elevation, typography, motion
- `13-checklist-innovation.md` — 5 levels of originality spectrum

### Patterns (references/audit/)
- `20-patterns-chunking.md` — Cards, tabs, accordions, pagination, carousels
- `21-patterns-progressive-disclosure.md` — Tooltips, popovers, drawers, modals
- `22-patterns-cognitive-load.md` — Steppers, wizards, minimalist nav, simplified forms
- `23-patterns-visual-hierarchy.md` — Typography, color, whitespace, size, proximity
- `24-patterns-social-proof.md` — Testimonials, UGC, badges, social integration
- `25-patterns-feedback.md` — Progress bars, notifications, validation, contextual help
- `26-patterns-error-handling.md` — Form validation, undo/redo, dialogs, autosave
- `27-patterns-accessibility.md` — Keyboard nav, ARIA, alt text, contrast, zoom
- `28-patterns-personalization.md` — Dashboards, adaptive content, preferences, l10n
- `29-patterns-onboarding.md` — Tours, contextual tips, tutorials, checklists
- `30-patterns-information.md` — Breadcrumbs, sitemaps, tagging, faceted search
- `31-patterns-navigation.md` — Priority nav, off-canvas, sticky, bottom nav

### Psychology Principles (references/)
- `references/` — 38 UX principles from Laws of UX (see index below)

## Core Laws

| Law | Principle |
|-----|-----------|
| **Hick's Law** | Decision time increases with choices. Minimize options. |
| **Fitts's Law** | Larger, closer targets are faster to acquire. |
| **Miller's Law** | Working memory holds 7±2 items. Chunk information. |
| **Jakob's Law** | Users expect sites to work like others they know. |
| **Tesler's Law** | Complexity is constant; absorb it in the system, not the user. |

## Gestalt Principles

| Principle | Application |
|-----------|-------------|
| **Proximity** | Group related elements close together |
| **Similarity** | Use consistent styling for related functions |
| **Common Region** | Use borders/backgrounds to group elements |
| **Uniform Connectedness** | Connect related items with lines or colors |

## Key Effects

| Effect | Application |
|--------|-------------|
| **Von Restorff** | Make important items visually distinct |
| **Serial Position** | Place key items first and last in lists |
| **Peak-End Rule** | Optimize peak moments and endings |
| **Zeigarnik** | Show progress to motivate completion |
| **Goal Gradient** | Users accelerate near goal completion |

## Usage

### For Design Audits
1. Read `audit/00-core-framework.md` for the decisioning workflow
2. Use relevant checklists (fidelity, visual style)
3. Reference pattern files for specific UI components

### For New Interfaces
1. Follow the 6-step checklist in `audit/10-checklist-new-interfaces.md`
2. Reference relevant pattern files for specific UI components
3. Use fidelity and visual style checklists to enhance quality

### For Specific Principles
Search the `references/` folder for detailed articles on:
- Forms/checkout: choice-overload, hicks-law, teslers-law, cognitive-load
- Navigation: serial-position-effect, millers-law, chunking
- Buttons/CTAs: fittss-law, von-restorff-effect
- Loading/waiting: doherty-threshold, ux-waiting-states-checklist
- Onboarding: paradox-of-the-active-user, goal-gradient-effect, jakobs-law
- Visual design: aesthetic-usability-effect, law-of-proximity, law-of-similarity

## Attribution

- Audit framework from [Making UX Decisions](https://uxdecisions.com) by Tommy Geoco
- Psychology principles from [Laws of UX](https://lawsofux.com) by Jon Yablonski (CC BY-NC-ND 4.0)
- UX Waiting States Checklist from [BayramAnnakov/ux-waiting-audit](https://github.com/BayramAnnakov/ux-waiting-audit)
