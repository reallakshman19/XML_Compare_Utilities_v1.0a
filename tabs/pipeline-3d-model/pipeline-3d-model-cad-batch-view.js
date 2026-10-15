export function drawPipelineCadSelectionNode(graph, context, node, options = {}) {
  const point = graph.worldToScreen(node);
  const selected = graph.isSelected?.(node.id) === true;
  const primary = options.primaryId === node.id;
  context.beginPath(); context.arc(point.x, point.y, selected ? 8 : 6, 0, Math.PI * 2);
  context.fillStyle = options.fill || '#f8fafc';
  context.strokeStyle = primary ? '#ffffff' : selected ? '#22d3ee' : '#0f172a';
  context.lineWidth = selected ? 2.5 : 2; context.fill(); context.stroke();
  options.drawGrip?.(context, point, node);
  context.fillStyle = options.labelColor || '#cbd5e1';
  context.font = options.font || '11px monospace'; context.textAlign = 'center';
  context.fillText(options.label || '', point.x, point.y + (Number(options.labelOffsetY) || 0));
  return point;
}

export function drawPipelineCadMarkerRail(graph, context, marker) {
  const top = graph.worldToScreen(marker);
  const bottom = graph.worldToScreen({ x: marker.x, y: graph.bounds.minY });
  context.save(); context.setLineDash([4, 4]); context.beginPath();
  context.moveTo(top.x, top.y); context.lineTo(bottom.x, bottom.y);
  context.strokeStyle = '#94a3b8'; context.stroke(); context.restore();
  return top;
}
