const ytdl = require("ytdl-core");
import path from "path";
import { videoInfo } from "ytdl-core";
const cp = require("child_process");
const readline = require("readline");

// export const makeYoutubeUrl = (source: TSourceThing) => {
//   const source_url = source.url;
//   const videoId = source_url ? ytdl.getURLVideoID(source_url) : source.identifier;
//   return `https://www.youtube.com/watch?v=${videoId}`;
// }

const url = "https://www.youtube.com/watch?v=lTxM1HTC40c"

const videoID = ytdl.getURLVideoID(url);

console.log(videoID);

const info = ytdl.getInfo(url);

info.then((info: videoInfo) => {
//   console.log(info);
  console.log(info.formats);
  console.log(ytdl.filterFormats(info.formats, 'videoonly'));
});
