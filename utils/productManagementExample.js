/**
 * Product Management Integration Example
 * Demonstrates how to use all product management utilities together
 * Requirements: 2.2, 2.3, 4.2, 4.3, 7.1, 7.2
 */

const ProductManager = require('./productManager');
const CategoryManager = require('./categoryManager');
const ImageUploadHandler = require('./imageUploadHandler');
const { productErrorHandler } = require('./productErrorHandler');

class ProductManagementService {
    constructor() {
        this.productManager = new ProductManager();
        this.categoryManager = new CategoryManager();
        this.imageUploadHandler = new ImageUploadHandler();
        this.errorHandler = productErrorHandler;
    }

    /**
     * 완전한 상품 생성 워크플로우
     * Requirements: 2.2, 7.1, 7.2
     */
    async createProductWithImage(productData, imageFile, userId) {
        try {
            // 1. 카테고리 존재 확인
            const categoryCheck = await this.categoryManager.getCategoryByName(productData.category);
            if (!categoryCheck.success) {
                // 카테고리가 없으면 기본 카테고리 생성
                console.log('Category not found, creating default categories...');
                await this.categoryManager.createDefaultCategories();
            }

            // 2. 이미지 업로드 (있는 경우)
            let imageData = null;
            if (imageFile) {
                const imageResult = await this.imageUploadHandler.uploadProductImage(imageFile);
                if (!imageResult.success) {
                    throw this.errorHandler.createImageError(imageResult.error);
                }
                imageData = imageResult.data;
            }

            // 3. 상품 데이터에 이미지 정보 추가
            const completeProductData = {
                ...productData,
                image_url: imageData?.mainUrl || null,
                image_path: imageData?.fileName || null
            };

            // 4. 상품 생성
            const productResult = await this.productManager.createProduct(completeProductData, userId);
            
            if (!productResult.success) {
                // 이미지가 업로드되었다면 롤백
                if (imageData) {
                    await this.imageUploadHandler.deleteProductImage(imageData.fileName);
                }
                throw new Error(productResult.error);
            }

            return this.errorHandler.createSuccessResponse({
                product: productResult.data,
                image: imageData
            }, '상품이 성공적으로 생성되었습니다.');

        } catch (error) {
            return this.errorHandler.handleError(error, 'ProductManagementService.createProductWithImage');
        }
    }

    /**
     * 상품 업데이트 (이미지 포함)
     * Requirements: 4.3, 7.1, 7.2
     */
    async updateProductWithImage(productId, updateData, imageFile, userId) {
        try {
            // 1. 기존 상품 조회
            const existingProduct = await this.productManager.getProductById(productId);
            if (!existingProduct.success) {
                throw this.errorHandler.createNotFoundError('Product');
            }

            // 2. 새 이미지 업로드 (있는 경우)
            let newImageData = null;
            if (imageFile) {
                const imageResult = await this.imageUploadHandler.uploadProductImage(imageFile, productId);
                if (!imageResult.success) {
                    throw this.errorHandler.createImageError(imageResult.error);
                }
                newImageData = imageResult.data;
            }

            // 3. 업데이트 데이터 준비
            const completeUpdateData = { ...updateData };
            if (newImageData) {
                completeUpdateData.image_url = newImageData.mainUrl;
                completeUpdateData.image_path = newImageData.fileName;
            }

            // 4. 상품 업데이트
            const updateResult = await this.productManager.updateProduct(productId, completeUpdateData, userId);
            
            if (!updateResult.success) {
                // 새 이미지가 업로드되었다면 롤백
                if (newImageData) {
                    await this.imageUploadHandler.deleteProductImage(newImageData.fileName);
                }
                throw new Error(updateResult.error);
            }

            // 5. 기존 이미지 삭제 (새 이미지가 업로드된 경우)
            if (newImageData && existingProduct.data.image_path) {
                await this.imageUploadHandler.deleteProductImage(existingProduct.data.image_path);
            }

            return this.errorHandler.createSuccessResponse({
                product: updateResult.data,
                image: newImageData
            }, '상품이 성공적으로 업데이트되었습니다.');

        } catch (error) {
            return this.errorHandler.handleError(error, 'ProductManagementService.updateProductWithImage');
        }
    }

    /**
     * 상품 삭제 (이미지 포함)
     * Requirements: 4.3, 7.1, 7.2
     */
    async deleteProductWithImage(productId, userId) {
        try {
            // 1. 기존 상품 조회
            const existingProduct = await this.productManager.getProductById(productId);
            if (!existingProduct.success) {
                throw this.errorHandler.createNotFoundError('Product');
            }

            // 2. 상품 삭제
            const deleteResult = await this.productManager.deleteProduct(productId, userId);
            if (!deleteResult.success) {
                throw new Error(deleteResult.error);
            }

            // 3. 이미지 삭제 (있는 경우)
            if (existingProduct.data.image_path) {
                await this.imageUploadHandler.deleteProductImage(existingProduct.data.image_path);
            }

            return this.errorHandler.createSuccessResponse(null, '상품이 성공적으로 삭제되었습니다.');

        } catch (error) {
            return this.errorHandler.handleError(error, 'ProductManagementService.deleteProductWithImage');
        }
    }

    /**
     * 카테고리별 상품 통계
     * Requirements: 4.2, 7.1
     */
    async getCategoryStatistics() {
        try {
            // 1. 카테고리 목록 조회
            const categoriesResult = await this.categoryManager.getCategories();
            if (!categoriesResult.success) {
                throw new Error(categoriesResult.error);
            }

            // 2. 카테고리별 상품 수 조회
            const statsResult = await this.categoryManager.getCategoryStats();
            if (!statsResult.success) {
                throw new Error(statsResult.error);
            }

            // 3. 데이터 결합
            const statistics = categoriesResult.data.map(category => ({
                ...category,
                productCount: statsResult.data[category.name] || 0
            }));

            return this.errorHandler.createSuccessResponse(statistics, '카테고리 통계가 조회되었습니다.');

        } catch (error) {
            return this.errorHandler.handleError(error, 'ProductManagementService.getCategoryStatistics');
        }
    }

    /**
     * 벌크 상품 작업 (상태 변경)
     * Requirements: 4.3, 7.1
     */
    async bulkUpdateProductStatus(productIds, status, userId) {
        try {
            // 입력 검증
            if (!Array.isArray(productIds) || productIds.length === 0) {
                throw this.errorHandler.createValidationError(['상품 ID 목록이 필요합니다.']);
            }

            if (!['active', 'inactive', 'out_of_stock'].includes(status)) {
                throw this.errorHandler.createValidationError(['유효하지 않은 상태입니다.']);
            }

            // 벌크 업데이트 실행
            const result = await this.productManager.bulkUpdateStatus(productIds, status, userId);
            
            if (!result.success) {
                throw new Error(result.error);
            }

            return this.errorHandler.createSuccessResponse(result.data, result.message);

        } catch (error) {
            return this.errorHandler.handleError(error, 'ProductManagementService.bulkUpdateProductStatus');
        }
    }

    /**
     * 시스템 초기화 (기본 카테고리 생성)
     * Requirements: 7.1
     */
    async initializeSystem() {
        try {
            console.log('Initializing product management system...');

            // 1. 기본 카테고리 생성
            const categoryResult = await this.categoryManager.createDefaultCategories();
            console.log('Default categories result:', categoryResult.data);

            // 2. 이미지 스토리지 초기화
            await this.imageUploadHandler.initializeBucket();
            console.log('Image storage initialized');

            return this.errorHandler.createSuccessResponse({
                categories: categoryResult.data
            }, '시스템이 성공적으로 초기화되었습니다.');

        } catch (error) {
            return this.errorHandler.handleError(error, 'ProductManagementService.initializeSystem');
        }
    }

    /**
     * 시스템 상태 확인
     * Requirements: 7.1, 7.2
     */
    async getSystemStatus() {
        try {
            // 1. 카테고리 수 확인
            const categoriesResult = await this.categoryManager.getCategories();
            const categoryCount = categoriesResult.success ? categoriesResult.data.length : 0;

            // 2. 상품 수 확인
            const productsResult = await this.productManager.getProducts({}, { limit: 1 });
            const productCount = productsResult.success ? productsResult.pagination.total : 0;

            // 3. 스토리지 사용량 확인
            const storageResult = await this.imageUploadHandler.getStorageUsage();
            const storageUsage = storageResult.success ? storageResult.data : null;

            return this.errorHandler.createSuccessResponse({
                categories: {
                    count: categoryCount,
                    status: categoriesResult.success ? 'healthy' : 'error'
                },
                products: {
                    count: productCount,
                    status: productsResult.success ? 'healthy' : 'error'
                },
                storage: {
                    usage: storageUsage,
                    status: storageResult.success ? 'healthy' : 'error'
                }
            }, '시스템 상태가 조회되었습니다.');

        } catch (error) {
            return this.errorHandler.handleError(error, 'ProductManagementService.getSystemStatus');
        }
    }
}

module.exports = ProductManagementService;