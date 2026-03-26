import { useEffect, useRef, useState } from 'react';
import { Activity, Camera } from 'lucide-react';
import type { Config, Result } from '@vladmandic/human';

export interface HumanWebcamMetrics {
  bodyConfidence: number | null;
  bodyCount: number;
  faceConfidence: number | null;
  faceCount: number;
  message: string;
  status: 'idle' | 'loading' | 'live' | 'error';
}

interface HumanWebcamFeedProps {
  onCaptureChange?: (image: string) => void;
  onMetricsChange?: (metrics: HumanWebcamMetrics) => void;
}

const humanConfig: Partial<Config> = {
  backend: 'webgl',
  modelBasePath: 'https://vladmandic.github.io/human-models/models/',
  filter: { enabled: true, flip: false },
  face: {
    enabled: true,
    detector: { rotation: false },
    mesh: { enabled: true },
    iris: { enabled: true },
    description: { enabled: false },
    emotion: { enabled: false },
    antispoof: { enabled: false },
    liveness: { enabled: false },
  },
  body: {
    enabled: true,
  },
  hand: { enabled: false },
  object: { enabled: false },
  segmentation: { enabled: false },
  gesture: { enabled: false },
};

function buildMetrics(result: Result): HumanWebcamMetrics {
  const faceCount = result.face.length;
  const bodyCount = result.body.length;
  const faceConfidence = result.face[0]?.score ?? null;
  const bodyConfidence = result.body[0]?.score ?? null;

  if (faceCount > 0 && bodyCount > 0) {
    return {
      status: 'live',
      message: `Live webcam connected. Tracking ${faceCount} face mesh${faceCount > 1 ? 'es' : ''} and ${bodyCount} body profile${bodyCount > 1 ? 's' : ''}.`,
      faceCount,
      bodyCount,
      faceConfidence,
      bodyConfidence,
    };
  }

  if (faceCount > 0) {
    return {
      status: 'live',
      message: `Face mesh is live. Waiting for a stronger full-body read from the webcam.`,
      faceCount,
      bodyCount,
      faceConfidence,
      bodyConfidence,
    };
  }

  if (bodyCount > 0) {
    return {
      status: 'live',
      message: `Body tracking is live. Waiting for a stronger facial mesh lock.`,
      faceCount,
      bodyCount,
      faceConfidence,
      bodyConfidence,
    };
  }

  return {
    status: 'live',
    message: 'Webcam is live. Waiting for a face or body to enter the frame.',
    faceCount,
    bodyCount,
    faceConfidence,
    bodyConfidence,
  };
}

export default function HumanWebcamFeed({
  onCaptureChange,
  onMetricsChange,
}: HumanWebcamFeedProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const latestMetricsRef = useRef<HumanWebcamMetrics>({
    status: 'idle',
    message: 'Waiting for webcam initialization.',
    faceCount: 0,
    bodyCount: 0,
    faceConfidence: null,
    bodyConfidence: null,
  });
  const [metrics, setMetrics] = useState<HumanWebcamMetrics>(latestMetricsRef.current);

  useEffect(() => {
    let cancelled = false;
    let animationFrame = 0;
    let lastCaptureAt = 0;
    let lastMetricsUpdateAt = 0;
    let humanInstance: InstanceType<typeof import('@vladmandic/human').default> | null = null;

    const updateMetrics = (nextMetrics: HumanWebcamMetrics, force: boolean = false) => {
      const now = window.performance.now();
      if (!force && now - lastMetricsUpdateAt < 350) {
        latestMetricsRef.current = nextMetrics;
        return;
      }

      lastMetricsUpdateAt = now;
      latestMetricsRef.current = nextMetrics;
      setMetrics(nextMetrics);
      onMetricsChange?.(nextMetrics);
    };

    const startDetection = async () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (!video || !canvas) {
        return;
      }

      try {
        updateMetrics(
          {
            status: 'loading',
            message: 'Loading Human models and requesting webcam access.',
            faceCount: 0,
            bodyCount: 0,
            faceConfidence: null,
            bodyConfidence: null,
          },
          true
        );

        const HumanModule = await import('@vladmandic/human');
        humanInstance = new HumanModule.default(humanConfig);
        humanInstance.draw.options.font = '600 16px "Segoe UI", sans-serif';
        humanInstance.draw.options.lineHeight = 18;
        humanInstance.draw.options.lineWidth = 1.5;
        humanInstance.draw.options.pointSize = 2;
        humanInstance.draw.options.drawPoints = true;
        humanInstance.draw.options.drawLabels = true;

        await humanInstance.load();
        await humanInstance.warmup();

        const devices = await humanInstance.webcam.enumerate();
        await humanInstance.webcam.start({
          element: video,
          crop: false,
          width: 1280,
          height: 960,
          id: devices[0]?.deviceId,
        });

        canvas.width = humanInstance.webcam.width || 1280;
        canvas.height = humanInstance.webcam.height || 960;

        const detectFrame = async () => {
          if (cancelled || !humanInstance) {
            return;
          }

          const result = await humanInstance.detect(video);
          const interpolated = humanInstance.next(result);
          const sourceCanvas = result.canvas ?? video;

          humanInstance.draw.canvas(sourceCanvas, canvas);
          humanInstance.draw.face(canvas, interpolated.face);
          humanInstance.draw.body(canvas, interpolated.body);

          const nextMetrics = buildMetrics(interpolated);
          updateMetrics(nextMetrics);

          const hasTrackedSubject = nextMetrics.faceCount > 0 || nextMetrics.bodyCount > 0;
          if (hasTrackedSubject && onCaptureChange) {
            const now = window.performance.now();
            if (now - lastCaptureAt > 1800) {
              lastCaptureAt = now;
              onCaptureChange(canvas.toDataURL('image/jpeg', 0.82));
            }
          }

          animationFrame = window.requestAnimationFrame(() => {
            void detectFrame();
          });
        };

        await detectFrame();
      } catch (error) {
        const nextMetrics: HumanWebcamMetrics = {
          status: 'error',
          message:
            error instanceof Error
              ? error.message
              : 'Unable to start webcam detection.',
          faceCount: 0,
          bodyCount: 0,
          faceConfidence: null,
          bodyConfidence: null,
        };
        updateMetrics(nextMetrics, true);
      }
    };

    void startDetection();

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(animationFrame);
      humanInstance?.webcam.stop();
    };
  }, [onCaptureChange, onMetricsChange]);

  const faceConfidenceLabel =
    metrics.faceConfidence !== null ? metrics.faceConfidence.toFixed(2) : '--';
  const bodyConfidenceLabel =
    metrics.bodyConfidence !== null ? metrics.bodyConfidence.toFixed(2) : '--';

  return (
    <div className="relative min-h-[980px] overflow-hidden rounded-lg bg-slate-950 shadow-[0_38px_90px_-50px_rgba(15,23,42,0.65)]">
      <video ref={videoRef} autoPlay playsInline muted className="hidden" />
      <canvas ref={canvasRef} className="h-full w-full object-cover" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,_rgba(15,23,42,0.05),_rgba(15,23,42,0.55))]" />
      {metrics.status === 'live' ? (
        <div className="feed-scan absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-fuchsia-400/35 to-transparent" />
      ) : null}
      <div className="absolute left-6 right-6 top-6 flex items-center justify-between rounded-md bg-slate-950/70 px-4 py-3 text-sm font-medium text-white backdrop-blur">
        <span className="inline-flex items-center gap-2">
          <Camera className="h-4 w-4 text-[#ffc42d]" />
          Webcam + Human
        </span>
        <span
          className={`inline-flex items-center gap-2 ${
            metrics.status === 'error'
              ? 'text-rose-300'
              : metrics.status === 'live'
                ? 'text-emerald-300'
                : 'text-slate-300'
          }`}
        >
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              metrics.status === 'error'
                ? 'bg-rose-400'
                : metrics.status === 'live'
                  ? 'bg-emerald-400'
                  : 'bg-slate-400'
            }`}
          />
          {metrics.status}
        </span>
      </div>
      <div className="absolute bottom-6 left-6 right-6 rounded-md bg-slate-950/70 p-5 text-white backdrop-blur">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
          <Activity className="h-4 w-4 text-[#ffc42d]" />
          Detector status
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-300">{metrics.message}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-md bg-white/8 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-300/75">Face Mesh</p>
            <p className="mt-2 text-2xl font-semibold text-white">
              {metrics.faceCount}
              <span className="ml-2 text-sm font-medium text-slate-300">
                confidence {faceConfidenceLabel}
              </span>
            </p>
          </div>
          <div className="rounded-md bg-white/8 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-300/75">Body Track</p>
            <p className="mt-2 text-2xl font-semibold text-white">
              {metrics.bodyCount}
              <span className="ml-2 text-sm font-medium text-slate-300">
                confidence {bodyConfidenceLabel}
              </span>
            </p>
          </div>
        </div>
      </div>
      {metrics.status === 'loading' ? (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/45 text-sm font-medium text-white backdrop-blur-sm">
          Connecting to webcam and loading models...
        </div>
      ) : null}
    </div>
  );
}
