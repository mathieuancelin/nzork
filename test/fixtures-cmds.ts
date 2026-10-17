// Command scripts used by the differential tests (they do not need to be optimal).
export const TROLL_FIGHT = [
  'n', 'e', 'open window', 'w', 'w', 'take lamp', 'take sword', 'move rug', 'open trap door',
  'turn on lamp', 'd', 'n',
  ...Array(12).fill('kill troll with sword'),
  'e', 'e', 'se', 'e', 'n', 'w', 'look', 'inventory', 'score', 'diagnose',
  'w', 'w', 'w', 's', 'w', 'n', 'e', 'u', 'take all', 'drop all', 'wait', 'wait', 'wait',
]
