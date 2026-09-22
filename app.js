// TTB Alcohol Label Verification Prototype
// Client-side OCR + rule-based + fuzzy matching

const GOVERNMENT_WARNING_EXACT = `GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.`;

// Normalize text for comparison
function normalize(text) {
  if (!text) return '';
  return text
    .toUpperCase()
    .replace(/[’']/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

// Simple fuzzy match using Levenshtein-like ratio via Fuse or manual
function similarity(a, b) {
  a = normalize(a);
  b = normalize(b);
  if (!a || !b) return 0;
  if (a === b) return 100;
  // Basic contains check for partial matches
  if (a.includes(b) || b.includes(a)) return 85;
  // Character overlap approximation
  let matches = 0;
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;
  for (let char of shorter) {
    if (longer.includes(char)) matches++;
  }
  return Math.round((matches / longer.length) * 100);
}

function extractABV(text) {
  // Look for patterns like 45% Alc./Vol., 40% ABV, 90 Proof, etc.
  const patterns = [
    /(\d+(?:\.\d+)?)\s*%\s*(?:ALC\.?\/?VOL\.?|ABV|ALCOHOL)/i,
    /(\d+(?:\.\d+)?)\s*%\s*ALCOHOL/i,
    /(\d+)\s*PROOF/i,
    /(\d+(?:\.\d+)?)\s*%/
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[0];
  }
  return null;
}

function extractNetContents(text) {
  const patterns = [
    /(\d+(?:\.\d+)?)\s*(mL|ML|ml|L|l|FL\.?\s*OZ\.?|oz)/i,
    /(\d+)\s*(MILLILITERS|LITERS)/i
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[0];
  }
  return null;
}

function checkGovernmentWarning(ocrText, customWarning) {
  const normOcr = normalize(ocrText);
  const expected = customWarning && customWarning.trim() 
    ? customWarning.trim() 
    : GOVERNMENT_WARNING_EXACT;
  const normWarning = normalize(expected);
  const usingCustom = !!(customWarning && customWarning.trim());

  // Exact or near-exact
  if (normOcr.includes(normWarning)) {
    return { 
      pass: true, 
      detail: usingCustom 
        ? 'Exact match to the text you entered' 
        : 'Exact match to official required text' 
    };
  }

  // Fuzzy / partial score
  const score = similarity(ocrText, expected);
  if (score >= 85) {
    return { 
      pass: true, 
      detail: usingCustom 
        ? `Strong match to your text (score ${score})` 
        : `Strong match to official text (score ${score})` 
    };
  }

  // Fallback: check for the three critical legal elements (only when using official text)
  if (!usingCustom) {
    const hasHeader = /GOVERNMENT\s+WARNING/.test(normOcr);
    const hasPregnancy = /SURGEON\s+GENERAL.*PREGNANCY.*BIRTH\s+DEFECTS/.test(normOcr);
    const hasDriving = /IMPAIRS.*DRIVE.*CAR|OPERATE\s+MACHINERY/.test(normOcr);

    if (hasHeader && hasPregnancy && hasDriving) {
      return { 
        pass: true, 
        detail: 'All required warning elements present (minor formatting differences possible)' 
      };
    }

    if (hasHeader) {
      return { 
        pass: false, 
        detail: 'GOVERNMENT WARNING header found but full required text is incomplete or altered' 
      };
    }
  }

  return { 
    pass: false, 
    detail: usingCustom 
      ? `Does not match the text you entered (score ${score}). Check the OCR text below.` 
      : 'Required Government Warning statement not detected' 
  };
}

function checkBrand(ocrText, expected) {
  if (!expected) return { pass: null, detail: 'No brand provided' };
  const score = similarity(ocrText, expected);
  // Also search for the brand tokens
  const tokens = normalize(expected).split(/\s+/).filter(t => t.length > 2);
  const foundTokens = tokens.filter(t => normalize(ocrText).includes(t));
  const tokenScore = tokens.length ? (foundTokens.length / tokens.length) * 100 : 0;
  const final = Math.max(score, tokenScore);

  if (final >= 80) {
    return { pass: true, detail: `Strong match (score ${Math.round(final)})` };
  }
  if (final >= 55) {
    return { pass: true, detail: `Acceptable match with possible casing/punctuation difference (score ${Math.round(final)}) — agent judgment recommended` };
  }
  return { pass: false, detail: `Low match (score ${Math.round(final)}). Expected: "${expected}"` };
}

function checkField(ocrText, expected, fieldName, extractor) {
  if (!expected) return { pass: null, detail: 'Not provided in application' };
  const extracted = extractor ? extractor(ocrText) : null;
  const score = similarity(ocrText, expected);
  if (extracted && similarity(extracted, expected) >= 70) {
    return { pass: true, detail: `Found: "${extracted}"` };
  }
  if (score >= 70) {
    return { pass: true, detail: `Match found in text` };
  }
  return { pass: false, detail: `Not clearly matched. Expected: "${expected}"` };
}

// Global state
let uploadedFiles = [];

const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('label-images');
const previewContainer = document.getElementById('preview-container');
const verifyBtn = document.getElementById('verify-btn');
const form = document.getElementById('app-form');
const resultsSection = document.getElementById('results-section');
const processing = document.getElementById('processing');
const resultsContent = document.getElementById('results-content');
const statusBar = document.getElementById('status-bar');

// Drag & drop
['dragenter', 'dragover'].forEach(evt => {
  dropZone.addEventListener(evt, e => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });
});
['dragleave', 'drop'].forEach(evt => {
  dropZone.addEventListener(evt, e => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
  });
});
dropZone.addEventListener('drop', e => {
  handleFiles(e.dataTransfer.files);
});

fileInput.addEventListener('change', e => {
  handleFiles(e.target.files);
});

function handleFiles(files) {
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    uploadedFiles.push(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const div = document.createElement('div');
      div.className = 'preview-item';
      div.innerHTML = `
        <img src="${ev.target.result}" alt="preview">
        <button class="remove" data-idx="${uploadedFiles.length - 1}">×</button>
      `;
      previewContainer.appendChild(div);
      div.querySelector('.remove').addEventListener('click', () => {
        const idx = parseInt(div.querySelector('.remove').dataset.idx);
        uploadedFiles.splice(idx, 1);
        div.remove();
        updateVerifyButton();
      });
    };
    reader.readAsDataURL(file);
  }
  updateVerifyButton();
}

function updateVerifyButton() {
  verifyBtn.disabled = uploadedFiles.length === 0;
}

const SAMPLE_DATA = {
  oldtom: {
    brand: 'OLD TOM DISTILLERY',
    classType: 'Kentucky Straight Bourbon Whiskey',
    abv: '45% Alc./Vol. (90 Proof)',
    netContents: '750 mL',
    producer: 'Old Tom Distillery, Kentucky'
  },
  weller: {
    brand: 'W.L. WELLER',
    classType: 'Kentucky Straight Bourbon Whiskey',
    abv: '53.5% Alc./Vol. (107 Proof)',
    netContents: '750 mL',
    producer: 'Buffalo Trace Distillery, Kentucky'
  },
  jack: {
    brand: "JACK DANIEL'S",
    classType: 'Tennessee Whiskey',
    abv: '40% Alc./Vol. (80 Proof)',
    netContents: '750 mL',
    producer: "Jack Daniel Distillery, Lynchburg, Tennessee"
  },
  buffalo: {
    brand: 'BUFFALO TRACE',
    classType: 'Kentucky Straight Bourbon Whiskey',
    abv: '45% Alc./Vol. (90 Proof)',
    netContents: '750 mL',
    producer: 'Buffalo Trace Distillery, Frankfort, Kentucky'
  },
  makers: {
    brand: "MAKER'S MARK",
    classType: 'Kentucky Straight Bourbon Whiskey',
    abv: '45% Alc./Vol. (90 Proof)',
    netContents: '750 mL',
    producer: "Maker's Mark Distillery, Loretto, Kentucky"
  },
  woodford: {
    brand: 'WOODFORD RESERVE',
    classType: 'Kentucky Straight Bourbon Whiskey',
    abv: '45.2% Alc./Vol. (90.4 Proof)',
    netContents: '750 mL',
    producer: 'Woodford Reserve Distillery, Versailles, Kentucky'
  },
  patron: {
    brand: 'PATRÓN',
    classType: 'Tequila',
    abv: '40% Alc./Vol. (80 Proof)',
    netContents: '750 mL',
    producer: 'Patrón Spirits Company, Mexico'
  },
  casamigos: {
    brand: 'CASAMIGOS',
    classType: 'Tequila Blanco',
    abv: '40% Alc./Vol. (80 Proof)',
    netContents: '750 mL',
    producer: 'Casamigos Tequila, Mexico'
  },
  donjulio: {
    brand: 'DON JULIO',
    classType: 'Tequila Añejo',
    abv: '40% Alc./Vol. (80 Proof)',
    netContents: '750 mL',
    producer: 'Don Julio, Mexico'
  },
  macallan: {
    brand: 'THE MACALLAN',
    classType: 'Single Malt Scotch Whisky',
    abv: '40% Alc./Vol. (80 Proof)',
    netContents: '750 mL',
    producer: 'The Macallan Distillery, Speyside, Scotland'
  },
  johnnie: {
    brand: 'JOHNNIE WALKER',
    classType: 'Blended Scotch Whisky',
    abv: '40% Alc./Vol. (80 Proof)',
    netContents: '750 mL',
    producer: 'John Walker & Sons, Scotland'
  },
  glenfiddich: {
    brand: 'GLENFIDDICH',
    classType: 'Single Malt Scotch Whisky',
    abv: '40% Alc./Vol. (80 Proof)',
    netContents: '750 mL',
    producer: 'William Grant & Sons, Dufftown, Scotland'
  },
  lagavulin: {
    brand: 'LAGAVULIN',
    classType: 'Single Malt Scotch Whisky',
    abv: '43% Alc./Vol. (86 Proof)',
    netContents: '750 mL',
    producer: 'Lagavulin Distillery, Islay, Scotland'
  }
};

document.getElementById('load-sample').addEventListener('click', () => {
  const key = document.getElementById('sample-select').value;
  if (!key || !SAMPLE_DATA[key]) {
    alert('Please select a sample from the dropdown first.');
    return;
  }
  const s = SAMPLE_DATA[key];
  document.getElementById('brand').value = s.brand;
  document.getElementById('class-type').value = s.classType;
  document.getElementById('abv').value = s.abv;
  document.getElementById('net-contents').value = s.netContents;
  document.getElementById('producer').value = s.producer;
  // Leave Government Warning empty so the official text is used by default
  document.getElementById('gov-warning').value = '';
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (uploadedFiles.length === 0) return;

  const appData = {
    brand: document.getElementById('brand').value.trim(),
    classType: document.getElementById('class-type').value.trim(),
    abv: document.getElementById('abv').value.trim(),
    netContents: document.getElementById('net-contents').value.trim(),
    producer: document.getElementById('producer').value.trim(),
    govWarning: document.getElementById('gov-warning').value.trim()
  };

  processing.classList.remove('hidden');
  resultsSection.classList.add('hidden');
  resultsContent.innerHTML = '';

  const allResults = [];

  for (let i = 0; i < uploadedFiles.length; i++) {
    const file = uploadedFiles[i];
    try {
      const { data: { text } } = await Tesseract.recognize(file, 'eng', {
        logger: m => {
          if (m.status === 'recognizing text') {
            // optional progress
          }
        }
      });

      const checks = {
        brand: checkBrand(text, appData.brand),
        classType: checkField(text, appData.classType, 'Class/Type'),
        abv: checkField(text, appData.abv, 'ABV', extractABV),
        netContents: checkField(text, appData.netContents, 'Net Contents', extractNetContents),
        warning: checkGovernmentWarning(text, appData.govWarning)
      };

      allResults.push({
        index: i + 1,
        fileName: file.name,
        ocrText: text,
        checks
      });
    } catch (err) {
      allResults.push({
        index: i + 1,
        fileName: file.name,
        error: err.message || 'OCR failed'
      });
    }
  }

  processing.classList.add('hidden');
  renderResults(allResults);
});

function renderResults(results) {
  resultsSection.classList.remove('hidden');

  let overallPass = true;
  let anyFail = false;
  let anyPartial = false;

  results.forEach(r => {
    if (r.error) {
      anyFail = true;
      overallPass = false;
      return;
    }
    Object.values(r.checks).forEach(c => {
      if (c.pass === false) {
        anyFail = true;
        overallPass = false;
      } else if (c.pass === true && c.detail.includes('judgment')) {
        anyPartial = true;
      }
    });
  });

  if (overallPass && !anyPartial) {
    statusBar.className = 'status-bar pass';
    statusBar.textContent = '✓ Overall: PASS — All critical checks matched';
  } else if (anyFail) {
    statusBar.className = 'status-bar fail';
    statusBar.textContent = '✗ Overall: ISSUES FOUND — Review required';
  } else {
    statusBar.className = 'status-bar partial';
    statusBar.textContent = '⚠ Overall: PASS WITH NOTES — Agent review recommended for borderline matches';
  }

  results.forEach(r => {
    const div = document.createElement('div');
    div.className = 'result-item';

    if (r.error) {
      div.innerHTML = `<h3>Image ${r.index}: ${r.fileName}</h3><p style="color:var(--danger)">Error: ${r.error}</p>`;
      resultsContent.appendChild(div);
      return;
    }

    let html = `<h3>Image ${r.index}: ${r.fileName}</h3>`;
    const order = [
      ['brand', 'Brand Name'],
      ['classType', 'Class / Type'],
      ['abv', 'Alcohol Content'],
      ['netContents', 'Net Contents'],
      ['warning', 'Government Warning Statement']
    ];

    order.forEach(([key, label]) => {
      const c = r.checks[key];
      if (c.pass === null) return;
      const statusClass = c.pass ? (c.detail.includes('judgment') ? 'warn' : 'pass') : 'fail';
      const statusText = c.pass ? (c.detail.includes('judgment') ? 'REVIEW' : 'PASS') : 'FAIL';
      html += `
        <div class="check-row">
          <span class="check-label">${label}</span>
          <span class="check-status ${statusClass}">${statusText}</span>
        </div>
        <div style="font-size:0.85rem;color:var(--muted);margin-bottom:4px;">${c.detail}</div>
      `;
    });

    html += `<details style="margin-top:12px;"><summary style="cursor:pointer;font-weight:600;">View extracted OCR text</summary>
      <div class="extracted-text">${escapeHtml(r.ocrText)}</div></details>`;

    div.innerHTML = html;
    resultsContent.appendChild(div);
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

document.getElementById('reset-btn').addEventListener('click', () => {
  uploadedFiles = [];
  previewContainer.innerHTML = '';
  fileInput.value = '';
  form.reset();
  resultsSection.classList.add('hidden');
  updateVerifyButton();
});
