const ytdl = require('ytdl-core');
import * as fs from 'fs';
import { videoInfo } from 'ytdl-core';


console.time('Download Time');

const download = ytdl('https://www.youtube.com/watch?v=0_amnGtMg0Q')
  .pipe(fs.createWriteStream('video.mp4'));


download.on('finish', () => {
  console.timeEnd('Download Time');
});