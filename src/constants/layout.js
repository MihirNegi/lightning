// Design resolution. Blits auto-scales these to the actual screen size.
export const STAGE_W = 1920
export const STAGE_H = 1080

// Top navigation bar
export const NAVBAR_HEIGHT = 130

// Horizontal padding for content rails and hero copy
export const CONTENT_PADDING_X = 64

// Poster card dimensions and spacing between cards
export const CARD_W = 260
export const CARD_H = 390
export const CARD_GAP = 28

// Rail (a horizontal row of cards) dimensions
export const RAIL_TITLE_HEIGHT = 76
export const RAIL_GAP = 40
export const RAIL_HEIGHT = RAIL_TITLE_HEIGHT + CARD_H + RAIL_GAP

// Hero banner at the top of each page
export const HERO_HEIGHT = 880

// Visible width available for a rail's cards, after subtracting side padding
export const RAIL_VISIBLE_WIDTH = STAGE_W - CONTENT_PADDING_X * 2
