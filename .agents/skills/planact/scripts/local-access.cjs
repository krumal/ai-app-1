const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);

function localSettings(env) {
  const host = env.PLANACT_VC_HOST || '127.0.0.1';
  const urlHost = env.PLANACT_VC_URL_HOST || (host === '::1' ? '[::1]' : 'localhost');
  const unbracketedUrlHost = urlHost === '[::1]' ? '::1' : urlHost;
  if (!LOOPBACK_HOSTS.has(host) || !LOOPBACK_HOSTS.has(unbracketedUrlHost)) {
    throw new Error('Visual Companion is local-only; public bind and URL hosts are not allowed.');
  }
  const port = Number(env.PLANACT_VC_PORT ?? 0);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error('Visual Companion port must be an integer from 0 to 65535.');
  }
  return { host: host === 'localhost' ? '127.0.0.1' : host,
    urlHost: unbracketedUrlHost === '::1' ? '[::1]' : urlHost, port };
}

function isLocalRequest(req, port) {
  const hosts = ['127.0.0.1', 'localhost', '[::1]'].map(host => `${host}:${port}`);
  const origin = req.headers.origin;
  return typeof req.headers.host === 'string'
    && hosts.includes(req.headers.host.toLowerCase())
    && req.headers['sec-fetch-site'] !== 'cross-site'
    && (origin === undefined || hosts.some(host => origin === `http://${host}`))
    && (['GET', 'HEAD', 'OPTIONS'].includes(req.method) || origin !== undefined);
}

module.exports = { localSettings, isLocalRequest };
