import { z } from 'zod';
import axios, { AxiosResponse } from 'axios';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { createReadStream, createWriteStream } from 'fs';
import dotenv from 'dotenv';
import { s3 } from './aws';
import https from 'https';
// dotenv.config();

const DownloadParamsInput = z.object({
  url: z.string(),
  headers: z.record(z.string()).optional(),
  startSeconds: z.number().optional(),
  filename: z.string().optional(),
  endSeconds: z.number().optional(),
  byteRange: z.number().optional(),
  destinationBucket: z.string(),
  // destinationKey: z.string().optional(),
});


export type DownloadParamsInput = z.infer<typeof DownloadParamsInput> ;

export type M3U8DownloadParams = Pick<DownloadParamsInput, 'url' | 'headers' | 'filename' | 'startSeconds' | 'endSeconds'>;

export type GeneralDownloadParams = Pick<DownloadParamsInput, 'url' | 'headers' | 'filename' | 'byteRange'>;

export type UploadParams = Pick<DownloadParamsInput, 'destinationBucket'>
export const downloadFile = (
  downloadParams: DownloadParamsInput,
): Promise<string> => {

  const {url, headers, filename, startSeconds, endSeconds, byteRange, destinationBucket } = DownloadParamsInput.parse(downloadParams);
	console.log('Download params:', downloadParams);

  const m3U8DownloadParams: M3U8DownloadParams = {
    url,
    headers,
    filename,
    startSeconds,
    endSeconds,
  };

  const generalDownloadParams: GeneralDownloadParams  = {
    url,
    headers,
    filename,
    byteRange,
  }

  const uploadParams: UploadParams = {
    destinationBucket,
  };

  return new Promise(async (resolve) => {
    try {
			let contentType: string;

      try {
        // Attempt HEAD request first
        const headResponse = await axios.head(url, {
					headers,
					httpsAgent: new https.Agent({
						rejectUnauthorized: false // Disabling SSL certificate verification
					})
				 });
        contentType = headResponse.headers['content-type']  || 'default-content-type';
      } catch (headError) {
        // If HEAD request fails, fallback to GET request for just the first byte
        const getResponse = await axios.get(url, {
          headers: {
            ...headers,
            'Range': 'bytes=0-0',
          },
					httpsAgent: new https.Agent({
						rejectUnauthorized: false // Disabling SSL certificate verification
					})
        });
        contentType = getResponse.headers['content-type']  || 'default-content-type' ;
      }

      const extension = getExtensionFromContentType(contentType);
			let filePath: string;


      if (
        contentType === 'application/vnd.apple.mpegurl' ||
        contentType === 'application/x-mpegURL'
      ) {
				if (startSeconds === null && endSeconds !== null) {
          filePath = `downloads/${filename}(start,${endSeconds})${extension}`;
				}else if(endSeconds === null && startSeconds !== null){
          filePath = `downloads/${filename}(${startSeconds},end)${extension}`;
				}else if(startSeconds === null && endSeconds === null){
          filePath = `downloads/${filename}${extension}`;
        }else{
					filePath = `downloads/${filename}(${startSeconds},${endSeconds})${extension}`;
				}

        await handleM3U8Download( m3U8DownloadParams, uploadParams, resolve);
      } else {
				if (byteRange === null) {
					filePath = `downloads/${filename}${extension}`;
				}else{
					filePath = `downloads/${filename}(ByteRange:${byteRange})${extension}`;
				}
        // one object with all the params
        await handleGeneralDownload( generalDownloadParams, uploadParams, resolve);
      }

    } catch (err) {
      console.error('Error', err);
      resolve('failed');
    }
  });
};

const handleM3U8Download = async (
  params: M3U8DownloadParams,
  uploadParams: UploadParams,
  resolve: Function,
) => {
  try {
    const { url, headers, startSeconds, endSeconds } = params;
    const filePath = `./downloads/test.ts`;

    // Setting default values if not provided
    let startSegSeconds = startSeconds !== undefined ? startSeconds : 0;
    let endSegSeconds = endSeconds !== undefined ? endSeconds : Infinity;

    const m3u8Response = await axios.get(url, { headers });
    const m3u8Content = m3u8Response.data;
    const lines = m3u8Content.split('\n');
    const segmentDurations: number[] = [];
    const segmentUrls: string[] = [];

    let totalTime = 0;
    let startSegmentIndex = 0;
    let endSegmentIndex = Infinity; // Initialized to Infinity

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('#EXTINF:')) {
        const duration = parseFloat(lines[i].split(':')[1]);
        segmentDurations.push(duration);
        if (lines[i + 1] && !lines[i + 1].startsWith('#')) {
          segmentUrls.push(lines[i + 1]);
        }
        totalTime += duration;
        //Determining the start segment:
        if (totalTime <= startSegSeconds && totalTime + duration > startSegSeconds) {
          startSegmentIndex = segmentUrls.length - 1;
        }
        //Determining the end segment:
        if (endSegSeconds !== Infinity && totalTime <= endSegSeconds && totalTime + duration > endSegSeconds) {
          endSegmentIndex = segmentUrls.length - 1;
          break;
        }
      }
    }

    if (segmentUrls.length > 0) {
      const baseUrl = url.substring(0, url.lastIndexOf('/') + 1);
      const file = createWriteStream(filePath);

      for (const [index, segmentUrl] of segmentUrls.slice(startSegmentIndex, endSegmentIndex + 1).entries()) {
        const fullSegmentUrl = baseUrl + segmentUrl;
        const segmentResponse = await axios.get(fullSegmentUrl, {
          responseType: 'arraybuffer',
          headers,
        });
        const buffer = Buffer.from(segmentResponse.data, 'binary');
        file.write(buffer);
        console.log(`Downloaded segment ${index + 1} of ${segmentUrls.slice(startSegmentIndex, endSegmentIndex + 1).length}`);
      }

      file.end();


      file.on('finish', () => uploadToS3( uploadParams, resolve));
      file.on('error', (err) => handleFileError(err, resolve));
    } else {
      console.error('Segment URLs not found');
      resolve('failed');
    }

  } catch (error) {
    console.error('Error fetching M3U8 file:', error);
    resolve('failed');
  }
};



const handleGeneralDownload = async (
    params: GeneralDownloadParams,
    uploadParams: UploadParams,
    resolve: Function,
) => {
    const { url, headers, byteRange } = params;
    const filePath = './downloads/test.bin'
    axios({
        url: url,
        method: 'GET',
        responseType: 'stream',
				headers: {
					...headers,
					...(byteRange !== undefined ? { 'Range': `bytes=0-${byteRange - 1}` } : {}),
				},
				httpsAgent: new https.Agent({
					rejectUnauthorized: false // Disabling SSL certificate verification
				})
    })
        .then((response: AxiosResponse<any>) => {
            const file = createWriteStream(filePath);
            response.data.pipe(file);

            file.on('finish', () => uploadToS3( uploadParams, resolve));
            file.on('error', (err) => handleFileError(err, resolve));
        })
        .catch((err) => {
            handleDownloadError(err, resolve);
        });
};

const uploadToS3 = async (
   params: UploadParams,
   resolve: Function,
   ) => {
    const { destinationBucket } = params;

    const fileStream = createReadStream('./downloads/test.bin');

		const filename = 'test101';

    const uploadParams = {
        Bucket: destinationBucket,
        Key: 'tesing-for-downloader/' + filename,
        Body: fileStream,
    };

    try {
        const data = await s3.send(new PutObjectCommand(uploadParams));
        console.log('Upload success', data);
        resolve('Upload success');
    } catch (err) {
        handleFileError(err, resolve);
    }
};

const handleFileError = (err: any, resolve: Function) => {
    console.error('File error', err);
    resolve("failed");
};

const handleDownloadError = (err: any, resolve: Function) => {
    console.error('Download error', err);
    resolve('failed');
};

const getExtensionFromContentType = (contentType: string): string => {
  const contentTypeToFileExtension = {
    'default-content-type': '.bin', // Default extension
    'video/mp4': '.mp4',
    'video/x-matroska': '.mkv',
    'application/vnd.apple.mpegurl': '.ts',
    'application/x-mpegURL': '.ts',
    'video/webm': '.webm',
    'video/3gpp': '.3gp',
    'video/3gpp2': '.3g2',
    'video/ogg': '.ogv',
    'video/quicktime': '.mov',
    'video/x-msvideo': '.avi',
    'video/x-ms-wmv': '.wmv',
    'audio/mpeg': '.mp3',
    'audio/aac': '.aac',
    'audio/ogg': '.ogg',
    'audio/x-wav': '.wav',
    'audio/x-flac': '.flac',
    'audio/webm': '.weba',
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/tiff': '.tiff',
    'image/x-icon': '.ico',
    'application/pdf': '.pdf',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/vnd.ms-excel': '.xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    'application/vnd.ms-powerpoint': '.ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
    'text/csv': '.csv',
    'text/plain': '.txt',
    'application/zip': '.zip',
    'application/x-tar': '.tar',
    'application/x-gzip': '.gz',
    'application/x-rar-compressed': '.rar',
    'application/gzip': '.tar.gz',
    'application/x-7z-compressed': '.7z',
    'text/html': '.html',
  };

  return contentTypeToFileExtension[contentType] || '.bin';
};