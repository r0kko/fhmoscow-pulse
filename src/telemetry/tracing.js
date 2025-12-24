import process from 'process';

export async function initTracing() {
  const enabled = String(process.env.OTEL_ENABLED || '').toLowerCase();
  if (
    !(
      enabled === '1' ||
      enabled === 'true' ||
      (process.env.NODE_ENV === 'production' && enabled !== 'false')
    )
  ) {
    return; // disabled
  }
  try {
    const { NodeSDK } = await import('@opentelemetry/sdk-node');
    const { OTLPTraceExporter } =
      await import('@opentelemetry/exporter-trace-otlp-grpc');
    const { resourceFromAttributes, defaultResource } =
      await import('@opentelemetry/resources');
    const { getNodeAutoInstrumentations } =
      await import('@opentelemetry/auto-instrumentations-node');

    const serviceName = process.env.OTEL_SERVICE_NAME || 'api';
    const version = process.env.VERSION || '0.0.0';
    const endpoint =
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://tempo:4317';

    const exporter = new OTLPTraceExporter({ url: undefined, endpoint });
    const baseResource =
      typeof defaultResource === 'function'
        ? defaultResource()
        : resourceFromAttributes({});
    const serviceResource = resourceFromAttributes({
      'service.name': serviceName,
      'service.version': version,
    });
    const sdk = new NodeSDK({
      resource: baseResource.merge(serviceResource),
      traceExporter: exporter,
      instrumentations: [
        getNodeAutoInstrumentations({
          '@opentelemetry/instrumentation-http': { enabled: true },
          '@opentelemetry/instrumentation-express': { enabled: true },
          '@opentelemetry/instrumentation-pg': { enabled: true },
          '@opentelemetry/instrumentation-redis-4': { enabled: true },
          '@opentelemetry/instrumentation-mysql2': { enabled: true },
        }),
      ],
    });
    await sdk.start();
    process.on('SIGTERM', async () => {
      try {
        await sdk.shutdown();
      } catch (_e) {
        /* noop */
      }
    });
  } catch (e) {
    // Tracing is optional; never crash app
    console.warn('OTel tracing init failed:', e?.message || e);
  }
}

export default { initTracing };
