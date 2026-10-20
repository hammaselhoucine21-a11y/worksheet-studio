# Worksheet Studio

A simple photo editor for teachers' worksheets. Open a worksheet picture (from Pinterest, a screenshot, a photo) and change the picture itself:

| Tool | What it does |
|---|---|
| **Crop** | Cut off edges. Free, Square, A4 tall or A4 wide. |
| **Clean up → Magic eraser** | Paint over something (a title, a logo, an answer) and press **Erase**. The AI fills it in so it looks like it was never there. |
| **Clean up → Paint brush** | Paint over things with white, black, or a colour picked from the photo. |
| **Select & Move** | Draw a box around any part (one clock, a picture). Then **Cut out & move**, **Copy** or **Erase** it. Pieces can be dragged, resized, turned, copied or deleted, and can have their white background made see-through. |
| **Text** | Add big, clear text in 3 child-friendly fonts and 7 colours. |
| **Stickers** | Empty clock, time box, answer lines, shapes, arrows and emoji, or your own picture. |
| **Print / Save** | Print on A4, save as PDF, or save as a picture. |

Undo/Redo are always at the top, and work is saved automatically on the computer. Everything runs on the computer itself: free, private, and no account needed.

## Install on a new Windows PC (free)

1. Get the app:
   - **Easiest:** on the GitHub page, click **Code → Download ZIP**, then right-click the ZIP and choose **Extract All**, for example to `Documents\worksheet-studio`.
   - Or, with Git: `git clone https://github.com/hammaselhoucine21-a11y/worksheet-studio.git`
2. Open the folder and double-click **`install.bat`**.
   - If Node.js is missing, it installs it, then asks you to run `install.bat` again.
   - It downloads the magic-eraser AI model once (about 200 MB), builds the app, and puts a **Worksheet Studio** icon on the Desktop.
3. Double-click **Worksheet Studio** on the Desktop. The app opens in its own window.

Later updates: double-click **`update.bat`** (needs Git), or download the ZIP again and re-run `install.bat`.

## Use it online (any computer, iPhone, iPad): no install

Open **https://hammaselhoucine21-a11y.github.io/worksheet-studio/** in Safari, Chrome or Edge.

- **iPhone / iPad:** open the link in **Safari**, tap **Share** (the square with the arrow), then **Add to Home Screen**. It gets its own icon and opens full screen like an app.
- The magic-eraser AI downloads once (about 200 MB, Wi-Fi recommended) the first time you press **Erase**, and is kept after that.
- On older iPhones the AI may be too big to run. The app then uses the quick fill, which works well on plain white paper. iPads and newer iPhones handle it better.
- Your pictures never leave the device: all editing happens on the phone or computer itself.

## Install on a Mac (free)

Works on macOS 11 Big Sur or newer (Intel and Apple Silicon). On older Macs, use the website above.

1. On the GitHub page, click **Code → Download ZIP**, then double-click the ZIP to unpack it (for example into **Documents**).
2. Open the folder, **right-click `install.command` → Open**, then click **Open** again.
   (The first time, macOS asks because the file came from the internet. If it still refuses, open **Terminal**, type `bash ` (with a space), drag `install.command` into the window, and press Return.)
   - If Node.js is missing, it downloads the installer. Finish it, then run `install.command` again.
   - It downloads the AI model, builds the app, and adds **Worksheet Studio** to **Applications** (in your home folder) and the Desktop.
3. Double-click **Worksheet Studio**. It opens in Chrome's app window if Chrome is installed, otherwise in Safari.

Updates: double-click **`update.command`**.

## Tips for the magic eraser

- Erasing takes about 15–30 seconds on a normal PC; a spinner shows while it works.
- Paint a little past the edges of what you want removed.
- To remove a big rectangle (like a title), use **Select & Move → draw a box → Erase it**.
- If the AI can't start, the app uses a quick fill instead. It works best on plain white paper.

## For developers

```bash
npm install
npm run get-model   # downloads public/models/lama_fp32.onnx (gitignored)
npm run dev         # http://localhost:5173
npm test            # unit tests (vitest)
npm run build && npm run serve   # production build on http://localhost:4321
```

- React + TypeScript + Vite. Konva (react-konva) handles the canvas, layers and handles.
- The magic eraser is [LaMa](https://github.com/advimman/lama) (Apache-2.0), using the ONNX export by [Carve](https://huggingface.co/Carve/LaMa-ONNX). It runs in a Web Worker with `onnxruntime-web`. Only the area around the brushed marks is sent through the model (512×512), and the result is blended back.
- If the model is not installed locally, it downloads once from Hugging Face and is kept in the browser cache.
- Projects are stored in IndexedDB. The app is also an installable PWA, so it can be hosted and used on a phone.
- Design rules are in [DESIGN.md](DESIGN.md).

Source layout:

```
src/
  components/  Home, Editor (tools and panels), EditorCanvas (Konva stage), Icons
  lib/         history (undo), geometry, fill (pixel maths), raster (canvas ops),
               lama (AI client), export (PDF/print/PNG), storage (IndexedDB), stickers
  workers/     lama.worker.ts (onnxruntime-web)
scripts/       get-model.mjs, serve.mjs, make-shortcut.ps1
install.bat / install.command   Windows / Mac installers
.github/workflows/pages.yml     publishes the website on every push to main
```
