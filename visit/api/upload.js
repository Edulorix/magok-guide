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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 환경변수 확인
    const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY;
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

    if (!serviceAccountEmail || !privateKey || !folderId) {
      console.error('Missing environment variables:', {
        hasEmail: !!serviceAccountEmail,
        hasKey: !!privateKey,
        hasFolderId: !!folderId
      });
      return res.status(500).json({ 
        error: '서버 설정이 완료되지 않았습니다.',
        details: 'Google Drive API 인증 정보가 설정되지 않았습니다.'
      });
    }

    // Google Drive 인증
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: serviceAccountEmail,
        private_key: privateKey.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    });

    const drive = google.drive({ version: 'v3', auth });

    // 폼 데이터 파싱
    const form = formidable({
      maxFileSize: 100 * 1024 * 1024, // 100MB
      keepExtensions: true,
      allowEmptyFiles: false,
      maxFields: 20,
      maxFieldsSize: 2 * 1024 * 1024, // 2MB
    });

    const [fields, files] = await form.parse(req);
    const uploadedFiles = [];

    // 파일 업로드 처리
    for (const [key, fileArray] of Object.entries(files)) {
      const fileList = Array.isArray(fileArray) ? fileArray : [fileArray];
      
      for (const file of fileList) {
        try {
          // 파일 유효성 검사
          if (!file.originalFilename && !file.newFilename) {
            console.warn('파일명이 없는 파일 건너뜀');
            continue;
          }

          // 파일 스트림 확인
          if (!fs.existsSync(file.filepath)) {
            console.error('임시 파일이 존재하지 않음:', file.filepath);
            continue;
          }

          // 파일 업로드
          const response = await drive.files.create({
            requestBody: {
              name: file.originalFilename || file.newFilename,
              parents: [folderId],
            },
            media: {
              mimeType: file.mimetype || 'application/octet-stream',
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
          try {
            fs.unlinkSync(file.filepath);
          } catch (cleanupError) {
            console.warn('임시 파일 삭제 실패:', cleanupError.message);
          }
        } catch (fileError) {
          console.error('개별 파일 업로드 오류:', fileError);
        }
      }
    }

    if (uploadedFiles.length === 0) {
      return res.status(400).json({
        success: false,
        error: '업로드된 파일이 없습니다.',
        details: '유효한 파일을 선택해주세요.'
      });
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
      details: process.env.NODE_ENV === 'development' ? error.message : '서버 내부 오류가 발생했습니다.'
    });
  }
}
