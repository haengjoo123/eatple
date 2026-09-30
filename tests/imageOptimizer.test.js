const fs = require('fs');
const os = require('os');
const path = require('path');
const sharp = require('sharp');
const ImageOptimizer = require('../utils/imageOptimizer');

test('a valid uploaded PNG is converted into a readable JPEG', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'meal-plan-image-'));
    const file = path.join(directory, 'converted.jpg');
    try {
        const png = await sharp({ create: { width: 16, height: 16, channels: 3, background: '#44aa88' } }).png().toBuffer();
        const optimizer = new ImageOptimizer();
        await optimizer.optimizeAndSave(png, file, { format: 'jpeg' });
        expect(await optimizer.getImageMetadata(file)).toMatchObject({ format: 'jpeg', width: 16, height: 16 });
    } finally {
        if (fs.existsSync(file)) fs.unlinkSync(file);
        fs.rmdirSync(directory);
    }
});
