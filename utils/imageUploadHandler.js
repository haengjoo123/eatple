/**
 * Image Upload Handler for Product Management
 * Handles image processing and storage for product images
 * Requirements: 2.1, 2.2, 7.2, 7.3
 */

const { supabaseAdmin } = require('./supabaseClient');
const crypto = require('crypto');
const path = require('path');
const sharp = require('sharp');

class ImageUploadHandler {
    constructor() {
        this.bucketName = 'product-images';
        this.maxFileSize = 5 * 1024 * 1024; // 5MB
        this.allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        this.allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
        
        // 이미지 크기 설정
        this.imageSizes = {
            thumbnail: { width: 150, height: 150 },
            medium: { width: 400, height: 400 },
            large: { width: 800, height: 800 }
        };

        this.initializeBucket();
    }

    /**
     * Supabase Storage 버킷 초기화
     * Requirements: 7.2
     */
    async initializeBucket() {
        try {
            // 버킷 존재 여부 확인
            const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets();
            
            if (listError) {
                console.error('Error listing buckets:', listError);
                return;
            }

            const bucketExists = buckets.some(bucket => bucket.name === this.bucketName);
            
            if (!bucketExists) {
                // 버킷 생성
                const { data, error } = await supabaseAdmin.storage.createBucket(this.bucketName, {
                    public: true,
                    allowedMimeTypes: this.allowedTypes,
                    fileSizeLimit: this.maxFileSize
                });
                
                if (error) {
                    console.error('Error creating product images bucket:', error);
                } else {
                    console.log('Product images bucket created successfully');
                }
            }
        } catch (error) {
            console.error('Bucket initialization error:', error);
        }
    }

    /**
     * 이미지 파일 검증
     * Requirements: 2.3
     */
    validateImageFile(file) {
        const errors = [];

        // 파일 존재 확인
        if (!file) {
            errors.push('이미지 파일이 필요합니다.');
            return errors;
        }

        // 파일 크기 확인
        if (file.size > this.maxFileSize) {
            errors.push(`파일 크기는 ${this.maxFileSize / (1024 * 1024)}MB를 초과할 수 없습니다.`);
        }

        // MIME 타입 확인
        if (!this.allowedTypes.includes(file.mimetype)) {
            errors.push('지원되지 않는 파일 형식입니다. (JPG, PNG, WebP, GIF만 허용)');
        }

        // 파일 확장자 확인
        const fileExtension = path.extname(file.originalname).toLowerCase();
        if (!this.allowedExtensions.includes(fileExtension)) {
            errors.push('지원되지 않는 파일 확장자입니다.');
        }

        // 파일명 길이 확인
        if (file.originalname.length > 255) {
            errors.push('파일명이 너무 깁니다.');
        }

        return errors;
    }

    /**
     * Express 요청에서 이미지 업로드 처리
     * Requirements: 2.1, 2.2, 7.2
     */
    async handleUpload(req, res) {
        try {
            if (!req.file) {
                throw new Error('이미지 파일이 필요합니다.');
            }

            const result = await this.uploadProductImage(req.file);
            return result.data;

        } catch (error) {
            console.error('ImageUploadHandler.handleUpload error:', error);
            throw error;
        }
    }

    /**
     * 이미지 업로드 및 처리
     * Requirements: 2.1, 2.2, 7.2
     */
    async uploadProductImage(file, productId = null) {
        try {
            // 파일 검증
            const validationErrors = this.validateImageFile(file);
            if (validationErrors.length > 0) {
                throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
            }

            // 고유한 파일명 생성
            const fileExtension = path.extname(file.originalname).toLowerCase();
            const fileName = this.generateFileName(file.originalname, fileExtension);
            
            // 이미지 처리 및 최적화
            const processedImages = await this.processImage(file.buffer, fileName);

            // Supabase Storage에 업로드
            const uploadResults = {};
            
            for (const [size, imageBuffer] of Object.entries(processedImages)) {
                const filePath = `${size}/${fileName}`;
                
                const { data, error } = await supabaseAdmin.storage
                    .from(this.bucketName)
                    .upload(filePath, imageBuffer, {
                        contentType: 'image/webp', // 최적화된 WebP 형식으로 저장
                        cacheControl: '3600',
                        upsert: false
                    });

                if (error) {
                    throw new Error(`Upload failed for ${size}: ${error.message}`);
                }

                uploadResults[size] = {
                    path: data.path,
                    fullPath: data.fullPath
                };
            }

            // 공개 URL 생성
            const publicUrls = {};
            for (const [size, result] of Object.entries(uploadResults)) {
                const { data } = supabaseAdmin.storage
                    .from(this.bucketName)
                    .getPublicUrl(result.path);
                
                publicUrls[size] = data.publicUrl;
            }

            return {
                success: true,
                data: {
                    fileName: fileName,
                    originalName: file.originalname,
                    sizes: uploadResults,
                    urls: publicUrls,
                    mainUrl: publicUrls.medium || publicUrls.large,
                    thumbnailUrl: publicUrls.thumbnail
                },
                message: '이미지가 성공적으로 업로드되었습니다.'
            };

        } catch (error) {
            console.error('ImageUploadHandler.uploadProductImage error:', error);
            throw error;
        }
    }

    /**
     * 이미지 처리 및 최적화
     * Requirements: 2.2, 7.3
     */
    async processImage(imageBuffer, fileName) {
        const processedImages = {};

        try {
            // Sharp 인스턴스 생성
            const image = sharp(imageBuffer);
            const metadata = await image.metadata();

            // 각 크기별로 이미지 처리
            for (const [sizeName, dimensions] of Object.entries(this.imageSizes)) {
                let processedImage = image.clone();

                // 리사이즈
                processedImage = processedImage.resize(dimensions.width, dimensions.height, {
                    fit: 'cover',
                    position: 'center'
                });

                // WebP 형식으로 변환 및 최적화
                const buffer = await processedImage
                    .webp({ 
                        quality: sizeName === 'thumbnail' ? 70 : 85,
                        effort: 4
                    })
                    .toBuffer();

                processedImages[sizeName] = buffer;
            }

            return processedImages;

        } catch (error) {
            console.error('Image processing error:', error);
            throw new Error('이미지 처리 중 오류가 발생했습니다.');
        }
    }

    /**
     * 고유한 파일명 생성
     * Requirements: 7.2
     */
    generateFileName(originalName, extension) {
        const timestamp = Date.now();
        const randomString = crypto.randomBytes(8).toString('hex');
        const baseName = path.basename(originalName, path.extname(originalName))
            .replace(/[^a-zA-Z0-9가-힣]/g, '_')
            .substring(0, 50);
        
        return `${timestamp}_${randomString}_${baseName}.webp`;
    }

    /**
     * API에서 이미지 삭제
     * Requirements: 7.2
     */
    async deleteImage(imageId) {
        try {
            // imageId를 imagePath로 처리 (실제로는 파일명이나 경로)
            const result = await this.deleteProductImage(imageId);
            return result.success;

        } catch (error) {
            console.error('ImageUploadHandler.deleteImage error:', error);
            throw error;
        }
    }

    /**
     * 이미지 삭제
     * Requirements: 7.2
     */
    async deleteProductImage(imagePath) {
        try {
            if (!imagePath) {
                return {
                    success: true,
                    message: '삭제할 이미지가 없습니다.'
                };
            }

            // 모든 크기의 이미지 삭제
            const deletePromises = [];
            
            for (const size of Object.keys(this.imageSizes)) {
                const filePath = `${size}/${path.basename(imagePath)}`;
                deletePromises.push(
                    supabaseAdmin.storage
                        .from(this.bucketName)
                        .remove([filePath])
                );
            }

            const results = await Promise.allSettled(deletePromises);
            
            // 실패한 삭제가 있는지 확인
            const failures = results.filter(result => result.status === 'rejected');
            if (failures.length > 0) {
                console.warn('Some image deletions failed:', failures);
            }

            return {
                success: true,
                message: '이미지가 삭제되었습니다.'
            };

        } catch (error) {
            console.error('ImageUploadHandler.deleteProductImage error:', error);
            throw error;
        }
    }

    /**
     * 여러 이미지 일괄 삭제
     * Requirements: 7.2
     */
    async deleteMultipleImages(imagePaths) {
        try {
            if (!Array.isArray(imagePaths) || imagePaths.length === 0) {
                return {
                    success: true,
                    message: '삭제할 이미지가 없습니다.'
                };
            }

            const deletePromises = imagePaths.map(imagePath => 
                this.deleteProductImage(imagePath)
            );

            const results = await Promise.allSettled(deletePromises);
            
            const successful = results.filter(result => 
                result.status === 'fulfilled' && result.value.success
            ).length;

            return {
                success: true,
                data: {
                    total: imagePaths.length,
                    successful: successful,
                    failed: imagePaths.length - successful
                },
                message: `${successful}개 이미지가 삭제되었습니다.`
            };

        } catch (error) {
            console.error('ImageUploadHandler.deleteMultipleImages error:', error);
            return {
                success: false,
                error: error.message,
                message: '이미지 일괄 삭제에 실패했습니다.'
            };
        }
    }

    /**
     * 이미지 URL 생성
     * Requirements: 7.2
     */
    getImageUrl(imagePath, size = 'medium') {
        if (!imagePath) {
            return null;
        }

        try {
            const filePath = `${size}/${path.basename(imagePath)}`;
            const { data } = supabaseAdmin.storage
                .from(this.bucketName)
                .getPublicUrl(filePath);
            
            return data.publicUrl;

        } catch (error) {
            console.error('Error generating image URL:', error);
            return null;
        }
    }

    /**
     * 이미지 존재 여부 확인
     * Requirements: 7.2
     */
    async checkImageExists(imagePath) {
        try {
            if (!imagePath) {
                return false;
            }

            const filePath = `medium/${path.basename(imagePath)}`;
            const { data, error } = await supabaseAdmin.storage
                .from(this.bucketName)
                .list('medium', {
                    search: path.basename(imagePath)
                });

            if (error) {
                console.error('Error checking image existence:', error);
                return false;
            }

            return data && data.length > 0;

        } catch (error) {
            console.error('ImageUploadHandler.checkImageExists error:', error);
            return false;
        }
    }

    /**
     * 이미지 메타데이터 조회
     * Requirements: 7.2
     */
    async getImageMetadata(imagePath) {
        try {
            if (!imagePath) {
                return null;
            }

            const filePath = `medium/${path.basename(imagePath)}`;
            const { data, error } = await supabaseAdmin.storage
                .from(this.bucketName)
                .download(filePath);

            if (error) {
                throw new Error(`Download failed: ${error.message}`);
            }

            const buffer = Buffer.from(await data.arrayBuffer());
            const metadata = await sharp(buffer).metadata();

            return {
                success: true,
                data: {
                    width: metadata.width,
                    height: metadata.height,
                    format: metadata.format,
                    size: buffer.length,
                    hasAlpha: metadata.hasAlpha
                }
            };

        } catch (error) {
            console.error('ImageUploadHandler.getImageMetadata error:', error);
            return {
                success: false,
                error: error.message,
                message: '이미지 메타데이터 조회에 실패했습니다.'
            };
        }
    }

    /**
     * 스토리지 사용량 조회
     * Requirements: 7.2
     */
    async getStorageUsage() {
        try {
            const { data, error } = await supabaseAdmin.storage
                .from(this.bucketName)
                .list('', {
                    limit: 1000,
                    sortBy: { column: 'created_at', order: 'desc' }
                });

            if (error) {
                throw new Error(`Storage list failed: ${error.message}`);
            }

            let totalSize = 0;
            let fileCount = 0;

            // 재귀적으로 모든 파일 크기 계산
            const calculateSize = async (prefix = '') => {
                const { data: files, error } = await supabaseAdmin.storage
                    .from(this.bucketName)
                    .list(prefix);

                if (error) return;

                for (const file of files) {
                    if (file.metadata) {
                        totalSize += file.metadata.size || 0;
                        fileCount++;
                    }
                }
            };

            // 각 크기별 폴더 확인
            for (const size of Object.keys(this.imageSizes)) {
                await calculateSize(size);
            }

            return {
                success: true,
                data: {
                    totalSize: totalSize,
                    fileCount: fileCount,
                    formattedSize: this.formatBytes(totalSize)
                }
            };

        } catch (error) {
            console.error('ImageUploadHandler.getStorageUsage error:', error);
            return {
                success: false,
                error: error.message,
                message: '스토리지 사용량 조회에 실패했습니다.'
            };
        }
    }

    /**
     * 바이트를 읽기 쉬운 형식으로 변환
     */
    formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';

        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }
}

module.exports = ImageUploadHandler;