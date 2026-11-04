# pinwand formats

Everything pinwand stores is plain, open data. Any tool (or Claude) can make content for it, and you can always take your boards elsewhere.

## Bringing content in

| You paste or drop | You get |
|---|---|
| JSON with `objects` (see below) | those items, with arrows and map branches, at the mouse |
| an `.html` file, or Insert → HTML block | a sealed, interactive block; `$…$` and `$$…$$` are typeset |
| cells from Excel / Word / Sheets, or a markdown table | a table |
| lines with indentation, while a map branch is selected | branches |
| Insert → From a list | many definitions, questions, notes, an arrow chain, a map or a table |

## Board items as JSON

```json
{
  "objects": [
    { "id": "a", "type": "def", "x": 0, "y": 0, "w": 380, "term": "Fixed point", "def": "$x^*$ with $f(x^*)=0$", "src": "L02" },
    { "id": "b", "type": "q", "x": 420, "y": 0, "w": 380, "qt": "why", "q": "Why is $f'(x^*)<0$ stable?", "a": "Small perturbations shrink." },
    { "id": "c", "type": "note", "x": 0, "y": 200, "w": 240, "text": "**bold** and $x^2$", "color": "yellow" },
    { "id": "m", "type": "node", "x": 0, "y": 400, "text": "Bifurcations", "layout": "both" },
    { "id": "m1", "type": "node", "parent": "m", "text": "saddle-node", "icon": "★" },
    { "id": "t", "type": "table", "x": 600, "y": 400, "rows": [["type", "normal form"], ["saddle-node", "$r+x^2$"]], "head": true },
    { "id": "f", "type": "frame", "x": -40, "y": -60, "w": 1300, "h": 700, "title": "L03" }
  ],
  "links": [ { "a": "a", "b": "b", "label": "uses" } ]
}
```

Positions are relative; the group lands where the mouse is. Map branches are placed by the map layout, so `x`/`y` can be left out for them.

**Types and their fields**

- `note`: `text`, `color` (yellow, green, blue, pink, grey, white, none), `style` (h1, h2)
- `def`: `term`, `def`, `src`
- `q`: `q`, `a`, `qt` (concept, why, method, theorem, example), `src`
- `node`: `text`, `parent`, `icon`, `shape` (box, round, pill, plain, fill), `color` (b1…b7); on the centre: `layout` (both, right, down, indent), `mapShape`
- `table`: `rows` (array of arrays of text), `head`, `colW`, `cover` (column numbers)
- `frame`: `title`, `w`, `h`
- `matrix`: `title`, `xl`, `xr`, `yb`, `yt`, `q1`…`q4`, `w`, `h`
- `fig`: `ft` (flow, map, plane), `expr` or `f`/`g`, ranges `xmin` `xmax` `ymin` `ymax`, parameter `pmin` `pmax` `p`

All text fields understand `**bold**`, `*italic*`, `$inline$` and `$$display$$` formulas (LaTeX).

## HTML blocks

Any self-contained page works: its own styles and scripts run sealed off from your board. pinwand adds the board's colours as CSS variables (`--paper`, `--paper-ink`, `--ink`, `--sel`, `--b1` … `--b7`, `--f-text`, …), so a block can match every style, light or dark.

## Board files

A board is `NAME.pinwand.json` in your workspace folder, with pictures and PDFs in `assets/` (named by their content) and backups in `backups/`. The file is the `objects` / `links` structure above plus `name`, `view` and `settings`. Review progress lives on the cards: `box` (0–5), `due` (ms timestamp), `reps`, `lap`.
