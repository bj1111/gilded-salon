// Production build. `vite build` (SvelteKit + adapter-static) finishes writing the site but its
// process does not exit afterwards, so this waits for adapter-static's "done" line and then ends it.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const appDir = fileURLToPath(new URL('..', import.meta.url));
const child = spawn('npx', ['vite', 'build'], { cwd: appDir, stdio: ['ignore', 'pipe', 'pipe'] });
let log = '';
const timer = setTimeout(() => finish(1, 'build timed out'), 5 * 60 * 1000);
const finish = (code, message) => {
	clearTimeout(timer);
	if (message) console.error(message);
	child.kill('SIGTERM');
	process.exit(code);
};
const onData = (data) => {
	const text = data.toString();
	log += text;
	process.stdout.write(text);
	if (/✔ done/.test(log)) setTimeout(() => finish(0), 300);
	if (/error during build|\[vite\]: Rollup failed|Error:/i.test(text)) finish(1, 'build failed');
};
child.stdout.on('data', onData);
child.stderr.on('data', onData);
child.on('exit', (code) => finish(code ?? 1));
