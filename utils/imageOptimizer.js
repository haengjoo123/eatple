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

  resolveUploadPath(value) {
    if (typeof value !== 'string' || !value || !/\.(jpe?g|png|webp|gif|avif|tiff?)$/i.test(value)) {
      throw new Error('유효한 업로드 이미지 경로가 필요합니다.');
    }
    const root = path.resolve(__dirname, '../public/uploads');
    const normalized = value.replace(/\\/g, '/').replace(/^(?:\/|public\/)?uploads\//, '');
    const resolved = path.resolve(root, normalized);
    const withinRoot = candidate => {
      const relative = path.relative(root, candidate);
      return relative && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
    };
    if (!withinRoot(resolved)) throw new Error('업로드 폴더 밖의 파일에는 접근할 수 없습니다.');
    // Also reject paths through symbolic links outside the upload directory.
    let existing = resolved;
    while (!fs.existsSync(existing)) existing = path.dirname(existing);
    const real = fs.realpathSync(existing);
    if (real !== root && !withinRoot(real)) throw new Error('유효하지 않은 이미지 경로입니다.');
    return resolved;
  }

  async getImageMetadata(input) {
    const { width, height, format, size } = await sharp(input).metadata();
    return { width, height, format, size: size ?? fs.statSync(input).size };
  }

  getOptimizedFileName(originalName, format = 'jpeg') {
    const ext = format === 'jpeg' ? 'jpg' : format;
    const baseName = path.basename(originalName, path.extname(originalName));
    return `${baseName}_optimized.${ext}`;
  }
}

module.exports = ImageOptimizer;
