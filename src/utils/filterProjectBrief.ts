const EXCLUDED_SECTIONS = ['CABINET TYPES', 'ACCESSORIES', 'OTHER'];

export function filterProjectBriefForPDF(rawBrief: string): string {
  if (!rawBrief) return '';

  const blocks = rawBrief
    .split(/\n{2,}/)
    .filter(block => {
      const firstLine = block.trim().split('\n')[0].trim().toUpperCase().replace(/:$/, '');
      return !EXCLUDED_SECTIONS.includes(firstLine);
    });

  return blocks.join('\n\n');
}

export function renderBriefBlocksAsHTML(brief: string): string {
  if (!brief) return '';

  const blocks = brief.split(/\n{2,}/);
  const bulletItems = blocks.map(block => {
    const lines = block.trim().split('\n').filter(l => l.trim());
    if (lines.length === 0) return '';
    const headerLine = lines[0].trim();
    const colonIdx = headerLine.indexOf(':');
    const label = colonIdx !== -1 ? headerLine.substring(0, colonIdx).trim() : headerLine;
    const headerValue = colonIdx !== -1 ? headerLine.substring(colonIdx + 1).trim() : '';
    const subValues = lines.slice(1).map(l => {
      const t = l.trim();
      const ci = t.indexOf(':');
      return ci !== -1 ? t.substring(ci + 1).trim() : t;
    }).filter(v => v);
    const allValues = [headerValue, ...subValues].filter(v => v);
    const value = allValues.join(', ');
    return `<li style="margin-bottom:3px;"><strong>${label}:</strong> ${value}</li>`;
  }).filter(item => item).join('');

  if (!bulletItems) return '';

  return `
    <div class="project-details">
      <h3>Project Details</h3>
      <ul style="list-style:disc; padding-left:18px; margin:0; font-size:9pt; color:#333; line-height:1.6;">
        ${bulletItems}
      </ul>
    </div>
  `;
}
