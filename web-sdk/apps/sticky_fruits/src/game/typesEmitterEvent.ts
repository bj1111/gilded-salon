import type { EmitterEventBoard } from '../components/Board.svelte';
import type { EmitterEventBoardFrame } from '../components/BoardFrame.svelte';
import type { EmitterEventFreeSpinIntro } from '../components/FreeSpinIntro.svelte';
import type { EmitterEventFreeSpinOutro } from '../components/FreeSpinOutro.svelte';
import type { EmitterEventWinPlaque } from '../components/WinPlaque.svelte';
import type { EmitterEventWinTakeover } from '../components/WinTakeover.svelte';
import type { EmitterEventWinLines } from '../components/WinLines.svelte';
import type { EmitterEventLanding } from '../components/LandingFx.svelte';
import type { EmitterEventCurtains } from '../components/Curtains.svelte';
import type { EmitterEventRetrigger } from '../components/RetriggerBanner.svelte';
import type { EmitterEventSound } from '../components/Sound.svelte';
import type { EmitterEventStickyWilds } from '../components/StickyWilds.svelte';
import type { EmitterEventFx } from '../fx/ParticleLayer.svelte';

export type EmitterEventGame =
	| EmitterEventBoard
	| EmitterEventBoardFrame
	| EmitterEventWinPlaque
	| EmitterEventWinTakeover
	| EmitterEventWinLines
	| EmitterEventLanding
	| EmitterEventFreeSpinIntro
	| EmitterEventFreeSpinOutro
	| EmitterEventCurtains
	| EmitterEventRetrigger
	| EmitterEventSound
	| EmitterEventStickyWilds
	| EmitterEventFx;
