// api/upload.js

import { google } from 'googleapis';
import formidable from 'formidable';
import fs from 'fs';

export const config = {
  api: {
    bodyParser: false,
  },
};

// ✅ credentials.json 파일을 읽어오기
const keyFile = JSON.parse(fs.readFileSync('./api/credentials.json', 'utf-8'));

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: keyFile.client_email,
    private_key: keyFile.private_key,
  },
  scopes: ['https://www.googleapis.com/auth/drive.file'],
});

const drive = google.drive({ version: 'v3', auth });

// ✅ Formidable 파일 파서 함수
function parseForm(req) {
  return new Promise((resolve, reject) => {
    const form = formidable({ multiples: true });
    form.parse(req, (err, fields, files) => {
      if (err) reject(err);
      else resolve([fields, files]);
    });
  });
}

// ✅ 메인 핸들러
export default async function handler(req, res) {
  // CORS 허용
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
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
          parents: [keyFile.folder_id], // 또는 직접 'GOOGLE_DRIVE_FOLDER_ID' 변수로 바꾸기
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
          downloadUrl: `https://drive.google.com/uc?id=${driveRes.data.id}&export=download`,
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
