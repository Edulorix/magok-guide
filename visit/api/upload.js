// api/upload.js

import { google } from 'googleapis';
import formidable from 'formidable';
import fs from 'fs';

export const config = {
  api: {
    bodyParser: false, // FormData 직접 파싱을 위해 비활성화
  },
};

// FormData 파싱을 Promise로 래핑
function parseForm(req) {
  return new Promise((resolve, reject) => {
    const form = formidable({
      maxFileSize: 100 * 1024 * 1024, // 100MB
      keepExtensions: true,
      allowEmptyFiles: false,
      multiples: true,
    });

    form.parse(req, (err, fields, files) => {
      if (err) return reject(err);
      resolve([fields, files]);
    });
  });
}

export default async function handler(req, res) {
  // CORS 헤더 추가
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // 환경 변수 확인
    const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY;
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

    if (!serviceAccountEmail || !privateKey || !folderId) {
      return res.status(500).json({ error: '서버 설정이 완료되지 않았습니다.' });
    }

    // Google 인증
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: serviceAccountEmail,
        private_key: privateKey.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    });

    const drive = google.drive({ version: 'v3', auth });

    // 파일 파싱
    const [fields, files] = await parseForm(req);
    if (!files || Object.keys(files).length === 0) {
      return res.status(400).json({ success: false, error: '업로드된 파일이 없습니다.' });
    }

    const uploadedFiles = [];

    for (const [key, fileData] of Object.entries(files)) {
      const fileList = Array.isArray(fileData) ? fileData : [fileData];

      for (const file of fileList) {
        const fileMetadata = {
          name: file.originalFilename,
          parents: [folderId],
        };
        const media = {
          mimeType: file.mimetype,
          body: fs.createReadStream(file.filepath),
        };

        const driveRes = await drive.files.create({
          resource: fileMetadata,
          media,
          fields: 'id, name',
        });

        const size = fs.statSync(file.filepath).size;

        uploadedFiles.push({
          name: driveRes.data.name,
          id: driveRes.data.id,
          size: size,
          downloadUrl: `https://drive.google.com/uc?id=${driveRes.data.id}&export=download`
        });
      }
    }

    return res.status(200).json({ success: true, files: uploadedFiles });

  } catch (err) {
    console.error('Upload error:', err);
    return res.status(500).json({
      success: false,
      error: '파일 업로드 중 오류 발생',
      details: err.message || err.toString(),
    });
  }
}
