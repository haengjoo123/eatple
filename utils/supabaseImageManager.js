const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const path = require('path');

class SupabaseImageManager {
    constructor() {
        this.supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );
        
        this.bucketName = 'nutrition-images';
        this.maxFileSize = 5 * 1024 * 1024; // 5MB
        this.allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        
        this.initializeBucket();
    }

    /**
     * Supabase Storage 버킷 초기화
     */
    async initializeBucket() {
        try {
            // 버킷 존재 여부 확인
            const { data: buckets, error: listError } = await this.supabase.storage.listBuckets();
            
            if (listError) {
                console.error('Error listing buckets:', listError);
                return;
            }

            const bucketExists = buckets.some(bucket => bucket.name === this.bucketName);
            
            if (!bucketExists) {
                // 버킷 생성
                const { data, error } = await this.supabase.storage.createBucket(this.bucketName, {
                    public: true,
                    allowedMimeTypes: this.allowedTypes,
                    fileSizeLimit: this.maxFileSize
                });
                
                if (error) {
                    console.error('Error creating bucket:', error);
                } else {
                    console.log('Nutrition images bucket created successfully');
                }
            }
        } catch (error) {
            console.error('Bucket initialization error:', error);
        }
    }

    /**
     * 이미지 파일 업로드
     * @param {Buffer} fileBuffer - 이미지 파일 버퍼
     * @param {string} originalName - 원본 파일명
     * @param {string} mimeType - MIME 타입
     * @param {string} folder - 업로드할 폴더 (기본값: 'posts')
     * @returns {Object} 업로드 결과 { success, url, error }
     */
    async uploadImage(fileBuffer, originalName, mimeType, folder = 'posts') {
        try {
            // 파일 유효성 검증
            const validation = this.validateFile(fileBuffer, mimeType);
            if (!validation.valid) {
                return { success: false, error: validation.error };
            }

            // 고유한 파일명 생성
            const fileName = this.generateUniqueFileName(originalName);
            const filePath = `${folder}/${fileName}`;

            // Supabase Storage에 업로드
            const { data, error } = await this.supabase.storage
                .from(this.bucketName)
                .upload(filePath, fileBuffer, {
                    contentType: mimeType,
                    cacheControl: '3600',
                    upsert: false
                });

            if (error) {
                console.error('Supabase upload error:', error);
                return { success: false, error: 'Failed to upload image to storage' };
            }

            // 공개 URL 생성
            const { data: urlData } = this.supabase.storage
                .from(this.bucketName)
                .getPublicUrl(filePath);

            return {
                success: true,
                url: urlData.publicUrl,
                fileName: fileName,
                filePath: filePath
            };

        } catch (error) {
            console.error('Image upload error:', error);
            return { success: false, error: 'Internal server error during image upload' };
        }
    }

    /**
     * 이미지 파일 삭제
     * @param {string} filePath - 삭제할 파일 경로
     * @returns {Object} 삭제 결과 { success, error }
     */
    async deleteImage(filePath) {
        try {
            const { data, error } = await this.supabase.storage
                .from(this.bucketName)
                .remove([filePath]);

            if (error) {
                console.error('Supabase delete error:', error);
                return { success: false, error: 'Failed to delete image from storage' };
            }

            return { success: true };

        } catch (error) {
            console.error('Image delete error:', error);
            return { success: false, error: 'Internal server error during image deletion' };
        }
    }

    /**
     * 이미지 파일 유효성 검증
     * @param {Buffer} fileBuffer - 파일 버퍼
     * @param {string} mimeType - MIME 타입
     * @returns {Object} 검증 결과 { valid, error }
     */
    validateFile(fileBuffer, mimeType) {
        // 파일 크기 검증
        if (fileBuffer.length > this.maxFileSize) {
            return {
                valid: false,
                error: `File size exceeds maximum limit of ${this.maxFileSize / (1024 * 1024)}MB`
            };
        }

        // MIME 타입 검증
        if (!this.allowedTypes.includes(mimeType)) {
            return {
                valid: false,
                error: `File type ${mimeType} is not allowed. Allowed types: ${this.allowedTypes.join(', ')}`
            };
        }

        // 파일 시그니처 검증 (기본적인 검증)
        const isValidImage = this.validateImageSignature(fileBuffer, mimeType);
        if (!isValidImage) {
            return {
                valid: false,
                error: 'Invalid image file or corrupted data'
            };
        }

        return { valid: true };
    }

    /**
     * 이미지 파일 시그니처 검증
     * @param {Buffer} buffer - 파일 버퍼
     * @param {string} mimeType - MIME 타입
     * @returns {boolean} 유효성 여부
     */
    validateImageSignature(buffer, mimeType) {
        if (buffer.length < 4) return false;

        const signatures = {
            'image/jpeg': [0xFF, 0xD8, 0xFF],
            'image/png': [0x89, 0x50, 0x4E, 0x47],
            'image/gif': [0x47, 0x49, 0x46],
            'image/webp': [0x52, 0x49, 0x46, 0x46] // RIFF header for WebP
        };

        const signature = signatures[mimeType];
        if (!signature) return false;

        for (let i = 0; i < signature.length; i++) {
            if (buffer[i] !== signature[i]) {
                return false;
            }
        }

        return true;
    }

    /**
     * 고유한 파일명 생성
     * @param {string} originalName - 원본 파일명
     * @returns {string} 고유한 파일명
     */
    generateUniqueFileName(originalName) {
        const timestamp = Date.now();
        const randomString = crypto.randomBytes(8).toString('hex');
        const extension = path.extname(originalName).toLowerCase();
        const baseName = path.basename(originalName, extension)
            .replace(/[^a-zA-Z0-9]/g, '_')
            .substring(0, 20);

        return `${baseName}_${timestamp}_${randomString}${extension}`;
    }

    /**
     * 이미지 최적화 (향후 구현)
     * @param {Buffer} imageBuffer - 이미지 버퍼
     * @param {Object} options - 최적화 옵션
     * @returns {Buffer} 최적화된 이미지 버퍼
     */
    async optimizeImage(imageBuffer, options = {}) {
        // TODO: Sharp 라이브러리를 사용한 이미지 최적화
        // - 리사이징
        // - 압축
        // - 포맷 변환
        // - 워터마크 추가 등
        
        return imageBuffer;
    }

    /**
     * 이미지 메타데이터 추출
     * @param {Buffer} imageBuffer - 이미지 버퍼
     * @returns {Object} 메타데이터
     */
    async extractMetadata(imageBuffer) {
        // TODO: 이미지 메타데이터 추출
        // - 크기 (width, height)
        // - 파일 크기
        // - 색상 정보
        // - EXIF 데이터 등
        
        return {
            size: imageBuffer.length,
            width: null,
            height: null,
            format: null
        };
    }

    /**
     * 썸네일 생성
     * @param {Buffer} imageBuffer - 원본 이미지 버퍼
     * @param {Object} options - 썸네일 옵션
     * @returns {Buffer} 썸네일 이미지 버퍼
     */
    async generateThumbnail(imageBuffer, options = { width: 300, height: 200 }) {
        // TODO: Sharp를 사용한 썸네일 생성
        // const sharp = require('sharp');
        // return await sharp(imageBuffer)
        //     .resize(options.width, options.height, { fit: 'cover' })
        //     .jpeg({ quality: 80 })
        //     .toBuffer();
        
        return imageBuffer;
    }

    /**
     * 이미지 URL에서 파일 경로 추출
     * @param {string} imageUrl - 이미지 URL
     * @returns {string} 파일 경로
     */
    extractFilePathFromUrl(imageUrl) {
        try {
            const url = new URL(imageUrl);
            const pathParts = url.pathname.split('/');
            const bucketIndex = pathParts.indexOf(this.bucketName);
            
            if (bucketIndex !== -1 && bucketIndex < pathParts.length - 1) {
                return pathParts.slice(bucketIndex + 1).join('/');
            }
            
            return null;
        } catch (error) {
            console.error('Error extracting file path from URL:', error);
            return null;
        }
    }

    /**
     * 이미지 존재 여부 확인
     * @param {string} filePath - 파일 경로
     * @returns {boolean} 존재 여부
     */
    async imageExists(filePath) {
        try {
            const { data, error } = await this.supabase.storage
                .from(this.bucketName)
                .list(path.dirname(filePath), {
                    search: path.basename(filePath)
                });

            if (error) {
                console.error('Error checking image existence:', error);
                return false;
            }

            return data && data.length > 0;
        } catch (error) {
            console.error('Error checking image existence:', error);
            return false;
        }
    }

    /**
     * 이미지 다운로드
     * @param {string} filePath - 파일 경로
     * @returns {Object} 다운로드 결과 { success, data, error }
     */
    async downloadImage(filePath) {
        try {
            const { data, error } = await this.supabase.storage
                .from(this.bucketName)
                .download(filePath);

            if (error) {
                console.error('Supabase download error:', error);
                return { success: false, error: 'Failed to download image' };
            }

            return { success: true, data };

        } catch (error) {
            console.error('Image download error:', error);
            return { success: false, error: 'Internal server error during image download' };
        }
    }

    /**
     * 이미지 목록 조회
     * @param {string} folder - 폴더 경로 (기본값: 'posts')
     * @param {Object} options - 조회 옵션
     * @returns {Object} 조회 결과 { success, files, error }
     */
    async listImages(folder = 'posts', options = {}) {
        try {
            const { data, error } = await this.supabase.storage
                .from(this.bucketName)
                .list(folder, {
                    limit: options.limit || 100,
                    offset: options.offset || 0,
                    sortBy: { column: 'created_at', order: 'desc' }
                });

            if (error) {
                console.error('Supabase list error:', error);
                return { success: false, error: 'Failed to list images' };
            }

            // 공개 URL 추가
            const filesWithUrls = data.map(file => {
                const { data: urlData } = this.supabase.storage
                    .from(this.bucketName)
                    .getPublicUrl(`${folder}/${file.name}`);
                
                return {
                    ...file,
                    publicUrl: urlData.publicUrl
                };
            });

            return { success: true, files: filesWithUrls };

        } catch (error) {
            console.error('Image list error:', error);
            return { success: false, error: 'Internal server error during image listing' };
        }
    }
}

module.exports = SupabaseImageManager;