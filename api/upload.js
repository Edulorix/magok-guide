import { google } from 'googleapis';
import formidable from 'formidable';
import fs from 'fs';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    console.log('Upload function started');
    
    // Base64에서 Private Key 디코딩
    if (!process.env.GOOGLE_PRIVATE_KEY) {
  console.error('GOOGLE_PRIVATE_KEY environment variable is missing');
  res.status(500).json({ error: 'Server configuration error: Missing private key' });
  return;
}
const privateKey = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');
    
    const auth = new google.auth.GoogleAuth({
      credentials: {
        type: 'service_account',
        project_id: process.env.GOOGLE_PROJECT_ID,
        private_key: privateKey,
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
      },
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    });

    const drive = google.drive({ version: 'v3', auth });
    console.log('Google Drive authentication successful');

    // 나머지 코드는 동일...
    const form = formidable({
      maxFileSize: 50 * 1024 * 1024,
      keepExtensions: true,
    });

    const [fields, files] = await form.parse(req);
    const uploadedFiles = [];

    for (const [fieldName, fileArray] of Object.entries(files)) {
      const file = Array.isArray(fileArray) ? fileArray[0] : fileArray;
      if (!file) continue;

      const fileMetadata = {
        name: file.originalFilename || file.newFilename,
        parents: ['1xUFv6QUqsAiGPfmC4mzXry5pQ-6BRGN_'], // 실제 폴더 ID로 변경
      };

      const media = {
        mimeType: file.mimetype,
        body: fs.createReadStream(file.filepath),
      };

      const response = await drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: 'id, name, webViewLink',
      });

      uploadedFiles.push({
        id: response.data.id,
        name: response.data.name,
        link: response.data.webViewLink,
      });
    }

    res.status(200).json({
      success: true,
      message: 'Files uploaded successfully',
      files: uploadedFiles,
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ 
      error: 'Upload failed',
      details: error.message 
    });
  }
}
