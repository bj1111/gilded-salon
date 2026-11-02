<script lang="ts">
	import { MainContainer, OnPressFullScreen } from 'components-layout';
	import { OnHotkey } from 'components-shared';
	import { Text } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import { textStyle } from '../game/theme';

	type Props = {
		onpress: () => void;
		text?: string;
		showText?: boolean;
	};

	const props: Props = $props();
	const context = getContext();
</script>

{#if props.showText !== false}
	<MainContainer alignVertical="bottom">
		<Text
			anchor={{ x: 0.5, y: 1 }}
			x={context.stateLayoutDerived.mainLayout().width * 0.5}
			y={context.stateLayoutDerived.mainLayout().height - 40}
			text={props.text ?? 'TAP ANYWHERE TO CONTINUE'}
			style={textStyle.caption(18)}
		/>
	</MainContainer>
{/if}
<OnHotkey hotkey="Space" onpress={() => props.onpress()} />
<OnPressFullScreen onpress={() => props.onpress()} />
