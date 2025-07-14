import { google } from 'googleapis';
import formidable from 'formidable';
import fs from 'fs';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  // CORS 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 환경변수 확인
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
      return res.status(500).json({ error: '환경변수가 설정되지 않았습니다.' });
    }

    // Google Drive 인증
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    });

    const drive = google.drive({ version: 'v3', auth });

    // 폼 데이터 파싱
    const form = formidable({
      maxFileSize: 50 * 1024 * 1024, // 50MB
      keepExtensions: true,
    });

    const [fields, files] = await form.parse(req);
    const uploadedFiles = [];

    // 파일 업로드 처리
    for (const [key, fileArray] of Object.entries(files)) {
      const fileList = Array.isArray(fileArray) ? fileArray : [fileArray];
      
      for (const file of fileList) {
        try {
          // 파일 업로드
          const response = await drive.files.create({
            requestBody: {
              name: file.originalFilename || file.newFilename,
              parents: ['1BcD2EfG3HiJ4KlM5NoPqR6StU7VwX8Yz'], // 여기에 실제 폴더 ID 입력
            },
            media: {
              mimeType: file.mimetype,
              body: fs.createReadStream(file.filepath),
            },
          });

          // 공개 공유 설정
          await drive.permissions.create({
            fileId: response.data.id,
            requestBody: {
              role: 'reader',
              type: 'anyone',
            },
          });

          // 다운로드 링크 생성
          const downloadUrl = `https://drive.google.com/uc?export=download&id=${response.data.id}`;
          const viewUrl = `https://drive.google.com/file/d/${response.data.id}/view`;

          uploadedFiles.push({
            id: response.data.id,
            name: file.originalFilename || file.newFilename,
            size: file.size,
            downloadUrl: downloadUrl,
            viewUrl: viewUrl,
          });

          // 임시 파일 삭제
          fs.unlinkSync(file.filepath);
        } catch (error) {
          console.error('파일 업로드 오류:', error);
          throw error;
        }
      }
    }

    res.status(200).json({
      success: true,
      files: uploadedFiles,
      message: `${uploadedFiles.length}개 파일이 성공적으로 업로드되었습니다.`,
    });

  } catch (error) {
    console.error('서버 오류:', error);
    res.status(500).json({ 
      error: '파일 업로드 실패',
      details: error.message 
    });
  }
}
