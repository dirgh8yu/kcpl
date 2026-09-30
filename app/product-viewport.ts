import type { Viewport } from "next";
import { baseViewport } from "./site-document";

/* The staff workspace and the customer portal: white chrome and one light
 * theme, so the browser bar and status bar match their top bar and form
 * controls stay light; on Android the keyboard shrinks the layout instead of
 * covering pinned buttons. The public site keeps baseViewport. Zoom stays
 * enabled: fields are 16px on touch screens instead (operations-system.css). */
export const productViewport: Viewport = {
  ...baseViewport,
  themeColor: "#ffffff",
  colorScheme: "light",
  interactiveWidget: "resizes-content",
};
