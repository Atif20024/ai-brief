# AI Brief

Daily (Mon–Sat) and weekly (Sunday) digest of AI and data-science news, research, repos and tools. Written by a scheduled Claude task, hosted on GitHub Pages as a single-page app.

- Site: https://atif20024.github.io/ai-brief
- `index.html`, `app.js`, `style.css` — the app (tabs, date navigation, archive).
- `data/YYYY-MM-DD.json` — one file per post. `data/index.json` lists them all.
- `state/instructions.md` — standing instructions the task reads every run. Edit this to steer the brief.
- `state/watchlist.md` — things to keep following.
- `state/seen.md` — everything already posted, so nothing repeats.

## Post format (`data/YYYY-MM-DD.json`)

```json
{
  "date": "2026-11-05", "kind": "daily",
  "title": "AI Brief — Thursday, 5 November 2026",
  "summary": "one sentence", "window": "last ~36 hours (3–5 Nov)",
  "tabs": [
    {"id": "research", "name": "Research & Developments", "tiers": [
      {"name": "Must See", "items": [
        {"title": "…", "meta": "★ ~19k", "summary": "…", "note": "what you can do", "tag": "Confirmed", "source": "…", "url": "https://…", "topics": ["OpenAI", "Agents"], "links": [{"label": "…", "url": "…"}]}
      ]}
    ]}
  ],
  "footer": "sources checked…"
}
```
Only `title` is required per item. `topics` (2-4 short tags per item, e.g. "OpenAI", "Agents", "RAG", "Open weights") powers the topic filters — reuse existing tag spellings where possible. Tab ids and tier names are free-form; tiers starting with "Must"/"Should" are colour-coded.
