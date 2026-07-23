// Horizontal scroll offset that puts the focused card at the fixed "focus
// slot" — the position the global focus frame in PageContainer sits at.
// peekFraction is how much of the previous card should remain visible on
// the left, expressed as a fraction of a card width (0..1 typical).
//
// This value is NOT clamped at zero: for the very first card (F=0) the
// return value is negative, which shifts the track right so card 0 lands
// at the same clip-x as any later focused card. The result is that the
// focus frame in PageContainer stays at ONE screen position for every
// card in every rail — cards slide horizontally under it, rails slide
// vertically under it, and the frame itself never moves. The empty peek
// zone that appears to the LEFT of card 0 (since there is no card -1 to
// peek at) is the natural "start of rail" indicator.
//
//   peekFraction = 0    => focused card at leftmost slot (Rust model,
//                          cutoff on the right only, no peek on left)
//   peekFraction = 0.4  => ~40% of the previous card sliced by the left
//                          edge (JioTV / Prime Video pattern)
//   peekFraction = 1    => a full previous card visible (reads as
//                          padding rather than a cutout)
export function getRailScrollOffset(index, cardWidth, gap, peekFraction = 0.4) {
  const step = cardWidth + gap
  return (index - peekFraction) * step
}
