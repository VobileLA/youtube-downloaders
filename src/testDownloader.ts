import { downloadFile } from './downloader';

const url = 'https://apricot01.clicknupload.net:8080/d/vw5zgjaxlryd7tr7mli5rj2slhqhhkrdwujrpxfzndsfk4uijxwqkorywdpwyovvasg452il/STNG4SKMHD%20(2022)%20www.SkymoviesHD.pics%20480p%20HEVC%20NF%20HDRip%20S04E08T09%20Dual%20x265%20ESub.mkv';
const destinationBucket = 'ryan-media-downloader-bucket';
const byteRange = 100000;

(async () => {
    try {
        const result = await downloadFile({ url, destinationBucket, byteRange });
        console.log(`Download Result: ${result}`);
    } catch (error) {
        console.error('Error occurred:', error);
    }
})();
