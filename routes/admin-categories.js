const express = require('express');
const router = express.Router();
const { adminAuth } = require('../utils/authMiddleware');
const CategoryManager = require('../utils/categoryManager');
const ProductErrorHandler = require('../utils/productErrorHandler');

// 카테고리 매니저 인스턴스 생성
const categoryManager = new CategoryManager();

// GET /api/admin/product-categories - 모든 카테고리 조회
router.get('/', async (req, res) => {
    try {
        const categories = await categoryManager.getAllCategories();
        
        res.json({
            success: true,
            data: categories
        });
    } catch (error) {
        ProductErrorHandler.handle(error, req, res, 'GET_CATEGORIES');
    }
});

// POST /api/admin/product-categories - 새 카테고리 생성
router.post('/', adminAuth, async (req, res) => {
    try {
        const { name, display_name, description } = req.body;
        
        if (!name || !display_name) {
            return res.status(400).json({
                success: false,
                error: '카테고리명과 표시명은 필수입니다.'
            });
        }

        const category = await categoryManager.createCategory({
            name,
            display_name,
            description: description || ''
        });

        res.json({
            success: true,
            data: category
        });
    } catch (error) {
        ProductErrorHandler.handle(error, req, res, 'CREATE_CATEGORY');
    }
});

// PUT /api/admin/product-categories/:id - 카테고리 수정
router.put('/:id', adminAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, display_name, description } = req.body;
        
        if (!name || !display_name) {
            return res.status(400).json({
                success: false,
                error: '카테고리명과 표시명은 필수입니다.'
            });
        }

        const category = await categoryManager.updateCategory(id, {
            name,
            display_name,
            description: description || ''
        });

        res.json({
            success: true,
            data: category
        });
    } catch (error) {
        ProductErrorHandler.handle(error, req, res, 'UPDATE_CATEGORY');
    }
});

// DELETE /api/admin/product-categories/:id - 카테고리 삭제
router.delete('/:id', adminAuth, async (req, res) => {
    try {
        const { id } = req.params;
        
        await categoryManager.deleteCategory(id);

        res.json({
            success: true,
            message: '카테고리가 성공적으로 삭제되었습니다.'
        });
    } catch (error) {
        ProductErrorHandler.handle(error, req, res, 'DELETE_CATEGORY');
    }
});

module.exports = router; 