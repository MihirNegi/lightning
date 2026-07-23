// Design resolution. Blits auto-scales these to the actual screen size.
export const STAGE_W = 1920
export const STAGE_H = 1080

// Top navigation bar
export const NAVBAR_HEIGHT = 130

// Horizontal padding for content rails and hero copy
export const CONTENT_PADDING_X = 64

// Poster card dimensions per orientation. Portrait is the historical default
// (tall book-cover style); landscape is roughly 16:9 for wider thumbnails
// like sports highlights or trailers. Each rail picks one orientation for
// all its cards — rails never mix.
export const CARD_W_PORTRAIT = 260
export const CARD_H_PORTRAIT = 310
export const CARD_W_LANDSCAPE = 460
export const CARD_H_LANDSCAPE = 260

// Default aliases used by any code that doesn't distinguish orientation.
export const CARD_W = CARD_W_PORTRAIT
export const CARD_H = CARD_H_PORTRAIT

export const CARD_GAP = 28

// Rail (a horizontal row of cards) dimensions. Rail height is title +
// tallest card + gap; since portrait cards are taller than landscape,
// portrait rails are taller. PageContainer sums per-rail heights so the
// vertical scroll math works with any mix of orientations.
export const RAIL_TITLE_HEIGHT = 76
export const RAIL_GAP = 24
export const RAIL_HEIGHT_PORTRAIT = RAIL_TITLE_HEIGHT + CARD_H_PORTRAIT + RAIL_GAP
export const RAIL_HEIGHT_LANDSCAPE = RAIL_TITLE_HEIGHT + CARD_H_LANDSCAPE + RAIL_GAP
export const RAIL_HEIGHT = RAIL_HEIGHT_PORTRAIT

// Hero banner at the top of each page
export const HERO_HEIGHT = 880

// Visible width available for a rail's cards. Only the left side has an
// explicit CONTENT_PADDING_X gap (where the rail title sits); the right
// edge runs all the way to the screen boundary so trailing cards get cut
// off there rather than fading out inside a right-side padding block. This
// matches the Rust reference — cards flow to the visible edge of the
// canvas — and gives the "there is more content beyond this" cue that a
// centred/padded rail cannot.
export const RAIL_VISIBLE_WIDTH = STAGE_W - CONTENT_PADDING_X

// Extra breathing room between the fixed navbar and the topmost visible
// content when the hero is absent. Matches the NAVBAR_GAP used by the
// scroll helper so the first rail on a heroless page sits in the same
// place as any other scrolled-to rail.
export const NAVBAR_TOP_GAP = 24

// Resolve card + rail dimensions from an orientation string. Central
// lookup so components, image sizing and scroll math all agree.
export function cardDimsFor(orientation) {
  if (orientation === 'landscape') {
    return {
      cardW: CARD_W_LANDSCAPE,
      cardH: CARD_H_LANDSCAPE,
      railH: RAIL_HEIGHT_LANDSCAPE,
    }
  }
  return {
    cardW: CARD_W_PORTRAIT,
    cardH: CARD_H_PORTRAIT,
    railH: RAIL_HEIGHT_PORTRAIT,
  }
}
