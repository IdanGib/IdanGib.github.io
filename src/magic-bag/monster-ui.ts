interface Point { x: number; y: number }
interface MonsterTransform extends Point { scaleX: number; scaleY: number }

/** Local center of the fully open mouth, shared by proximity and swallowing. */
export function monsterMouth(monster: MonsterTransform): Point {
  return { x: monster.x, y: monster.y + 19 * monster.scaleY };
}

export function monsterDropBounds(monster: MonsterTransform) {
  const mouth = monsterMouth(monster);
  // Allow small misses around the lips for young children using touch screens.
  return {
    left: mouth.x - 110 * monster.scaleX,
    right: mouth.x + 110 * monster.scaleX,
    top: mouth.y - 85 * monster.scaleY,
    bottom: mouth.y + 85 * monster.scaleY,
  };
}

export function monsterAppetite(monster: MonsterTransform, card: Point): number {
  const mouth = monsterMouth(monster);
  const distance = Math.hypot(card.x - mouth.x, card.y - mouth.y);
  return Math.max(0, Math.min(1, (210 - distance) / 110));
}
