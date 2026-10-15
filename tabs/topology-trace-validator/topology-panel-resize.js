/** Drag-gutter resize for left and right panels. Pure DOM, no topology imports. */
export function wireLeftPanelResize(root) {
  const gutter = root.querySelector('.ttv-resize-gutter-left');
  if (!gutter) return () => {};
  let dragging = false, startX = 0, startW = 0;
  const MIN = 160, MAX = 520;
  const main = root.querySelector('.ttv-main');

  const onDown = (e) => {
    dragging = true; startX = e.clientX;
    startW = parseInt(getComputedStyle(main).getPropertyValue('--ttv-left-w')) || 260;
    gutter.classList.add('is-dragging');
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  };
  const onMove = (e) => {
    if (!dragging) return;
    const w = Math.min(MAX, Math.max(MIN, startW + e.clientX - startX));
    main.style.setProperty('--ttv-left-w', `${w}px`);
    // Trigger search-result reflow: dispatch resize event
    root.querySelector('[data-ttv-search-results]')?.dispatchEvent(new Event('panelresize'));
  };
  const onUp = () => {
    dragging = false;
    gutter.classList.remove('is-dragging');
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
  };
  gutter.addEventListener('pointerdown', onDown);
  return () => gutter.removeEventListener('pointerdown', onDown);
}

export function wireBottomPanelResize(root) {
  const gutter = root.querySelector('.ttv-resize-gutter-bottom');
  if (!gutter) return () => {};
  let dragging = false, startY = 0, startH = 0;
  const MIN = 40, MAX = window.innerHeight - 200;
  const bottom = root.querySelector('.ttv-bottom');
  const main = root.querySelector('.ttv-main');

  const onDown = (e) => {
    dragging = true; startY = e.clientY;
    startH = parseInt(getComputedStyle(bottom).getPropertyValue('height')) || 200;
    gutter.classList.add('is-dragging');
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  };
  const onMove = (e) => {
    if (!dragging) return;
    const h = Math.min(MAX, Math.max(MIN, startH - (e.clientY - startY)));
    bottom.style.height = `${h}px`;
  };
  const onUp = () => {
    dragging = false;
    gutter.classList.remove('is-dragging');
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
  };
  gutter.addEventListener('pointerdown', onDown);
  return () => gutter.removeEventListener('pointerdown', onDown);
}
