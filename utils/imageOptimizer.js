const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

class ImageOptimizer {
  constructor() {
    this.maxWidth = 1200;
    this.maxHeight = 800;
    this.quality = 80;
  }

  async optimizeImage(inputBuffer, options = {}) {
    try {
      const {
        maxWidth = this.maxWidth,
        maxHeight = this.maxHeight,
        quality = this.quality,
        format = 'jpeg'
      } = options;

      let pipeline = sharp(inputBuffer);

      // 이미지 크기 조정
      pipeline = pipeline.resize(maxWidth, maxHeight, {
        fit: 'inside',
        withoutEnlargement: true
      });

      // 포맷에 따른 압축 설정
      if (format === 'jpeg') {
        pipeline = pipeline.jpeg({ quality, progressive: true });
      } else if (format === 'png') {
        pipeline = pipeline.png({ quality, progressive: true });
      } else if (format === 'webp') {
        pipeline = pipeline.webp({ quality });
      }

      return await pipeline.toBuffer();
    } catch (error) {
      console.error('이미지 최적화 실패:', error);
      throw error;
    }
  }

  async optimizeAndSave(inputBuffer, outputPath, options = {}) {
    try {
      const optimizedBuffer = await this.optimizeImage(inputBuffer, options);
      
      // 디렉토리 생성
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(outputPath, optimizedBuffer);
      return outputPath;
    } catch (error) {
      console.error('이미지 저장 실패:', error);
      throw error;
    }
  }

  getOptimizedFileName(originalName, format = 'jpeg') {
    const ext = format === 'jpeg' ? 'jpg' : format;
    const baseName = path.basename(originalName, path.extname(originalName));
    return `${baseName}_optimized.${ext}`;
  }
}

module.exports = ImageOptimizer;