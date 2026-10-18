const path = require('node:path');
const fs = require('node:fs/promises');
const crypto = require('node:crypto');

function dataDirectory(env = process.env) {
  return path.resolve(env.DATA_DIR || env.RAILWAY_VOLUME_MOUNT_PATH || path.join(__dirname, 'data'));
}

function appOrigin(value = '') {
  if (!value) return '';
  let url;
  try { url = new URL(value); } catch { throw Error('APP_ORIGIN must be the full public app URL, such as https://opstack.example.com.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw Error('APP_ORIGIN must contain only the scheme and hostname (and optional port), without a path, credentials or query.');
  }
  return url.origin;
}

function runtimeConfig(env = process.env) {
  const dataDir = dataDirectory(env);
  const publicOrigin = appOrigin(env.APP_ORIGIN);
  if (!['', '0', '1', 'true', 'false'].includes(env.MIGRATION_MODE || '')) throw Error('MIGRATION_MODE must be 1 or 0.');
  const migrationMode = ['1', 'true'].includes(env.MIGRATION_MODE);
  const port = Number(env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw Error('PORT must be a number between 1 and 65535.');
  if (env.RAILWAY_ENVIRONMENT_ID || env.RAILWAY_VOLUME_MOUNT_PATH) {
    if (!env.RAILWAY_VOLUME_MOUNT_PATH) throw Error('Attach a Railway volume at /data before starting Opstack.');
    const relative = path.relative(path.resolve(env.RAILWAY_VOLUME_MOUNT_PATH), dataDir);
    if (relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) {
      throw Error('DATA_DIR must be inside the attached Railway volume.');
    }
    if (!migrationMode && !publicOrigin.startsWith('https://')) throw Error('Set APP_ORIGIN to the public https:// app URL before leaving migration mode.');
  }
  return {dataDir, publicOrigin, migrationMode, port};
}

async function prepareDataDirectory(dataDir) {
  await fs.mkdir(dataDir, {recursive: true, mode: 0o700});
  const probe = path.join(dataDir, '.opstack-write-check-' + crypto.randomUUID());
  await fs.writeFile(probe, '', {flag: 'wx', mode: 0o600});
  await fs.unlink(probe);
}

module.exports = {dataDirectory, appOrigin, runtimeConfig, prepareDataDirectory};
