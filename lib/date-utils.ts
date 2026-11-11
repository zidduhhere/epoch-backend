/**
 * Deterministic date and time formatting utilities.
 * Ensures identical string output during Server-Side Rendering (Node.js)
 * and Client-Side Hydration (Browser) to prevent React hydration mismatches.
 */

export function formatTimeIST(isoString?: string): string {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '';
  
  // Format in IST (+05:30) deterministically with regular ASCII spaces
  const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
  const ist = new Date(utc + (3600000 * 5.5));
  let hours = ist.getHours();
  const minutes = ist.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'pm' : 'am';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const hoursStr = hours.toString().padStart(2, '0');
  return `${hoursStr}:${minutes} ${ampm}`;
}

export function formatDateTimeIST(isoString?: string): string {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '';
  
  // Format in IST (+05:30) deterministically with regular ASCII spaces
  const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
  const ist = new Date(utc + (3600000 * 5.5));
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[ist.getMonth()];
  const day = ist.getDate();
  let hours = ist.getHours();
  const minutes = ist.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'pm' : 'am';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const hoursStr = hours.toString().padStart(2, '0');
  return `${month} ${day}, ${hoursStr}:${minutes} ${ampm}`;
}

