# AI-Powered Alcohol Label Verification App

**TTB / Treasury Take-Home Prototype**

**Submitted by: Francis Hoang**

A simple, fast, browser-based prototype that helps compliance agents verify alcohol beverage labels against application data.

## Features

* **Upload one or multiple label images** (batch support)
* **Enter application fields** (Brand, Class/Type, ABV, Net Contents, Producer)
* **Optional Government Warning field** — leave blank to check against the official legal text, or paste custom text to force a comparison
* **Sample data dropdown** — quickly load matching application data for 13 pre-built sample labels (bourbon, tequila, scotch, etc.)
* **Client-side OCR** using Tesseract.js (no data leaves the browser)
* **Fuzzy matching** for brand names (handles “STONE'S THROW” vs “Stone's Throw”)
* **Exact / near-exact check** for the mandatory Government Health Warning Statement
* **ABV and Net Contents pattern extraction**
* Clean, large-button UI designed for users of all technical comfort levels
* Results in typically 2–8 seconds per image (depending on image size and device)

## Quick Start (Local)

1. Clone or download this repository.
2. Open `index.html` in a modern browser **or** serve the folder:

```bash
# Python 3
python3 -m http.server 8000

# Then open http://localhost:8000
```

3. Use the **sample dropdown** to select a brand, click **Load Selected Sample**, upload the matching sample image, and click **Verify Label(s)**.

No build step, no API keys, no backend required for the core prototype.

## Deployed Demo

Because this is a pure static site, you can deploy it instantly to:

* **GitHub Pages**
* **Netlify** (drag-and-drop the folder)
* **Vercel** (static)
* Any static file host

A live demo can be created by pushing this repo to GitHub and enabling Pages, or by uploading the core files (`index.html`, `styles.css`, `app.js`) to any static host.

## Approach \& Technical Decisions

### Why client-side only?

* Stakeholder feedback emphasized speed (< 5 seconds ideal) and simplicity.
* Government networks often block outbound ML endpoints (as noted by the IT admin).
* No PII or sensitive data is stored or transmitted — images never leave the user’s browser.
* Zero infrastructure cost and zero authentication needed for a prototype.

### OCR Choice

Tesseract.js (WebAssembly) provides reliable English text extraction without external services. It is slower on very large images but still usually under 8 seconds on modern hardware.

### Matching Logic

* **Brand name**: Fuzzy / token-based similarity with a soft threshold. Exact case-insensitive match is preferred, but common real-world variations (casing, apostrophes, punctuation) are accepted with a “REVIEW” note so the agent can apply judgment (as Dave Morrison requested).
* **Government Warning**: By default checks for the exact required wording from 27 CFR 16.21. Also verifies the presence of the three critical elements (header in all-caps style, pregnancy clause, driving/machinery clause). An optional form field lets the user paste custom warning text to force a comparison against that text instead. Formatting nuances (bold) cannot be reliably detected from a photo, so the tool focuses on textual presence and correctness.
* **ABV \& Net Contents**: Pattern extraction + fuzzy comparison against the application value.

### Assumptions \& Limitations

* Images should be reasonably clear and upright. Severe glare, extreme angles, or very low resolution will degrade OCR quality (Jenny Park’s note is acknowledged; full robust image correction is out of scope for a time-constrained prototype).
* The tool does **not** attempt to verify type size, bold weight, or exact placement of the warning — those require higher-fidelity analysis or human review.
* No integration with the real COLA system (explicitly out of scope).
* Batch processing is sequential (one OCR at a time) to keep memory usage reasonable in the browser.
* This is a **proof-of-concept**, not production software. Production would need accessibility audit, security review, FedRAMP considerations, and likely a server-side vision model for higher accuracy.

### Tools Used

* HTML / CSS / Vanilla JavaScript
* Tesseract.js v5 (OCR)
* No framework (keeps the footprint tiny and the UX snappy)

## Sample Test Data

Use the **sample dropdown** in Section 2 to load application data for any of the included labels:

|Sample|Brand|Type|
|-|-|-|
|Old Tom Distillery|OLD TOM DISTILLERY|Bourbon|
|W.L. Weller|W.L. WELLER|Bourbon|
|Jack Daniel's|JACK DANIEL'S|Tennessee Whiskey|
|Buffalo Trace|BUFFALO TRACE|Bourbon|
|Maker's Mark|MAKER'S MARK|Bourbon|
|Woodford Reserve|WOODFORD RESERVE|Bourbon|
|Patrón|PATRÓN|Tequila|
|Casamigos|CASAMIGOS|Tequila Blanco|
|Don Julio|DON JULIO|Tequila Añejo|
|The Macallan|THE MACALLAN|Single Malt Scotch|
|Johnnie Walker|JOHNNIE WALKER|Blended Scotch|
|Glenfiddich|GLENFIDDICH|Single Malt Scotch|
|Lagavulin|LAGAVULIN|Single Malt Scotch|

Matching image files are included in the project folder (e.g. `sample-weller.png`, `sample-patron.png`, etc.).

You can also generate additional test label images with any AI image tool (or photograph real bottles) containing the exact Government Warning text.

## Future Improvements (if this moves forward)

* Optional server-side vision model (GPT-4o / Claude / Grok vision) behind a government-approved endpoint for higher accuracy and image-quality tolerance.
* Pre-processing pipeline (deskew, contrast enhancement, glare reduction).
* Export of results to CSV / PDF for the agent’s records.
* Keyboard-only navigation and full WCAG compliance.
* Integration path into the existing COLA workflow (long-term).

## Evaluation Notes

A working core that prioritizes:

* Speed and simplicity for non-technical agents
* Correct handling of the Government Warning (exact text requirement)
* Fuzzy brand matching with human judgment flags
* Clean code and clear documentation of trade-offs was preferred over a more ambitious but incomplete system.

