// Theme bootstrap. No directive: the root layout (a Server Component) inlines THEME_INIT_SCRIPT in
// <head> so the saved theme is applied before the first paint, and client code imports the key and type.

export const THEME_STORAGE_KEY = "axoraa:theme";

export type ThemePref = "system" | "light" | "dark";

/** Runs synchronously while the HTML is parsed. Never throws. */
export const THEME_INIT_SCRIPT = `(function(){try{var d=document.documentElement;var p=null;try{p=window.localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY
)})}catch(e){}var dark=p==="dark"||(p!=="light"&&!!window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches);var t=dark?"dark":"light";d.dataset.theme=t;d.style.colorScheme=t}catch(e){}})();`;
