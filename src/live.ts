const ytdl = require('ytdl-core');
import * as fs from 'fs';
import path from 'path';
import { videoInfo } from 'ytdl-core'; 

export const downloadLivestream = async (url: string, durationInMinutes: number = 1): Promise<void> => {
  console.log(`Starting download for URL: ${url}`);

  try {
    if (!ytdl.validateURL(url)) {
      console.error("Invalid YouTube URL");
      return;
    }
    console.log('URL is valid');

    const info: videoInfo = await ytdl.getInfo(url);
    console.log('Got video info');

    const isLiveStream: boolean = !!info.player_response?.videoDetails?.isLiveContent;
    const videoTitle: string = info.videoDetails.title;

    if (!isLiveStream) {
      console.error("The provided URL is not a live stream.");
      return;
    }
    console.log('URL is a live stream');

    const sanitizedTitle = videoTitle.replace(/[\/\\?%*:|"<>]/g, '-');
  
    const outputFile: string = path.join(
      __dirname,
      "..",
      "downloaded_videos",
      `${sanitizedTitle}_${durationInMinutes}min.mp4`
  );

    console.log(`Starting to download ${durationInMinutes} minutes of livestream to ${outputFile}...`);

    const downloadStream = ytdl(url, { quality: 'highest', liveBuffer: 30000 })
        .pipe(fs.createWriteStream(outputFile));

    setTimeout(() => {
        downloadStream.destroy();
        console.log(`Finished downloading ${durationInMinutes} minutes of livestream to ${outputFile}`);
    }, durationInMinutes * 60 * 1000);
  } catch (err) {
    console.error('Error downloading livestream:', err);
  }
};

const url1 = 'https://www.youtube.com/watch?v=JFznOHunD_c';
const url2 = 'https://www.youtube.com/watch?v=FBTYDX91IYU';
const url3 = 'https://www.youtube.com/watch?v=A0zkqq-wBcE';
const url4 = 'https://www.youtube.com/watch?v=4rdRZVzhGSs';

downloadLivestream(url4);