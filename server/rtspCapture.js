import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from '@ffmpeg-installer/ffmpeg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

ffmpeg.setFfmpegPath(ffmpegPath.path);

const CAPTURE_DIR = path.join(__dirname, 'captures');
const RTSP_STREAM_URL = 'rtsp://192.168.1.192:554/stream/main';

if (!fs.existsSync(CAPTURE_DIR)) {
  fs.mkdirSync(CAPTURE_DIR, { recursive: true });
}

let lastCaptures = {
  camera: null
};

let captureAttempted = false;

function captureFrame(rtspUrl, outputPath) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Capture timeout'));
    }, 10000);

    ffmpeg(rtspUrl)
      .inputOptions([
        '-rtsp_transport', 'tcp',
        '-stimeout', '5000000'
      ])
      .outputOptions([
        '-vframes', '1',
        '-q:v', '2'
      ])
      .output(outputPath)
      .on('end', () => {
        clearTimeout(timeout);
        resolve(outputPath);
      })
      .on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      })
      .run();
  });
}

export async function captureFromStream() {
  const outputPath = path.join(CAPTURE_DIR, 'camera.jpg');

  try {
    captureAttempted = true;
    await captureFrame(RTSP_STREAM_URL, outputPath);

    const imageBuffer = fs.readFileSync(outputPath);
    const base64Image = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;

    lastCaptures.camera = base64Image;

    console.log('Successfully captured frame from camera');
    return base64Image;
  } catch (error) {
    console.error('Error capturing from camera:', error.message);
    return null;
  }
}

export function getLastCaptures() {
  return lastCaptures;
}

export function hasCaptureAttempts() {
  return captureAttempted;
}

export function initPeriodicCapture(intervalMs = 5000) {
  console.log('Starting periodic RTSP capture...');

  captureFromStream();

  setInterval(async () => {
    await captureFromStream();
  }, intervalMs);
}
