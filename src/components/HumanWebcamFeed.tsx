import { useEffect, useRef, useState } from 'react';
import { Activity, Camera } from 'lucide-react';
import type { Config, Result } from '@vladmandic/human';
import type { StableCaptureCandidate } from '../data/products';

export interface HumanWebcamMetrics {
  bodyConfidence: number | null;
  bodyCount: number;
  faceConfidence: number | null;
  faceCount: number;
  message: string;
  status: 'idle' | 'loading' | 'live' | 'captured' | 'processing' | 'error';
}

interface HumanWebcamFeedProps {
  analysisState: 'idle' | 'processing' | 'ready' | 'error';
  analysisMessage: string;
  onStableCapture?: (candidate: StableCaptureCandidate) => void;
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
      message:
        'Retail profile lock is building. Hold a clear, centered pose in frame to accept this shopper.',
      faceCount,
      bodyCount,
      faceConfidence,
      bodyConfidence,
    };
  }

  if (faceCount > 0) {
    return {
      status: 'live',
      message: 'Face mesh is live. Waiting for a stronger full-body read.',
      faceCount,
      bodyCount,
      faceConfidence,
      bodyConfidence,
    };
  }

  if (bodyCount > 0) {
    return {
      status: 'live',
      message: 'Body tracking is live. Waiting for a stronger facial mesh lock.',
      faceCount,
      bodyCount,
      faceConfidence,
      bodyConfidence,
    };
  }

  return {
    status: 'live',
    message: 'Webcam is live. Waiting for a shopper to enter the frame.',
    faceCount,
    bodyCount,
    faceConfidence,
    bodyConfidence,
  };
}

function analyzeImageQuality(
  canvas: HTMLCanvasElement,
  faceBox: [number, number, number, number]
) {
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    return {
      brightness: 0,
      sharpness: 0,
      faceCoverage: 0,
      centered: false,
      passes: false,
    };
  }

  const { width, height } = canvas;
  const imageData = context.getImageData(0, 0, width, height).data;
  let luminanceTotal = 0;
  let edgeTotal = 0;
  const sampleStep = 4;
  const rowStride = width * 4;

  for (let y = 0; y < height; y += sampleStep) {
    for (let x = 0; x < width; x += sampleStep) {
      const index = y * rowStride + x * 4;
      const red = imageData[index];
      const green = imageData[index + 1];
      const blue = imageData[index + 2];
      const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;
      luminanceTotal += luminance;

      if (x + sampleStep < width && y + sampleStep < height) {
        const neighborIndex = index + sampleStep * 4;
        const lowerIndex = index + sampleStep * rowStride;
        const horizontal =
          Math.abs(luminance - (imageData[neighborIndex] * 0.2126 +
            imageData[neighborIndex + 1] * 0.7152 +
            imageData[neighborIndex + 2] * 0.0722));
        const vertical =
          Math.abs(luminance - (imageData[lowerIndex] * 0.2126 +
            imageData[lowerIndex + 1] * 0.7152 +
            imageData[lowerIndex + 2] * 0.0722));
        edgeTotal += horizontal + vertical;
      }
    }
  }

  const totalSamples = Math.max(1, Math.ceil(width / sampleStep) * Math.ceil(height / sampleStep));
  const brightness = luminanceTotal / totalSamples;
  const sharpness = edgeTotal / totalSamples;
  const [x, y, boxWidth, boxHeight] = faceBox;
  const faceCoverage = (boxWidth * boxHeight) / (width * height);
  const faceCenterX = (x + boxWidth / 2) / width;
  const faceCenterY = (y + boxHeight / 2) / height;
  const centered =
    faceCenterX >= 0.25 &&
    faceCenterX <= 0.75 &&
    faceCenterY >= 0.18 &&
    faceCenterY <= 0.78;
  const passes =
    brightness >= 90 &&
    sharpness >= 18 &&
    faceCoverage >= 0.05 &&
    boxWidth >= width * 0.18 &&
    centered;

  return {
    brightness: Number(brightness.toFixed(2)),
    sharpness: Number(sharpness.toFixed(2)),
    faceCoverage: Number(faceCoverage.toFixed(4)),
    centered,
    passes,
  };
}

export default function HumanWebcamFeed({
  analysisState,
  analysisMessage,
  onStableCapture,
}: HumanWebcamFeedProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const analysisCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const latestMetricsRef = useRef<HumanWebcamMetrics>({
    status: 'idle',
    message: 'Waiting for webcam initialization.',
    faceCount: 0,
    bodyCount: 0,
    faceConfidence: null,
    bodyConfidence: null,
  });
  const lockStateRef = useRef({
    stableSince: 0,
    lastSeenAt: 0,
    subjectLocked: false,
    currentSessionId: '',
  });
  const [metrics, setMetrics] = useState<HumanWebcamMetrics>(latestMetricsRef.current);

  useEffect(() => {
    let cancelled = false;
    let animationFrame = 0;
    let lastMetricsUpdateAt = 0;
    let humanInstance: InstanceType<typeof import('@vladmandic/human').default> | null = null;

    const updateMetrics = (nextMetrics: HumanWebcamMetrics, force: boolean = false) => {
      const now = window.performance.now();
      if (!force && now - lastMetricsUpdateAt < 250) {
        latestMetricsRef.current = nextMetrics;
        return;
      }

      lastMetricsUpdateAt = now;
      latestMetricsRef.current = nextMetrics;
      setMetrics(nextMetrics);
    };

    const drawSourceFrame = (
      source: CanvasImageSource,
      target: HTMLCanvasElement,
      width: number,
      height: number
    ) => {
      const targetContext = target.getContext('2d');
      if (!targetContext) {
        return;
      }

      if (target.width !== width || target.height !== height) {
        target.width = width;
        target.height = height;
      }

      targetContext.drawImage(source, 0, 0, width, height);
    };

    const startDetection = async () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const analysisCanvas = analysisCanvasRef.current;

      if (!video || !canvas || !analysisCanvas) {
        return;
      }

      try {
        updateMetrics(
          {
            status: 'loading',
            message: 'Capturing retail profile from webcam.',
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
        analysisCanvas.width = canvas.width;
        analysisCanvas.height = canvas.height;

        const detectFrame = async () => {
          if (cancelled || !humanInstance) {
            return;
          }

          const result = await humanInstance.detect(video);
          const interpolated = humanInstance.next(result);
          const sourceCanvas = result.canvas ?? video;
          const width = canvas.width;
          const height = canvas.height;

          drawSourceFrame(sourceCanvas as CanvasImageSource, analysisCanvas, width, height);
          humanInstance.draw.canvas(sourceCanvas, canvas);
          humanInstance.draw.face(canvas, interpolated.face);
          humanInstance.draw.body(canvas, interpolated.body);

          const nextMetrics = buildMetrics(interpolated);
          const lockState = lockStateRef.current;
          const now = window.performance.now();
          const faceBox = interpolated.face[0]?.box as [number, number, number, number] | undefined;
          const hasPresence = Boolean(interpolated.face[0] && interpolated.body[0] && faceBox);

          if (hasPresence && faceBox) {
            lockState.lastSeenAt = now;
            const quality = analyzeImageQuality(analysisCanvas, faceBox);

            if (!lockState.subjectLocked && quality.passes) {
              if (lockState.stableSince === 0) {
                lockState.stableSince = now;
              }

              if (now - lockState.stableSince >= 1500) {
                lockState.subjectLocked = true;
                lockState.currentSessionId = `person-${Date.now()}`;

                onStableCapture?.({
                  personSessionId: lockState.currentSessionId,
                  image: analysisCanvas.toDataURL('image/jpeg', 0.9),
                  captureMetadata: {
                    brightness: quality.brightness,
                    sharpness: quality.sharpness,
                    faceCoverage: quality.faceCoverage,
                    centered: quality.centered,
                  },
                });

                updateMetrics(
                  {
                    ...nextMetrics,
                    status: 'captured',
                    message: 'Retail profile captured. Waiting for server analysis.',
                  },
                  true
                );
              } else {
                updateMetrics(
                  {
                    ...nextMetrics,
                    message:
                      'Retail profile lock is stabilizing. Keep the shopper centered and well lit.',
                  }
                );
              }
            } else if (!quality.passes) {
              lockState.stableSince = 0;
              updateMetrics(
                {
                  ...nextMetrics,
                  message:
                    'Retail profile needs a brighter, sharper, centered face before capture.',
                }
              );
            } else {
              updateMetrics(nextMetrics);
            }
          } else {
            lockState.stableSince = 0;
            updateMetrics(nextMetrics);

            if (lockState.subjectLocked && now - lockState.lastSeenAt >= 3000) {
              lockState.subjectLocked = false;
              lockState.currentSessionId = '';
            }
          }

          animationFrame = window.requestAnimationFrame(() => {
            void detectFrame();
          });
        };

        await detectFrame();
      } catch (error) {
        updateMetrics(
          {
            status: 'error',
            message:
              error instanceof Error
                ? error.message
                : 'Unable to start webcam detection.',
            faceCount: 0,
            bodyCount: 0,
            faceConfidence: null,
            bodyConfidence: null,
          },
          true
        );
      }
    };

    void startDetection();

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(animationFrame);
      humanInstance?.webcam.stop();
    };
  }, [onStableCapture]);

  const faceConfidenceLabel =
    metrics.faceConfidence !== null ? metrics.faceConfidence.toFixed(2) : '--';
  const bodyConfidenceLabel =
    metrics.bodyConfidence !== null ? metrics.bodyConfidence.toFixed(2) : '--';
  const displayMessage =
    analysisState === 'processing' || analysisState === 'error'
      ? analysisMessage
      : metrics.message;

  return (
    <div className="relative h-[calc(100vh-24px)] overflow-hidden rounded-lg bg-slate-950 shadow-[0_38px_90px_-50px_rgba(15,23,42,0.65)]">
      <video ref={videoRef} autoPlay playsInline muted className="hidden" />
      <canvas ref={analysisCanvasRef} className="hidden" />
      <canvas ref={canvasRef} className="h-full w-full object-cover" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,_rgba(15,23,42,0.05),_rgba(15,23,42,0.55))]" />
      {metrics.status === 'live' || metrics.status === 'captured' ? (
        <div className="feed-scan absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-fuchsia-400/35 to-transparent" />
      ) : null}
      <div className="absolute left-4 right-4 top-4 flex items-center justify-between rounded-md bg-slate-950/70 px-4 py-3 text-sm font-medium text-white backdrop-blur">
        <span className="inline-flex items-center gap-2">
          <Camera className="h-4 w-4 text-[#ffc42d]" />
          Webcam + Human
        </span>
        <span
          className={`inline-flex items-center gap-2 ${
            metrics.status === 'error'
              ? 'text-rose-300'
              : metrics.status === 'live' || metrics.status === 'captured'
                ? 'text-emerald-300'
                : 'text-slate-300'
          }`}
        >
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              metrics.status === 'error'
                ? 'bg-rose-400'
                : metrics.status === 'live' || metrics.status === 'captured'
                  ? 'bg-emerald-400'
                  : 'bg-slate-400'
            }`}
          />
          {analysisState === 'processing' ? 'processing' : metrics.status}
        </span>
      </div>
      <div className="absolute bottom-4 left-4 right-4 rounded-md bg-slate-950/72 p-4 text-white backdrop-blur">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
          <Activity className="h-4 w-4 text-[#ffc42d]" />
          Captured Retail Signals
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-300">{displayMessage}</p>
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
          Capturing retail profile from webcam...
        </div>
      ) : null}
    </div>
  );
}
