/**
 * Congratulation messages shown after a student's fund is recorded.
 * Three tiers by how much of the fee is paid. Each tier has several messages and
 * the next one picked is never the same as the last, so neighbours in a queue
 * hear something different.
 */

const FULL = [
  '{name} has paid in full. EPOCH 2026 just got closer. Thank you!',
  'Fee complete! {name} is officially all set for EPOCH.',
  'Full contribution from {name}. That is how a great event gets built.',
  'Boom! {name} cleared the whole fee. Take a bow.',
  '{name} is all paid up. See you at the front row!',
  'One more full house: {name} has paid ₹{amount}. Cheers!',
  'Paid in full by {name}. Thank you for making EPOCH happen.',
];

const MOST = [
  'Great going, {name}! Over halfway there with ₹{amount} in.',
  '{name} is past the halfway mark. Nearly done!',
  'Strong contribution from {name}: ₹{amount}. Just a little left.',
  'Thank you, {name}! The finish line is in sight.',
  '₹{amount} from {name}. A big step towards EPOCH.',
];

const SOME = [
  'Thanks, {name}! Every rupee counts. ₹{amount} recorded.',
  'First step done, {name}. The rest can follow when ready.',
  '{name} has started the journey with ₹{amount}. Welcome aboard!',
  'Nice start, {name}! ₹{amount} is in.',
  'Contribution noted from {name}. Thank you!',
];

let lastMessage = '';

function pick(pool: string[]): string {
  const options = pool.filter((message) => message !== lastMessage);
  const message = options[Math.floor(Math.random() * options.length)] ?? pool[0];
  lastMessage = message;
  return message;
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || 'friend';
}

/** Returns null when nothing has been paid, so a zero entry does not get a cheer. */
export function congratulation(name: string, paid: number, due: number): string | null {
  if (!(paid > 0)) return null;
  const pool = due > 0 && paid >= due ? FULL : due > 0 && paid / due >= 0.5 ? MOST : SOME;
  return pick(pool)
    .replaceAll('{name}', firstName(name))
    .replaceAll('{amount}', Math.round(paid).toLocaleString('en-IN'));
}
