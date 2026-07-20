// Horizontal scroll offset that pins the focused card to the leftmost visible slot.
// Always pins index 0 at x=0, even for the last card (leaves blank space to the right).
export function getRailScrollOffset(index, cardWidth, gap) {
  return Math.max(index * (cardWidth + gap), 0)
}

// Extra breathing room between the fixed navbar and a scrolled-to rail's title.
const NAVBAR_GAP = 24

// Vertical scroll offset for the page content stack based on which section (hero or rail)
// currently has focus. Rails are scrolled to sit just below the fixed navbar overlay.
export function getPageScrollOffset(sectionIndex, heroHeight, railHeight, navbarHeight) {
  if (sectionIndex === 0) return 0
  return heroHeight + (sectionIndex - 1) * railHeight - navbarHeight - NAVBAR_GAP
}
