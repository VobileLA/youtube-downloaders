const ytdl = require('ytdl-core');
import { videoInfo } from 'ytdl-core';
const cp = require('child_process');
const readline = require('readline');


// Global constants
const ref = 'https://www.youtube.com/watch?v=0_amnGtMg0Q';
const tracker = {
  start: Date.now(),
  audio: { downloaded: 0, total: Infinity },
  video: { downloaded: 0, total: Infinity },
  merged: { frame: 0, speed: '0x', fps: 0 },
};

// Get audio and video streams
const audio = ytdl(ref, { quality: 'highestaudio' })
    .on('progress', (chunkLength: number, downloadedBytes: number, totalBytes: number) => {
        tracker.audio = { downloaded: downloadedBytes, total: totalBytes };
    });

const video = ytdl(ref, { quality: 'highestvideo' })
    .on('progress', (chunkLength: number, downloadedBytes: number, totalBytes: number) => {
        tracker.video = { downloaded: downloadedBytes, total: totalBytes };
    });

// Prepare the progress bar
let progressbarHandle: NodeJS.Timeout | null = null;
const progressbarInterval = 1000;
const showProgress = () => {
  readline.cursorTo(process.stdout, 0);
  const toMB = (i: number) => (i / 1024 / 1024).toFixed(2);

  process.stdout.write(`Audio  | ${(tracker.audio.downloaded / tracker.audio.total * 100).toFixed(2)}% processed `);
  process.stdout.write(`(${toMB(tracker.audio.downloaded)}MB of ${toMB(tracker.audio.total)}MB).${' '.repeat(10)}\n`);

  process.stdout.write(`Video  | ${(tracker.video.downloaded / tracker.video.total * 100).toFixed(2)}% processed `);
  process.stdout.write(`(${toMB(tracker.video.downloaded)}MB of ${toMB(tracker.video.total)}MB).${' '.repeat(10)}\n`);

  process.stdout.write(`Merged | processing frame ${tracker.merged.frame} `);
  process.stdout.write(`(at ${tracker.merged.fps} fps => ${tracker.merged.speed}).${' '.repeat(10)}\n`);

  process.stdout.write(`running for: ${((Date.now() - tracker.start) / 1000 / 60).toFixed(2)} Minutes.`);
  readline.moveCursor(process.stdout, 0, -3);
};

// Start the ffmpeg child process
const ffmpegProcess = cp.spawn('ffmpeg', [
  '-loglevel', '8', '-hide_banner',
  '-progress', 'pipe:3',
  '-i', 'pipe:4',
  '-i', 'pipe:5',
  '-map', '0:a',
  '-map', '1:v',
  '-c:v', 'copy',
  'out.mkv',
], {
  windowsHide: true,
  stdio: [
    'inherit', 'inherit', 'inherit',
    'pipe', 'pipe', 'pipe',
  ],
});
ffmpegProcess.on('close', () => {
  console.log('done');
  if (progressbarHandle) {
    clearInterval(progressbarHandle);
  }
});

// Link streams
ffmpegProcess.stdio[3].on('data', (chunk: Buffer) => {
    if (!progressbarHandle) progressbarHandle = setInterval(showProgress, progressbarInterval);
    const lines = chunk.toString().trim().split('\n');
    const args: { [key: string]: string } = {};
    for (const l of lines) {
        const [key, value] = l.split('=');
        args[key.trim()] = value.trim();
    }
    tracker.merged = args as any; // type casting since we don't have exact types for all the possible ffmpeg output args
});
audio.pipe(ffmpegProcess.stdio[4] as NodeJS.WritableStream);
video.pipe(ffmpegProcess.stdio[5] as NodeJS.WritableStream);