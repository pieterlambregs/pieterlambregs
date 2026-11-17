/**
 * Motion tokens, shared by every animated component. They mirror the CSS
 * custom properties --ease-out and --ease-in-out in globals.css.
 */

/** Arrivals: fast start, long settle. Reveals, hovers, list items. */
export const EASE_OUT = [0.16, 1, 0.3, 1] as const;

/** Wipes and curtains: page transition, mobile menu, nav hide. */
export const EASE_IN_OUT = [0.76, 0, 0.24, 1] as const;
