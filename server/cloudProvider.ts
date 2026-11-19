import type { CloudLaunchResponse, CloudProviderStatus, GamingSession } from '../src/types.ts';

export function getCloudProviderStatus(): CloudProviderStatus {
  const providerUrl = process.env.CLOUD_STREAM_PROVIDER_URL?.trim();
  const apiKey = process.env.CLOUD_STREAM_API_KEY?.trim();
  const licenseId = process.env.CLOUD_GAME_LICENSE_ID?.trim();
  const providerName = process.env.CLOUD_STREAM_PROVIDER_NAME?.trim() || null;
  const region = process.env.CLOUD_STREAM_REGION?.trim() || 'us-east-miami';

  const connected = Boolean(providerUrl && apiKey && licenseId);

  if (!connected) {
    return {
      connected: false,
      providerName,
      region,
      licenseVerified: Boolean(licenseId),
      statusCode: 'INFRASTRUCTURE_NOT_CONNECTED',
      message:
        'Cloud gaming streaming infrastructure is not connected. Actual GTA 6 gameplay requires a legally licensed copy of GTA 6 and a configured remote GPU WebRTC streaming provider.',
      requirements: [
        'Configure CLOUD_STREAM_PROVIDER_URL (WebRTC GPU node orchestrator endpoint)',
        'Configure CLOUD_STREAM_API_KEY (server-side provider authentication secret)',
        'Configure CLOUD_GAME_LICENSE_ID (verified commercial/user GTA 6 entitlement ID)',
      ],
    };
  }

  return {
    connected: true,
    providerName: providerName || 'Remote GPU WebRTC Node',
    region,
    licenseVerified: true,
    statusCode: 'CONNECTED',
    message: `Connected to ${providerName || 'Remote GPU WebRTC Node'} (${region}).`,
    requirements: [],
  };
}

export async function launchCloudStreamSession(
  session: GamingSession,
  userId: string
): Promise<CloudLaunchResponse> {
  const provider = getCloudProviderStatus();
  const nowIso = new Date().toISOString();

  if (session.status !== 'Active' || session.expiresAt <= nowIso) {
    return {
      connected: provider.connected,
      statusCode: 'SESSION_EXPIRED',
      message: 'This rental session has expired. Purchase a new session to launch.',
      session: { ...session, status: 'Expired' },
      provider,
    };
  }

  if (!provider.connected) {
    return {
      connected: false,
      statusCode: 'INFRASTRUCTURE_NOT_CONNECTED',
      message:
        'Launch blocked: Cloud gaming GPU streaming infrastructure is not connected on this server. No simulated stream was started.',
      session,
      provider,
    };
  }

  const providerUrl = process.env.CLOUD_STREAM_PROVIDER_URL!.replace(/\/$/, '');
  const apiKey = process.env.CLOUD_STREAM_API_KEY!;
  const licenseId = process.env.CLOUD_GAME_LICENSE_ID!;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(`${providerUrl}/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        sessionId: session.id,
        userId,
        licenseId,
        region: provider.region,
        expiresAt: session.expiresAt,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      return {
        connected: false,
        statusCode: 'INFRASTRUCTURE_NOT_CONNECTED',
        message: `Cloud provider returned HTTP ${res.status}. Stream could not be provisioned.`,
        session,
        provider: {
          ...provider,
          connected: false,
          statusCode: 'INFRASTRUCTURE_NOT_CONNECTED',
        },
      };
    }

    const data = (await res.json()) as {
      streamEndpoint?: string;
      signalingToken?: string;
      nodeId?: string;
    };

    return {
      connected: true,
      statusCode: 'STREAM_READY',
      message: 'Remote GPU stream provisioned. Connecting WebRTC signaling channel.',
      streamEndpoint: data.streamEndpoint,
      signalingToken: data.signalingToken,
      session: {
        ...session,
        streamNodeId: data.nodeId ?? session.streamNodeId,
        lastLaunchAttemptAt: nowIso,
      },
      provider,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Provider unreachable';
    return {
      connected: false,
      statusCode: 'INFRASTRUCTURE_NOT_CONNECTED',
      message: `Cloud streaming provider unreachable (${msg}).`,
      session,
      provider: {
        ...provider,
        connected: false,
        statusCode: 'INFRASTRUCTURE_NOT_CONNECTED',
      },
    };
  }
}
