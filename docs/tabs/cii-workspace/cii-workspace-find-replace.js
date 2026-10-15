/*
 * CII Find & Replace v14 panel markup.
 *
 * Direct file overwrite authority is intentionally absent. A qualified
 * TARGET1 must pass an explicit Apply-to-new-copy gate before export.
 */

export function createFindReplaceAction() {
  return Object.freeze({
    id: 'cii-find-replace',
    label: 'Find & Replace',
    icon: '↔',
    version: 'v14',
    action: 'open',
  });
}

export function renderFindReplacePanel() {
  return `
    <section class="ciifr-workspace" data-ciifr-workspace>
      <header class="ciifr-header">
        <div>
          <h2><span aria-hidden="true">↔</span> CII Find &amp; Replace <small>V14</small></h2>
          <p>Editable Preview table with Excel copy/paste, diagnostics, approval and TARGET0 validation.</p>
        </div>
        <button type="button" data-ciifr-close>Close</button>
      </header>

      <main class="ciifr-main">
        <section class="ciifr-intake-grid">
          <article class="ciifr-card">
            <h3>1. Target CII v14</h3>
            <label>Target file
              <input type="file" accept=".cii,text/plain" data-ciifr-target>
            </label>
            <p data-ciifr-target-meta>No target loaded.</p>
          </article>

          <article class="ciifr-card">
            <h3>2. Scope and CSV</h3>
            <fieldset class="ciifr-scope">
              <legend>Replacement scope</legend>
              <label><input type="radio" name="ciifr-scope" value="DOCUMENT" checked data-ciifr-scope> Entire document</label>
              <label><input type="radio" name="ciifr-scope" value="ELEMENT" data-ciifr-scope> Element basis</label>
              <label><input type="radio" name="ciifr-scope" value="BLOCK" data-ciifr-scope> Block basis</label>
            </fieldset>
            <p><strong>Supported block scopes:</strong> Node Name and Displacement.</p>
            <label>CSV file <span tabindex="0" role="img" aria-label="Expected CSV headings and sample data" title="Expected CSV headings and sample data&#10;&#10;DOCUMENT&#10;FindText,ReplaceText&#10;PS02500.1,/SL-101.6&#10;&#10;ELEMENT&#10;From,To,FindText,ReplaceText&#10;100,110,OLD_TEXT,NEW_TEXT&#10;&#10;BLOCK&#10;From,To,Block,FindText,ReplaceText&#10;100,110,NODENAME,PS02500.1,/SL-101.6&#10;&#10;Headings are matched case-insensitively.">ⓘ</span>
              <input type="file" accept=".csv,text/csv" data-ciifr-csv>
            </label>
            <p data-ciifr-csv-meta>No CSV loaded. Paste Find / Replace columns directly into the editor below.</p>
          </article>
        </section>

        <section class="ciifr-card ciifr-manual">
          <div class="ciifr-section-head">
            <div>
              <h3>3. Find &amp; Replace Editor / Preview</h3>
              <p>Preview is the editor. Type directly or paste a rectangular range copied from Microsoft Excel. Find and Replace are always the first two editable columns. Enter logical values only — recognized fixed-width CII fields are padded and serialized automatically.</p>
            </div>
            <div class="ciifr-actions">
              <button type="button" data-ciifr-add-row>+ Row</button>
              <button type="button" data-ciifr-clear-grid>Clear</button>
              <button type="button" data-ciifr-copy-grid>Copy Find / Replace</button>
              <button type="button" data-ciifr-approve-all disabled>Approve all reviewable</button>
              <button type="button" data-ciifr-reset disabled>Reset decisions</button>
            </div>
          </div>

          <div class="ciifr-sheet-wrap" role="region" aria-label="Editable Find and Replace Preview spreadsheet" tabindex="0">
            <table class="ciifr-sheet" data-ciifr-editor-grid>
              <thead>
                <tr>
                  <th class="ciifr-sheet-row-number" aria-label="Row number">#</th>
                  <th>Find</th>
                  <th>Replace</th>
                  <th data-ciifr-grid-range>From</th>
                  <th data-ciifr-grid-range>To</th>
                  <th data-ciifr-grid-block>Block</th>
                  <th>Source</th>
                  <th>Status / effective value</th>
                  <th>Log</th>
                  <th>Decision</th>
                  <th aria-label="Row action"></th>
                </tr>
              </thead>
              <tbody data-ciifr-preview-body></tbody>
            </table>
          </div>
          <p class="ciifr-sheet-hint">Excel paste: copy Find and Replace columns, click the first Find cell, then paste. Do not add Fortran padding spaces; qualified Node Name and numeric CII fields are serialized automatically. Ambiguous logical values must be narrowed with Element/Block scope. Tab moves across cells; Enter moves to the same column on the next row. Long batches remain inside this fixed-height table with a dedicated vertical scrollbar. Slash-list replacements use only the first token, for example “/SL-104.8, /X6” → “SL-104.8”.</p>

          <details class="ciifr-target1-preview" open>
            <summary>Conflict, duplicate &amp; validation log — <span data-ciifr-diagnostic-summary>0 errors</span></summary>
            <div class="ciifr-table-wrap">
              <table class="ciifr-table" aria-label="Find and Replace diagnostic log">
                <thead><tr><th>Severity</th><th>Code</th><th>Rows</th><th>Detail</th></tr></thead>
                <tbody data-ciifr-diagnostic-log><tr><td colspan="4">No diagnostics yet.</td></tr></tbody>
              </table>
            </div>
          </details>
        </section>

        <section class="ciifr-card ciifr-finalize">
          <div class="ciifr-finalize-head">
            <div>
              <h3>4. Validate, Apply to New Copy, and Export</h3>
              <p>Approve or reject current editor rows, validate TARGET1, explicitly release it as a new output copy, then export the replaced CII. TARGET0 is never overwritten.</p>
            </div>
            <button type="button" class="ciifr-audit-button" data-ciifr-export-audit disabled>Export Audit JSON</button>
          </div>

          <ol class="ciifr-finalize-steps" aria-label="Validate, apply, and export workflow">
            <li class="ciifr-finalize-step">
              <span class="ciifr-step-number" aria-hidden="true">1</span>
              <div class="ciifr-step-copy">
                <strong>Validate TARGET1</strong>
                <small>Build the in-memory postimage and verify every approved TARGET0-relative claim.</small>
              </div>
              <button type="button" data-ciifr-validate disabled>Validate &amp; Preview</button>
            </li>
            <li class="ciifr-finalize-step">
              <span class="ciifr-step-number" aria-hidden="true">2</span>
              <div class="ciifr-step-copy">
                <strong>Apply to New Copy</strong>
                <small>Release only the qualified TARGET1. The loaded TARGET0 file remains unchanged.</small>
              </div>
              <button type="button" data-ciifr-apply disabled title="Releases only the validated TARGET1 as a new copy">Apply to New Copy</button>
            </li>
            <li class="ciifr-finalize-step">
              <span class="ciifr-step-number" aria-hidden="true">3</span>
              <div class="ciifr-step-copy">
                <strong>Export Replaced CII</strong>
                <small>Exports only the applied, independently revalidated TARGET1 as a new .CII file. Export remains disabled until the Apply-to-new-copy release receipt is valid.</small>
              </div>
              <button type="button" data-ciifr-download disabled title="Exports only the applied, independently revalidated TARGET1">Export Replaced CII</button>
            </li>
          </ol>

          <div class="ciifr-status-panel">
            <span class="ciifr-status-label">Workflow status</span>
            <div class="ciifr-status" aria-live="polite" data-ciifr-status>Load a CII v14 target and replacement rows.</div>
          </div>

          <dl class="ciifr-kpis" aria-label="Find and Replace qualification summary">
            <div><dt>Source hash</dt><dd data-ciifr-source-hash>—</dd></div>
            <div><dt>Claims</dt><dd data-ciifr-claims>0</dd></div>
            <div><dt>Target hash</dt><dd data-ciifr-target-hash>—</dd></div>
            <div><dt>Qualification</dt><dd data-ciifr-qualification>—</dd></div>
          </dl>

          <details class="ciifr-target1-preview">
            <summary>Qualified TARGET1 preview</summary>
            <p class="ciifr-target1-help">Available only after successful Validate &amp; Preview.</p>
            <pre class="ciifr-postimage" data-ciifr-postimage-preview>No qualified postimage yet.</pre>
          </details>
        </section>
      </main>
    </section>
  `;
}
