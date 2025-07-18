import { google } from 'googleapis';
import formidable from 'formidable';
import fs from 'fs';

// API 설정
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
  
  // OPTIONS 요청 처리 (CORS Preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // POST 요청만 허용
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Only POST method is allowed' 
    });
  }

  try {
    console.log('Upload function started');
    
    // 환경변수 확인
    if (!process.env.GOOGLE_PROJECT_ID || !process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
      throw new Error('Missing required environment variables');
    }

    // Google Drive 인증 설정
    const auth = new google.auth.GoogleAuth({
      credentials: {
        type: 'service_account',
        project_id: process.env.GOOGLE_PROJECT_ID,
        private_key: process.env.GOOGLE_PRIVATE_KEY.split('\\n').join('\n'),
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
      },
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    });

    const drive = google.drive({ version: 'v3', auth });
    console.log('Google Drive authenticated');

    // 파일 파싱 설정
    const form = formidable({
      multiples: true,
      maxFileSize: 50 * 1024 * 1024, // 50MB
      keepExtensions: true,
    });

    // 파일 파싱
    const [fields, files] = await form.parse(req);
    console.log('Files parsed:', Object.keys(files));
    
    if (!files || Object.keys(files).length === 0) {
      return res.status(400).json({ 
        error: 'No files uploaded',
        message: 'Please select files to upload' 
      });
    }

    const uploadedFiles = [];
    
    // 각 파일 업로드 처리
    for (const [fieldName, fileArray] of Object.entries(files)) {
      const fileList = Array.isArray(fileArray) ? fileArray : [fileArray];
      
      for (const file of fileList) {
        if (!file || !file.filepath) continue;

        console.log(`Uploading file: ${file.originalFilename || file.newFilename}`);

        // Google Drive 폴더 ID (실제 폴더 ID로 변경 필요)
        const folderId = '1your-google-drive-folder-id'; // ← 실제 폴더 ID로 변경

        const fileMetadata = {
          name: file.originalFilename || file.newFilename,
          parents: [folderId], // 폴더 ID 설정
        };

        const media = {
          mimeType: file.mimetype || 'application/octet-stream',
          body: fs.createReadStream(file.filepath),
        };

        try {
          const response = await drive.files.create({
            resource: fileMetadata,
            media: media,
            fields: 'id, name, webViewLink, webContentLink',
          });

          console.log(`File uploaded successfully: ${response.data.name}`);

          uploadedFiles.push({
            id: response.data.id,
            name: response.data.name,
            viewLink: response.data.webViewLink,
            downloadLink: response.data.webContentLink,
            size: file.size,
            type: file.mimetype,
          });

          // 임시 파일 삭제
          if (fs.existsSync(file.filepath)) {
            fs.unlinkSync(file.filepath);
          }

        } catch (uploadError) {
          console.error(`Upload error for ${file.originalFilename}:`, uploadError);
          throw uploadError;
        }
      }
    }

    // 성공 응답
    const response = {
      success: true,
      message: 'Files uploaded successfully',
      files: uploadedFiles,
      count: uploadedFiles.length,
      timestamp: new Date().toISOString(),
    };

    console.log('Upload completed successfully:', response);
    return res.status(200).json(response);

  } catch (error) {
    console.error('Upload function error:', error);
    
    // 에러 응답
    const errorResponse = {
      success: false,
      error: 'Upload failed',
      message: error.message || 'Unknown error occurred',
      timestamp: new Date().toISOString(),
    };

    return res.status(500).json(errorResponse);
  }
}
