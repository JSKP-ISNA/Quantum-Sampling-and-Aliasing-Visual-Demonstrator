import http from 'node:http';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const viteCli = path.join(rootDir, 'node_modules', 'vite', 'bin', 'vite.js');
const electronCli = path.join(rootDir, 'node_modules', '.bin', process.platform === 'win32' ? 'electron.cmd' : 'electron');

const previewUrl = 'http://127.0.0.1:4173';

let previewProcess;
let desktopProcess;
let shuttingDown = false;

function spawnPreview() {
  previewProcess = spawn(process.execPath, [viteCli, 'preview', '--host', '127.0.0.1', '--port', '4173', '--strictPort'], {
    cwd: rootDir,
    stdio: 'inherit',
    shell: false,
    env: process.env,
  });

  previewProcess.on('exit', (code) => {
    if (!shuttingDown && code && code !== 0) {
      process.exit(code);
    }

    if (!shuttingDown && desktopProcess && !desktopProcess.killed) {
      desktopProcess.kill();
    }
  });
}

function waitForUrl(targetUrl, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;

  return new Promise((resolve, reject) => {
    const probe = () => {
      const request = http.get(targetUrl, (response) => {
        response.resume();
        if (response.statusCode && response.statusCode >= 200 && response.statusCode < 500) {
          resolve();
          return;
        }

        retry();
      });

      request.on('error', retry);

      function retry() {
        request.destroy();
        if (Date.now() >= deadline) {
          reject(new Error(`Timed out waiting for ${targetUrl}`));
          return;
        }

        setTimeout(probe, 750);
      }
    };

    probe();
  });
}

function spawnDesktop() {
  const command = process.platform === 'win32' ? 'cmd.exe' : electronCli;
  const args = process.platform === 'win32'
    ? ['/c', electronCli, '.']
    : ['.'];
  const desktopEnv = {
    ...process.env,
    ELECTRON_RENDERER_URL: previewUrl,
  };

  delete desktopEnv.ELECTRON_RUN_AS_NODE;

  desktopProcess = spawn(command, args, {
    cwd: rootDir,
    stdio: 'inherit',
    shell: false,
    env: desktopEnv,
  });

  desktopProcess.on('exit', (code) => {
    shuttingDown = true;
    if (previewProcess && !previewProcess.killed) {
      previewProcess.kill();
    }
    process.exit(code ?? 0);
  });
}

function shutdown() {
  shuttingDown = true;
  if (desktopProcess && !desktopProcess.killed) {
    desktopProcess.kill();
  }
  if (previewProcess && !previewProcess.killed) {
    previewProcess.kill();
  }
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

async function main() {
  spawnPreview();
  await waitForUrl(previewUrl);
  spawnDesktop();
}

main().catch((error) => {
  console.error('[desktop-preview]', error.message);
  shutdown();
  process.exit(1);
});
