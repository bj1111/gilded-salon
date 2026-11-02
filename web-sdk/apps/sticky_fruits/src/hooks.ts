import type { Reroute } from '@sveltejs/kit';

// The whole game is one page. Stake Engine serves it from paths like /{game}/{version}/index.html,
// which the static router does not know; send every path to the single route so it never reports
// "Not found" (and never renders the error page under the canvas).
export const reroute: Reroute = () => '/';
