// Horizontal scroll offset that pins the focused card to the leftmost visible slot.
// Always pins index 0 at x=0, even for the last card (leaves blank space to the right).
export function getRailScrollOffset(index, cardWidth, gap) {
  return Math.max(index * (cardWidth + gap), 0)
}
