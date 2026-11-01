// Publish the built samples (dist/, built with `npm run build:pages`, base /web-engine/) to GitHub Pages: the contents
// of dist/ are committed on top of the `gh-pages` branch of this repository and pushed (a plain push, never a force
// push: each deploy is one more commit on gh-pages; the first deploy creates the branch). GitHub serves that branch.
// Run: npm run deploy    → https://<owner>.github.io/<repo>/ (samples index), .../halloween/ (Midnight Candy Run)
// Optional argument: another build folder to publish instead of dist/.
import { execSync } from 'node:child_process';
import { existsSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = process.argv[2] ? `${process.argv[2].replace(/\/$/, '')}/` : fileURLToPath(new URL('../dist/', import.meta.url));
if (!existsSync(dist + 'index.html')) { console.error('dist/index.html missing: run `npm run build:pages` first'); process.exit(1); }
const sh = (cmd) => execSync(cmd, { stdio: 'inherit', cwd: dist });
const remote = execSync('git remote get-url origin', { encoding: 'utf8', cwd: root }).trim();
const repo = (remote.match(/github\.com[:/]([^/]+\/[^/.]+)/) || [])[1];
if (!repo) { console.error(`origin is not a GitHub repository: ${remote}`); process.exit(1); }

writeFileSync(dist + '.nojekyll', '');            // serve every file as-is (no Jekyll pass)
rmSync(dist + '.git', { recursive: true, force: true });
sh('git init -q -b gh-pages');
// stack this deploy on the published branch when it exists, so the push fast-forwards
let hasRemote = false;
try { execSync(`git fetch -q --depth 1 ${remote} gh-pages`, { stdio: 'ignore', cwd: dist }); hasRemote = true; } catch { /* first deploy */ }
if (hasRemote) sh('git reset -q --soft FETCH_HEAD');
sh('git add -A');
sh(`git -c user.name=deploy -c user.email=deploy@local commit -q -m "Deploy ${new Date().toISOString().slice(0, 16)}"`);
sh(`git push ${remote} gh-pages:gh-pages`);
rmSync(dist + '.git', { recursive: true, force: true });
try {
  execSync(`gh api -X POST repos/${repo}/pages -f build_type=legacy -f "source[branch]=gh-pages" -f "source[path]=/"`, { stdio: 'ignore' });
} catch { /* already configured */ }
const [owner, name] = repo.split('/');
console.log(`Deployed to https://${owner.toLowerCase()}.github.io/${name}/  (game: .../${name}/halloween/)`);
