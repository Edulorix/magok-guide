import { google } from 'googleapis';
import formidable from 'formidable';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Google Drive 인증
    const auth = new google.auth.GoogleAuth({
      credentials: {
        type: 'service_account',
        project_id: process.env.GOOGLE_PROJECT_ID,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
      },
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    });

    const drive = google.drive({ version: 'v3', auth });

    // 파일 파싱
    const form = formidable({
      maxFileSize: 50 * 1024 * 1024, // 50MB
      keepExtensions: true,
    });

    const [fields, files] = await form.parse(req);
    
    const uploadedFiles = [];
    
    // 파일 업로드 처리
    for (const [fieldName, fileArray] of Object.entries(files)) {
      const file = Array.isArray(fileArray) ? fileArray[0] : fileArray;
      
      if (!file) continue;

      const fileMetadata = {
        name: file.originalFilename || file.newFilename,
        parents: ['1your-google-drive-folder-id'], // 실제 폴더 ID로 변경
      };

      const media = {
        mimeType: file.mimetype,
        body: require('fs').createReadStream(file.filepath),
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
