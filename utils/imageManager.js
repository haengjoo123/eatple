const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class ImageManager {
    constructor() {
        this.imageDirectory = path.join(__dirname, '..', 'public', 'images', 'nutrition');
        this.baseUrl = '/images/nutrition';
        
        // 영양 카테고리별 기본 이미지 매핑
        this.categoryImages = {
            'diet': 'diet-default.jpg',
            'supplements': 'supplements-default.jpg',
            'research': 'research-default.jpg',
            'trends': 'trends-default.jpg',
            'vitamins': 'vitamins-default.jpg',
            'minerals': 'minerals-default.jpg',
            'protein': 'protein-default.jpg',
            'carbohydrates': 'carbs-default.jpg',
            'fats': 'fats-default.jpg',
            'general': 'nutrition-default.jpg'
        };

        // 키워드별 이미지 매핑
        this.keywordImages = {
            '비타민': 'vitamins-default.jpg',
            '단백질': 'protein-default.jpg',
            '칼슘': 'calcium-default.jpg',
            '철분': 'iron-default.jpg',
            '오메가3': 'omega3-default.jpg',
            '프로바이오틱스': 'probiotics-default.jpg',
            '다이어트': 'diet-default.jpg',
            '운동': 'exercise-nutrition.jpg',
            '면역': 'immunity-default.jpg',
            '뼈건강': 'bone-health.jpg'
        };

        this.initializeImageDirectory();
    }

    /**
     * 이미지 디렉토리 초기화
     */
    async initializeImageDirectory() {
        try {
            await fs.mkdir(this.imageDirectory, { recursive: true });
            await this.createDefaultImages();
        } catch (error) {
            console.error('Image directory initialization error:', error);
        }
    }

    /**
     * 기본 이미지들 생성 (SVG 플레이스홀더)
     */
    async createDefaultImages() {
        const defaultImages = [
            ...Object.values(this.categoryImages),
            ...Object.values(this.keywordImages)
        ];

        const uniqueImages = [...new Set(defaultImages)];

        for (const imageName of uniqueImages) {
            const imagePath = path.join(this.imageDirectory, imageName);
            
            try {
                await fs.access(imagePath);
                // 파일이 이미 존재하면 건너뛰기
                continue;
            } catch {
                // 파일이 없으면 생성
                const svgContent = this.generatePlaceholderSVG(imageName);
                await fs.writeFile(imagePath.replace('.jpg', '.svg'), svgContent);
            }
        }
    }

    /**
     * 콘텐츠에 적합한 이미지 생성 또는 선택
     * @param {Object} content - 콘텐츠 객체
     * @returns {string} 이미지 URL
     */
    async generateOrSelectImage(content) {
        try {
            const { title, summary, tags, category } = content;
            
            // 1. AI 이미지 생성 시도 (현재는 플레이스홀더)
            const aiImageUrl = await this.generateAIImage(content);
            if (aiImageUrl) {
                return aiImageUrl;
            }

            // 2. 키워드 기반 이미지 선택
            const keywordImage = this.selectImageByKeywords(title, summary, tags);
            if (keywordImage) {
                return `${this.baseUrl}/${keywordImage}`;
            }

            // 3. 카테고리 기반 이미지 선택
            const categoryImage = this.selectImageByCategory(category);
            if (categoryImage) {
                return `${this.baseUrl}/${categoryImage}`;
            }

            // 4. 기본 이미지 반환
            return `${this.baseUrl}/nutrition-default.svg`;

        } catch (error) {
            console.error('Image generation/selection error:', error);
            return `${this.baseUrl}/nutrition-default.svg`;
        }
    }

    /**
     * AI 기반 이미지 생성 (현재는 플레이스홀더, 향후 확장 가능)
     * @param {Object} content - 콘텐츠 객체
     * @returns {string|null} 생성된 이미지 URL 또는 null
     */
    async generateAIImage(content) {
        // TODO: 실제 AI 이미지 생성 API 연동 (DALL-E, Midjourney 등)
        // 현재는 null 반환하여 다른 방법으로 이미지 선택하도록 함
        
        try {
            // 향후 AI 이미지 생성 로직 구현 예시:
            // const prompt = this.buildImagePrompt(content);
            // const imageUrl = await this.callImageGenerationAPI(prompt);
            // return imageUrl;
            
            return null;
        } catch (error) {
            console.error('AI image generation error:', error);
            return null;
        }
    }

    /**
     * 키워드 기반 이미지 선택
     * @param {string} title - 제목
     * @param {string} summary - 요약
     * @param {Array} tags - 태그 배열
     * @returns {string|null} 선택된 이미지 파일명
     */
    selectImageByKeywords(title = '', summary = '', tags = []) {
        const allText = [title, summary, ...tags].join(' ').toLowerCase();
        
        // 키워드 우선순위에 따라 이미지 선택
        for (const [keyword, imageName] of Object.entries(this.keywordImages)) {
            if (allText.includes(keyword.toLowerCase())) {
                return imageName.replace('.jpg', '.svg');
            }
        }
        
        return null;
    }

    /**
     * 카테고리 기반 이미지 선택
     * @param {string} category - 카테고리
     * @returns {string|null} 선택된 이미지 파일명
     */
    selectImageByCategory(category) {
        if (category && this.categoryImages[category]) {
            return this.categoryImages[category].replace('.jpg', '.svg');
        }
        return null;
    }



    /**
     * SVG 플레이스홀더 이미지 생성
     * @param {string} imageName - 이미지 파일명
     * @returns {string} SVG 콘텐츠
     */
    generatePlaceholderSVG(imageName) {
        const category = imageName.replace('-default.jpg', '').replace('.jpg', '');
        const colors = this.getCategoryColors(category);
        const icon = this.getCategoryIcon(category);
        
        return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
    <defs>
        <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:${colors.primary};stop-opacity:1" />
            <stop offset="100%" style="stop-color:${colors.secondary};stop-opacity:1" />
        </linearGradient>
    </defs>
    <rect width="400" height="300" fill="url(#grad1)" />
    <text x="200" y="120" font-family="Arial, sans-serif" font-size="48" fill="white" text-anchor="middle">${icon}</text>
    <text x="200" y="180" font-family="Arial, sans-serif" font-size="24" fill="white" text-anchor="middle" opacity="0.9">${this.getCategoryTitle(category)}</text>
    <text x="200" y="220" font-family="Arial, sans-serif" font-size="16" fill="white" text-anchor="middle" opacity="0.7">영양 정보</text>
</svg>`;
    }

    /**
     * 카테고리별 색상 반환
     * @param {string} category - 카테고리
     * @returns {Object} 색상 객체
     */
    getCategoryColors(category) {
        const colorMap = {
            'diet': { primary: '#4CAF50', secondary: '#2E7D32' },
            'supplements': { primary: '#FF9800', secondary: '#F57C00' },
            'research': { primary: '#2196F3', secondary: '#1565C0' },
            'trends': { primary: '#E91E63', secondary: '#C2185B' },
            'vitamins': { primary: '#FFC107', secondary: '#F57F17' },
            'minerals': { primary: '#795548', secondary: '#5D4037' },
            'protein': { primary: '#F44336', secondary: '#D32F2F' },
            'carbs': { primary: '#FFEB3B', secondary: '#F9A825' },
            'fats': { primary: '#9C27B0', secondary: '#7B1FA2' },
            'exercise': { primary: '#FF5722', secondary: '#D84315' },
            'immunity': { primary: '#00BCD4', secondary: '#0097A7' },
            'bone': { primary: '#607D8B', secondary: '#455A64' }
        };
        
        return colorMap[category] || { primary: '#4CAF50', secondary: '#2E7D32' };
    }

    /**
     * 카테고리별 아이콘 반환
     * @param {string} category - 카테고리
     * @returns {string} 아이콘 문자
     */
    getCategoryIcon(category) {
        const iconMap = {
            'diet': '🥗',
            'supplements': '💊',
            'research': '🔬',
            'trends': '📈',
            'vitamins': '🍊',
            'minerals': '⚡',
            'protein': '🥩',
            'carbs': '🍞',
            'fats': '🥑',
            'exercise': '💪',
            'immunity': '🛡️',
            'bone': '🦴',
            'calcium': '🥛',
            'iron': '🩸',
            'omega3': '🐟',
            'probiotics': '🦠'
        };
        
        return iconMap[category] || '🍎';
    }

    /**
     * 카테고리별 제목 반환
     * @param {string} category - 카테고리
     * @returns {string} 제목
     */
    getCategoryTitle(category) {
        const titleMap = {
            'diet': '식단',
            'supplements': '영양제',
            'research': '연구',
            'trends': '트렌드',
            'vitamins': '비타민',
            'minerals': '미네랄',
            'protein': '단백질',
            'carbs': '탄수화물',
            'fats': '지방',
            'exercise': '운동영양',
            'immunity': '면역력',
            'bone': '뼈건강',
            'calcium': '칼슘',
            'iron': '철분',
            'omega3': '오메가3',
            'probiotics': '프로바이오틱스'
        };
        
        return titleMap[category] || '영양';
    }

    /**
     * 이미지 파일 저장
     * @param {Buffer} imageBuffer - 이미지 버퍼
     * @param {string} filename - 파일명 (확장자 포함)
     * @returns {string} 저장된 이미지 URL
     */
    async saveImage(imageBuffer, filename) {
        try {
            const sanitizedFilename = this.sanitizeFilename(filename);
            const imagePath = path.join(this.imageDirectory, sanitizedFilename);
            
            await fs.writeFile(imagePath, imageBuffer);
            
            return `${this.baseUrl}/${sanitizedFilename}`;
        } catch (error) {
            console.error('Image save error:', error);
            throw new Error(`Failed to save image: ${error.message}`);
        }
    }

    /**
     * 파일명 정리 (보안을 위한 sanitization)
     * @param {string} filename - 원본 파일명
     * @returns {string} 정리된 파일명
     */
    sanitizeFilename(filename) {
        // 파일명에서 위험한 문자 제거
        const sanitized = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
        
        // 고유한 파일명 생성 (중복 방지)
        const timestamp = Date.now();
        const hash = crypto.createHash('md5').update(filename).digest('hex').substring(0, 8);
        
        const ext = path.extname(sanitized);
        const name = path.basename(sanitized, ext);
        
        return `${name}_${timestamp}_${hash}${ext}`;
    }

    /**
     * 이미지 삭제
     * @param {string} imageUrl - 삭제할 이미지 URL
     * @returns {boolean} 삭제 성공 여부
     */
    async deleteImage(imageUrl) {
        try {
            const filename = path.basename(imageUrl);
            const imagePath = path.join(this.imageDirectory, filename);
            
            await fs.unlink(imagePath);
            return true;
        } catch (error) {
            console.error('Image delete error:', error);
            return false;
        }
    }

    /**
     * 이미지 존재 여부 확인
     * @param {string} imageUrl - 확인할 이미지 URL
     * @returns {boolean} 존재 여부
     */
    async imageExists(imageUrl) {
        try {
            const filename = path.basename(imageUrl);
            const imagePath = path.join(this.imageDirectory, filename);
            
            await fs.access(imagePath);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * AI 이미지 생성을 위한 프롬프트 구성 (향후 사용)
     * @param {Object} content - 콘텐츠 객체
     * @returns {string} 이미지 생성 프롬프트
     */
    buildImagePrompt(content) {
        const { title, summary, category, tags } = content;
        
        let prompt = 'Create a professional, clean illustration for a nutrition article about ';
        
        if (title) {
            prompt += `"${title}". `;
        }
        
        if (category) {
            prompt += `This is related to ${category}. `;
        }
        
        if (tags && tags.length > 0) {
            prompt += `Key topics include: ${tags.join(', ')}. `;
        }
        
        prompt += 'Style: modern, clean, health-focused, suitable for a nutrition website. ';
        prompt += 'Colors: fresh, natural colors. No text in the image.';
        
        return prompt;
    }

    /**
     * 이미지 최적화 (향후 구현)
     * @param {string} imagePath - 최적화할 이미지 경로
     * @returns {string} 최적화된 이미지 경로
     */
    async optimizeImage(imagePath) {
        // TODO: 이미지 압축 및 최적화 로직 구현
        // Sharp, ImageMagick 등의 라이브러리 활용 가능
        return imagePath;
    }
}

module.exports = ImageManager;