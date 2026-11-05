# pinwand · plan

Say **go** in the chat (attach the latest `pinwand-app.zip` and `pinwand-tests.zip` if the chat says the files are gone).

## Done in part 2 (versions 8 and 9)
- **Drawing**: Draw (B) — pen, highlighter (Shift+B), eraser (E), rectangle / ellipse / line / arrow (S), text (X); colours, three widths, filled, dashed; text inside boxes (double-click); line ends can be dragged; drawings on a picture move with it; Ctrl+Z covers everything
- **Marks on PDF pages**: pen, highlighter and eraser on pages in the reader and on the board; select text → colour to highlight; marks belong to the PDF (`marks/<pdf>.json` in the workspace), show wherever it is open and travel in `.pinwand` files; "marked" list under the chapters
- **Arrow styles**: curved / straight, heads at the end / both / none, turn around, dashed, three widths, colours; click an arrow again to write its label in place
- **Lecture page** (Insert): frame + Definitions / Map / Questions / Notes headings with first cards
- **Board beside the PDF** (⇆ in the reader): read on the right, collect on the left
- **Start page**: what is due today per lecture and heading, one click starts that review
- **Anki export** (File): tab-separated text with formulas for MathJax and section tags
- **Find and replace** (Ctrl+H), search narrowed to definitions / questions / notes / map / tables / PDF pages
- **Backups** with a preview: what comes back, what would go, what changed
- **Print or save a section as PDF** (Ctrl+P)

## Done in part 3 (version 10)
- **Stylus**: a pen always writes (thicker when pressed harder), its eraser end erases, the hand resting on the screen is ignored, finger and mouse select and move; switch in the Draw menu
- **Arrows snap to items**: a line or arrow drawn (or its end dragged) from one item to another becomes a connection that follows both; the items light up while drawing
- **Big boards**: items far off screen are not painted, the board layer stays on the graphics card while panning and zooming (1000 items: smooth)
- **Reader side panel** (☰ / I): chapters, pages as small pictures with a dot where something is marked, marked list with colour filters

## Done in version 11 (check of bugs and workflows)
- **PDF window on the board works like pdfgrid**: resizable by its corner, pages scroll inside (wheel once selected), Shift+1…6 columns, + − 0 zoom, ← → PgUp PgDn pages, S one page / G all pages, Enter → reader; older boards are converted
- **Reader** understands the pdfgrid keys too: Shift+1…6, S / G, Ctrl+G, Ctrl+Shift+C, O, W, T
- Fixed: new items appeared under older ones; double-click inside a frame edited the frame title instead of making a note; Ctrl+C on selected PDF text copied the PDF item; Backspace with selected PDF text deleted the window; quick pen taps made notes; cards made while reading landed on top of other items; cards made before "→ board" had no page marks
- Double-click inside a drawn box writes into the box; an empty text box disappears; with the board beside the PDF a new card opens for writing at once

## Done in version 12 (safety, real material, German keyboard)
- Saving never overwrites changes made in another window or on another computer: this window continues in a copy; the same board in two windows is announced in both
- A red bar when saving fails, with "try again" (asks for the folder permission again)
- Boards from a newer pinwand open read-only (protects them from older copies); boards remember which version saved them
- Daily copy of all PDF marks, File > Restore the marks on PDFs…
- Workspace… copies everything to the new place; start page warns when boards live only in the browser, and when another pinwand copy is installed on the same address (PinCanvas)
- Real material: the old lecture board (434 items) and Strogatz ch. 2–3 work; a 520-page book opens in about half a second; searching shows progress, the text is read in the background and kept, so later searches take a fraction of a second; far page jumps go straight there
- German keyboard: AltGr keys ([ ] switch tabs), Shift+0, Shift+7 (/)
- The tests are in `pinwand-tests.zip` (not uploaded; run: `python pinwand-tests/run_all.py`)

## Next: learning itself
Smarter spacing (FSRS, like Anki), a short daily routine, mixing lectures, an exam mode, an overview of weak topics — never solving exercises.

## Ideas for later
1. Lasso selection for drawings; group / ungroup.
2. Handwriting → text (needs an online service or a big model; maybe not).
3. Shared boards (needs a server; maybe not).
4. A real test on a Windows touch screen with a pen; tell me what feels wrong.

## How to keep the work safe between sessions
- The source is in `pinwand-app.zip` (latest version) and on GitHub in `Softwall-read/pinwand-app/pinwand`.
- Raise `CACHE` in `sw.js` with every release (now `pinwand-v12`).
