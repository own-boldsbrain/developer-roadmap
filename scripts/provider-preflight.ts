import fs from 'node:fs/promises';
import path from 'node:path';

// --- Types ---
type ProviderId = 'ollama' | 'deeplx' | 'azure_openai' | 'nvidia' | 'openai' | 'litellm' | 'mistral';

interface EndpointConfig {
  source: 'DEFAULT' | 'ENV';
  value?: string;
  variable?: string;
}

interface CredentialConfig {
  required: boolean;
  source?: 'ENV';
  variable?: string;
}

interface ProbeConfig {
  method: 'GET' | 'POST';
  path: string;
  expected?: string;
}

interface ProviderCandidate {
  providerId: ProviderId;
  enabled: boolean;
  implementationStatus: string;
  endpoint?: EndpointConfig;
  credential?: CredentialConfig;
  capabilityProbe?: ProbeConfig;
  functionalProbe?: ProbeConfig;
  timeoutMs?: number;
  skipReason?: string;
}

interface CandidatesFile {
  schemaVersion: string;
  generatedAt: string;
  providers: ProviderCandidate[];
}

interface RunStats {
  g0Status: string;
  g1Status: string;
  g2Status: string;
  g3Status: string;
  g4Status: string;
  g5Status: string;
  g6Status: string;
  overall: string;
  metrics: {
    dnsMs?: number;
    connectMs?: number;
    tlsMs?: number;
    ttfbMs?: number;
    httpStatus?: number;
  };
  errors: string[];
}

// --- Globals ---
const OUTPUT_DIR = path.join(process.cwd(), '.provider-preflight');
const REGISTRY_PATH = path.join(process.cwd(), '../.gemini/antigravity-ide/brain/f34d53a0-ec05-48c2-9c3e-acd9da77ad91/connection-test-candidates.json');

// --- Utils ---
async function ensureDir(dirPath: string) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (e: any) {
    if (e.code !== 'EEXIST') throw e;
  }
}

function getEnvSafe(key: string): string | undefined {
  return process.env[key];
}

function resolveEndpoint(config?: EndpointConfig): { resolved: string | null; status: string } {
  if (!config) return { resolved: null, status: 'ENDPOINT_MISSING' };
  
  if (config.source === 'DEFAULT' && config.value) {
    return { resolved: config.value, status: 'RESOLVED' };
  }
  if (config.source === 'ENV' && config.variable) {
    const val = getEnvSafe(config.variable);
    if (val) return { resolved: val, status: 'RESOLVED' };
    return { resolved: null, status: 'ENDPOINT_MISSING' };
  }
  return { resolved: null, status: 'INVALID_ENDPOINT' };
}

function resolveCredential(config?: CredentialConfig): { configured: boolean; status: string } {
  if (!config || !config.required) return { configured: true, status: 'NOT_REQUIRED' };
  
  if (config.source === 'ENV' && config.variable) {
    const val = getEnvSafe(config.variable);
    if (val) return { configured: true, status: 'PASSED' };
    return { configured: false, status: 'CREDENTIAL_MISSING' };
  }
  return { configured: false, status: 'CREDENTIAL_MISSING' };
}

// --- Network ---
async function measureFetch(url: string, options: RequestInit, timeoutMs: number) {
  const start = performance.now();
  let ttfbMs = 0;
  let status = 0;
  let text = '';
  let fetchError = null;

  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    
    const response = await fetch(url, { ...options, signal: controller.signal as any });
    clearTimeout(id);
    
    ttfbMs = performance.now() - start;
    status = response.status;
    
    text = await response.text();
  } catch (err: any) {
    fetchError = err;
    if (err.name === 'AbortError') {
      fetchError = new Error('TIMEOUT');
    }
  }

  const totalMs = performance.now() - start;
  return { status, text, ttfbMs, totalMs, error: fetchError };
}

// --- Main Engine ---
async function runProbe(provider: ProviderCandidate): Promise<RunStats> {
  const stats: RunStats = {
    g0Status: 'UNKNOWN', g1Status: 'UNKNOWN', g2Status: 'UNKNOWN',
    g3Status: 'UNKNOWN', g4Status: 'UNKNOWN', g5Status: 'UNKNOWN', g6Status: 'UNKNOWN',
    overall: 'UNKNOWN', metrics: {}, errors: []
  };

  if (!provider.enabled) {
    stats.overall = 'SKIPPED';
    stats.g0Status = provider.skipReason || 'DISABLED';
    return stats;
  }

  // G0: Configuration
  const cred = resolveCredential(provider.credential);
  if (!cred.configured && provider.credential?.required) {
    stats.g0Status = cred.status;
    stats.overall = 'NOT_READY';
    return stats;
  }
  stats.g0Status = 'PASSED';

  // G1: Endpoint Resolution
  const ep = resolveEndpoint(provider.endpoint);
  if (ep.status !== 'RESOLVED' || !ep.resolved) {
    stats.g1Status = ep.status;
    stats.overall = 'NOT_READY';
    return stats;
  }
  stats.g1Status = 'RESOLVED';
  
  const baseUrl = ep.resolved.replace(/\/$/, '');
  const authHeaders: Record<string, string> = {};
  if (provider.credential?.required && provider.credential.variable) {
      const apiKey = getEnvSafe(provider.credential.variable);
      if (provider.providerId === 'azure_openai') {
          authHeaders['api-key'] = apiKey || '';
      } else {
          authHeaders['Authorization'] = `Bearer ${apiKey}`;
      }
  }

  const timeoutMs = provider.timeoutMs || 15000;

  // G4: Capability Probe (Optional)
  if (provider.capabilityProbe) {
    const capUrl = `${baseUrl}${provider.capabilityProbe.path}`;
    const capRes = await measureFetch(capUrl, { headers: authHeaders }, timeoutMs);
    stats.metrics.httpStatus = capRes.status;
    stats.metrics.ttfbMs = capRes.ttfbMs;
    
    if (capRes.error) {
      stats.g2Status = capRes.error.message === 'TIMEOUT' ? 'TIMEOUT' : 'UNREACHABLE';
      stats.overall = 'NOT_READY';
      stats.errors.push(capRes.error.message);
      return stats;
    }
    
    stats.g2Status = 'REACHABLE';
    
    // G3 Auth check
    if (capRes.status === 401) stats.g3Status = 'AUTH_FAILED';
    else if (capRes.status === 403) stats.g3Status = 'AUTH_FORBIDDEN';
    else if (capRes.status === 429) stats.g3Status = 'RATE_LIMITED';
    else if (capRes.status >= 500) stats.g3Status = 'PROVIDER_ERROR';
    else stats.g3Status = 'AUTH_ACCEPTED';

    if (stats.g3Status !== 'AUTH_ACCEPTED') {
       stats.overall = stats.g3Status;
       return stats;
    }
    
    // Simplified capability check
    if (capRes.status === 200) stats.g4Status = 'MODEL_AVAILABLE';
    else stats.g4Status = 'MODEL_MISSING';
  } else {
      stats.g4Status = 'CAPABILITY_UNVERIFIED';
  }

  // G5 & G6: Functional & Semantic Probe
  if (provider.functionalProbe) {
    const fnUrl = `${baseUrl}${provider.functionalProbe.path}`;
    let body = undefined;
    const headers = { ...authHeaders, 'Content-Type': 'application/json' };
    
    if (provider.providerId === 'deeplx') {
       body = JSON.stringify({ source_lang: 'EN', target_lang: 'PT', text: 'provider readiness test' });
    } else {
       body = JSON.stringify({
           model: provider.providerId === 'nvidia' ? 'meta/llama-3.1-70b-instruct' : (provider.providerId === 'ollama' ? 'qwen2.5-coder:7b' : 'gpt-3.5-turbo'),
           messages: [{ role: 'user', content: 'Return exactly: PROVIDER_READY' }],
           temperature: 0,
           max_tokens: 12,
           stream: false
       });
    }

    const fnRes = await measureFetch(fnUrl, { method: 'POST', headers, body }, timeoutMs);
    
    stats.metrics.httpStatus = fnRes.status;
    stats.metrics.ttfbMs = fnRes.ttfbMs || fnRes.totalMs;

    if (fnRes.error) {
       if (stats.g2Status === 'UNKNOWN') stats.g2Status = 'UNREACHABLE';
       stats.g5Status = 'FUNCTIONAL_TEST_FAILED';
       stats.overall = 'NOT_READY';
       stats.errors.push(fnRes.error.message);
       return stats;
    }
    
    if (stats.g2Status === 'UNKNOWN') stats.g2Status = 'REACHABLE';
    
    if (fnRes.status === 401 || fnRes.status === 403 || fnRes.status === 429) {
        stats.g3Status = fnRes.status === 429 ? 'RATE_LIMITED' : 'AUTH_FAILED';
        stats.g5Status = 'FUNCTIONAL_TEST_FAILED';
        stats.overall = stats.g3Status;
        return stats;
    }

    stats.g5Status = 'PASSED';
    
    // G6 Semantic validation
    const expected = provider.functionalProbe.expected;
    if (expected && fnRes.text.includes(expected)) {
        stats.g6Status = 'READY';
        stats.overall = 'READY';
    } else {
        stats.g6Status = 'NOT_READY';
        stats.overall = 'FUNCTIONAL_TEST_FAILED';
        stats.errors.push(`Expected semantic match failed. Received snippet: ${fnRes.text.slice(0,100)}`);
    }
  }

  return stats;
}

async function main() {
  await ensureDir(OUTPUT_DIR);
  
  const registryRaw = await fs.readFile(REGISTRY_PATH, 'utf-8');
  const candidatesFile = JSON.parse(registryRaw) as CandidatesFile;
  
  const results: Record<string, RunStats> = {};
  const events: any[] = [];
  
  for (const provider of candidatesFile.providers) {
      console.log(`[PREFLIGHT] Testing provider: ${provider.providerId}`);
      const stats = await runProbe(provider);
      results[provider.providerId] = stats;
      events.push({ timestamp: new Date().toISOString(), provider: provider.providerId, status: stats.overall, metrics: stats.metrics });
      
      console.log(`  -> Status: ${stats.overall}`);
      if (stats.errors.length > 0) {
          console.log(`  -> Errors: ${stats.errors.join(' | ')}`);
      }
  }

  // Write Artifacts
  await fs.copyFile(REGISTRY_PATH, path.join(OUTPUT_DIR, 'connection-test-candidates.json'));
  await fs.writeFile(path.join(OUTPUT_DIR, 'provider-summary.json'), JSON.stringify(results, null, 2));
  
  const eventsJsonl = events.map(e => JSON.stringify(e)).join('\n');
  await fs.writeFile(path.join(OUTPUT_DIR, 'events.jsonl'), eventsJsonl);
  
  const resultsJsonl = Object.entries(results).map(([id, stats]) => JSON.stringify({ providerId: id, ...stats })).join('\n');
  await fs.writeFile(path.join(OUTPUT_DIR, 'provider-results.jsonl'), resultsJsonl);
  
  // Write markdown report
  let report = `# Provider Preflight Report\nGenerated at: ${new Date().toISOString()}\n\n`;
  report += `| Provider | Overall Status | G0 | G1 | G2 | G3 | G4 | G5 | G6 | HTTP |\n`;
  report += `|----------|----------------|----|----|----|----|----|----|----|------|\n`;
  for (const p of candidatesFile.providers) {
      const s = results[p.providerId];
      report += `| **${p.providerId}** | \`${s.overall}\` | ${s.g0Status} | ${s.g1Status} | ${s.g2Status} | ${s.g3Status} | ${s.g4Status} | ${s.g5Status} | ${s.g6Status} | ${s.metrics.httpStatus || '-'} |\n`;
  }
  await fs.writeFile(path.join(OUTPUT_DIR, 'PREFLIGHT_REPORT.md'), report);

  console.log('[PREFLIGHT] Reports generated in .provider-preflight/');
}

main().catch(console.error);
