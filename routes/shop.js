/**
 * Customer-facing shop API routes
 * Requirements: 8.1, 8.2, 8.3, 8.4, 9.3
 */

const express = require('express');
const router = express.Router();
const ProductManager = require('../utils/productManager');
const CategoryManager = require('../utils/categoryManager');
const SupabaseQnaManager = require('../utils/supabaseQnaManager');
const { getUserFromSession } = require('../utils/userHelper');

// Create instances
const productManager = new ProductManager();
const categoryManager = new CategoryManager();
const qnaManager = new SupabaseQnaManager();

// UUID validation utility
const isValidUUID = (uuid) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
};

// GET /api/shop/products/featured - Get featured products
router.get('/products/featured', async (req, res) => {
    try {
        const result = await productManager.getFeaturedProducts();
        
        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: result.error,
                message: result.message
            });
        }

        res.json({
            success: true,
            data: result.data
        });
    } catch (error) {
        console.error('Featured products error:', error);
        res.status(500).json({
            success: false,
            error: '특가 상품을 불러오는데 실패했습니다.',
            message: '잠시 후 다시 시도해주세요.'
        });
    }
});

// GET /api/shop/products/:id/image - Get product image
router.get('/products/:id/image', async (req, res) => {
    try {
        const { id } = req.params;
        
        if (!isValidUUID(id)) {
            return res.status(400).json({
                success: false,
                error: '유효하지 않은 상품 ID입니다.'
            });
        }
        
        const result = await productManager.getProductImage(id);
        
        if (!result.success) {
            return res.status(404).json({
                success: false,
                error: result.error || '이미지를 찾을 수 없습니다.'
            });
        }

        res.json({
            success: true,
            data: {
                id: id,
                image_url: result.image_url,
                image_path: result.image_path
            }
        });
    } catch (error) {
        console.error('Product image error:', error);
        res.status(500).json({
            success: false,
            error: '이미지 조회 중 오류가 발생했습니다.'
        });
    }
});

// GET /api/shop/products/:id/reviews - Get reviews for a product
router.get('/products/:id/reviews', async (req, res) => {
    try {
        const { id } = req.params;
        
        if (!isValidUUID(id)) {
            return res.status(400).json({
                success: false,
                error: '유효하지 않은 상품 ID입니다.'
            });
        }

        // 상품이 존재하고 활성 상태인지 확인
        const product = await productManager.getProductById(id);
        
        if (!product || product.status !== 'active') {
            return res.status(404).json({
                success: false,
                error: '상품을 찾을 수 없습니다.'
            });
        }

        const { supabase } = require('../utils/supabaseClient');

        // 해당 상품의 리뷰들과 사용자 정보를 함께 조회
        const { data: reviews, error } = await supabase
            .from('reviews')
            .select(`
                id,
                rating,
                content,
                created_at,
                users (
                    username,
                    full_name
                )
            `)
            .eq('product_id', id)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Reviews query error:', error);
            return res.status(500).json({
                success: false,
                error: '리뷰를 불러오는데 실패했습니다.'
            });
        }

        // 데이터 형식 변환
        const formattedReviews = reviews.map(review => ({
            id: review.id,
            rating: review.rating,
            content: review.content,
            created_at: review.created_at,
            date: review.created_at, // 프론트엔드 호환성
            userName: review.users?.username || review.users?.full_name || '익명',
            user_name: review.users?.username || review.users?.full_name || '익명' // 프론트엔드 호환성
        }));

        res.json({
            success: true,
            data: formattedReviews
        });
    } catch (error) {
        console.error('Product reviews error:', error);
        res.status(500).json({
            success: false,
            error: '리뷰를 불러오는데 실패했습니다.'
        });
    }
});

// GET /api/shop/products/:id/qna - Get Q&A for a product
router.get('/products/:id/qna', async (req, res) => {
    try {
        const { id } = req.params;
        
        if (!isValidUUID(id)) {
            return res.status(400).json({
                success: false,
                error: '유효하지 않은 상품 ID입니다.'
            });
        }

        // QnaManager를 사용하여 Q&A 조회
        const result = await qnaManager.getQnaByProductId(id);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: result.error || 'Q&A 목록을 불러오는데 실패했습니다.'
            });
        }

        // 현재 사용자 정보 가져오기
        const currentUserId = req.session && req.session.user ? req.session.user.id : null;

        // 데이터 형식 변환 (비밀글 처리 포함)
        const formattedQnaData = result.data.map(qna => {
            const isSecretAndNotOwner = qna.is_secret && qna.user_id !== currentUserId;
            
            return {
                id: qna.id,
                title: qna.title,
                content: isSecretAndNotOwner ? null : qna.content, // 비밀글이고 작성자가 아니면 내용 숨김
                type: qna.type,
                isSecret: qna.is_secret,
                status: qna.status,
                createdAt: qna.created_at,
                answer: isSecretAndNotOwner ? null : qna.answer, // 비밀글이고 작성자가 아니면 답변 숨김
                answer_content: isSecretAndNotOwner ? null : qna.answer, // 프론트엔드 호환성
                answeredAt: qna.answered_at,
                username: qna.username,
                author: qna.username  // 프론트엔드 호환성을 위해 author 필드 추가
            };
        });

        res.json({
            success: true,
            data: formattedQnaData
        });
    } catch (error) {
        console.error('Q&A fetch error:', error);
        res.status(500).json({
            success: false,
            error: 'Q&A 목록을 불러오는데 실패했습니다.'
        });
    }
});

// GET /api/shop/products - List active products for customers
// Requirements: 8.1, 8.2, 9.3
router.get('/products', async (req, res) => {
    try {
        const { category, group } = req.query;
        
        const filters = {};
        if (category) {
            filters.category = category;
        }
        if (group) {
            filters.group = group;
        }

        let result;
        if (group === 'new') {
            // 신상품 그룹인 경우 3일 이내 상품 조회
            result = await productManager.getNewProducts(filters);
        } else if (group === 'best') {
            // 베스트 그룹인 경우 판매율 상위 20개 상품 조회
            result = await productManager.getBestProducts(filters);
        } else {
            result = await productManager.getActiveProducts(filters);
        }
        
        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: result.error,
                message: result.message
            });
        }

        res.json({
            success: true,
            data: result.data
        });
    } catch (error) {
        console.error('Shop products error:', error);
        res.status(500).json({
            success: false,
            error: '상품 목록을 불러오는데 실패했습니다.',
            message: '잠시 후 다시 시도해주세요.'
        });
    }
});

// GET /api/shop/products/:id - Get single product details for customers
// Requirements: 8.2, 9.3
router.get('/products/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Validate UUID format before database query
        if (!isValidUUID(id)) {
            return res.status(400).json({
                success: false,
                error: '유효하지 않은 상품 ID입니다.'
            });
        }
        
        const product = await productManager.getProductById(id);
        
        if (!product) {
            return res.status(404).json({
                success: false,
                error: '상품을 찾을 수 없습니다.'
            });
        }

        // Only return active products to customers
        if (product.status !== 'active') {
            return res.status(404).json({
                success: false,
                error: '상품을 찾을 수 없습니다.'
            });
        }

        // Return only customer-relevant fields
        const customerProduct = {
            id: product.id,
            name: product.name,
            summary: product.summary,
            description: product.description,
            price: product.price,
            originalPrice: product.originalPrice,
            category: product.category,
            image_url: product.image_url,
            status: product.status,
            brand: product.brand,
            shipping_fee: product.shipping_fee
        };

        res.json({
            success: true,
            data: customerProduct
        });
    } catch (error) {
        console.error('Shop product detail error:', error);
        res.status(500).json({
            success: false,
            error: '상품 정보를 불러오는데 실패했습니다.',
            message: '잠시 후 다시 시도해주세요.'
        });
    }
});

// GET /api/shop/categories - List active categories
// Requirements: 8.3, 9.3
router.get('/categories', async (req, res) => {
    try {
        const categories = await categoryManager.getActiveCategories();
        
        res.json({
            success: true,
            data: categories
        });
    } catch (error) {
        console.error('Shop categories error:', error);
        res.status(500).json({
            success: false,
            error: '카테고리 목록을 불러오는데 실패했습니다.',
            message: '잠시 후 다시 시도해주세요.'
        });
    }
});

// POST /api/shop/products/:id/view - Track product views
// Requirements: 8.4
router.post('/products/:id/view', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Validate UUID format before database query
        if (!isValidUUID(id)) {
            return res.status(400).json({
                success: false,
                error: '유효하지 않은 상품 ID입니다.'
            });
        }
        
        // Verify product exists and is active
        const product = await productManager.getProductById(id);
        
        if (!product || product.status !== 'active') {
            return res.status(404).json({
                success: false,
                error: '상품을 찾을 수 없습니다.'
            });
        }

        // Increment view count
        await productManager.incrementViewCount(id);

        // Track analytics if user session exists
        if (req.session && req.session.user) {
            await productManager.trackProductEvent(id, 'view', {
                user_id: req.session.user.id,
                session_id: req.sessionID
            });
        } else {
            // Track anonymous view
            await productManager.trackProductEvent(id, 'view', {
                session_id: req.sessionID
            });
        }

        res.json({
            success: true,
            message: '조회수가 기록되었습니다.'
        });
    } catch (error) {
        console.error('Product view tracking error:', error);
        // Don't fail the request if view tracking fails
        res.json({
            success: true,
            message: '조회수 기록에 실패했지만 요청은 처리되었습니다.'
        });
    }
});

// POST /api/shop/products/:id/purchase - Track product purchases
// Requirements: 10.3
router.post('/products/:id/purchase', async (req, res) => {
    try {
        const { id } = req.params;
        const { amount, pointsUsed, finalPrice } = req.body;
        
        // Validate UUID format before database query
        if (!isValidUUID(id)) {
            return res.status(400).json({
                success: false,
                error: '유효하지 않은 상품 ID입니다.'
            });
        }
        
        // Verify product exists and is active
        const product = await productManager.getProductById(id);
        
        if (!product || product.status !== 'active') {
            return res.status(404).json({
                success: false,
                error: '상품을 찾을 수 없습니다.'
            });
        }

        // Track purchase analytics
        const userId = req.session && req.session.user ? req.session.user.id : null;
        await productManager.trackProductPurchase(id, userId, {
            session_id: req.sessionID,
            amount: amount,
            pointsUsed: pointsUsed,
            finalPrice: finalPrice
        });

        res.json({
            success: true,
            message: '구매가 기록되었습니다.'
        });
    } catch (error) {
        console.error('Product purchase tracking error:', error);
        // Don't fail the request if purchase tracking fails
        res.json({
            success: true,
            message: '구매 기록에 실패했지만 요청은 처리되었습니다.'
        });
    }
});

// GET /api/shop/orders - Get user's order history
router.get('/orders', async (req, res) => {
    try {
        if (!req.session || !req.session.user) {
            return res.status(401).json({
                success: false,
                error: '로그인이 필요합니다.'
            });
        }

        const userId = req.session.user.id;
        const { supabase } = require('../utils/supabaseClient');

        // 주문 내역과 주문 상품들을 함께 조회
        const { data: orders, error } = await supabase
            .from('orders')
            .select(`
                id,
                status,
                total_amount,
                points_used,
                final_amount,
                created_at,
                order_items (
                    product_name,
                    product_category,
                    quantity,
                    unit_price,
                    total_price
                )
            `)
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Orders query error:', error);
            return res.status(500).json({
                success: false,
                error: '주문 내역을 불러오는데 실패했습니다.'
            });
        }

        // 데이터 형식 변환
        const formattedOrders = orders.map(order => ({
            id: order.id,
            created_at: order.created_at,
            status: order.status,
            total_amount: order.total_amount,
            points_used: order.points_used,
            final_amount: order.final_amount,
            items: order.order_items.map(item => ({
                name: item.product_name,
                quantity: item.quantity,
                price: item.unit_price,
                category: item.product_category
            }))
        }));

        res.json({
            success: true,
            data: formattedOrders
        });
    } catch (error) {
        console.error('Orders error:', error);
        res.status(500).json({
            success: false,
            error: '주문 내역을 불러오는데 실패했습니다.'
        });
    }
});

// GET /api/shop/wishlist - Get user's wishlist
router.get('/wishlist', async (req, res) => {
    try {
        if (!req.session || !req.session.user) {
            return res.status(401).json({
                success: false,
                error: '로그인이 필요합니다.'
            });
        }

        const userId = req.session.user.id;
        const { supabase } = require('../utils/supabaseClient');

        // 찜한 상품 목록과 상품 정보를 함께 조회
        const { data: wishlist, error } = await supabase
            .from('wishlist')
            .select(`
                id,
                created_at,
                products (
                    id,
                    name,
                    price,
                    category,
                    image_url,
                    status
                )
            `)
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Wishlist query error:', error);
            return res.status(500).json({
                success: false,
                error: '찜한 상품을 불러오는데 실패했습니다.'
            });
        }

        // 활성 상품만 필터링하고 데이터 형식 변환
        const formattedWishlist = wishlist
            .filter(item => item.products && item.products.status === 'active')
            .map(item => ({
                id: item.products.id,
                name: item.products.name,
                price: item.products.price,
                category: item.products.category,
                image_url: item.products.image_url,
                wishlist_id: item.id
            }));

        res.json({
            success: true,
            data: formattedWishlist
        });
    } catch (error) {
        console.error('Wishlist error:', error);
        res.status(500).json({
            success: false,
            error: '찜한 상품을 불러오는데 실패했습니다.'
        });
    }
});

// DELETE /api/shop/wishlist/:id - Remove item from wishlist
router.delete('/wishlist/:id', async (req, res) => {
    try {
        if (!req.session || !req.session.user) {
            return res.status(401).json({
                success: false,
                error: '로그인이 필요합니다.'
            });
        }

        const { id } = req.params;
        const userId = req.session.user.id;
        const { supabase } = require('../utils/supabaseClient');

        // Validate UUID format
        if (!isValidUUID(id)) {
            return res.status(400).json({
                success: false,
                error: '유효하지 않은 상품 ID입니다.'
            });
        }

        // 찜한 상품에서 삭제 (product_id 기준)
        const { error } = await supabase
            .from('wishlist')
            .delete()
            .eq('user_id', userId)
            .eq('product_id', id);

        if (error) {
            console.error('Wishlist removal error:', error);
            return res.status(500).json({
                success: false,
                error: '찜한 상품 삭제에 실패했습니다.'
            });
        }

        res.json({
            success: true,
            message: '찜한 상품에서 삭제되었습니다.'
        });
    } catch (error) {
        console.error('Wishlist removal error:', error);
        res.status(500).json({
            success: false,
            error: '찜한 상품 삭제에 실패했습니다.'
        });
    }
});

// GET /api/shop/reviews/pending - Get pending reviews for user
router.get('/reviews/pending', async (req, res) => {
    try {
        if (!req.session || !req.session.user) {
            return res.status(401).json({
                success: false,
                error: '로그인이 필요합니다.'
            });
        }

        const userId = req.session.user.id;
        const { supabase } = require('../utils/supabaseClient');

        // 배송 완료된 주문 중 리뷰를 작성하지 않은 상품들 조회
        const { data: pendingReviews, error } = await supabase
            .from('order_items')
            .select(`
                order_id,
                product_id,
                product_name,
                product_category,
                orders!inner (
                    user_id,
                    status
                )
            `)
            .eq('orders.user_id', userId)
            .eq('orders.status', 'delivered')
            .not('product_id', 'in', `(
                SELECT product_id 
                FROM reviews 
                WHERE user_id = '${userId}'
            )`);

        if (error) {
            console.error('Pending reviews query error:', error);
            return res.status(500).json({
                success: false,
                error: '작성 가능한 리뷰를 불러오는데 실패했습니다.'
            });
        }

        // 데이터 형식 변환
        const formattedPendingReviews = pendingReviews.map(item => ({
            order_id: item.order_id,
            product_id: item.product_id,
            product_name: item.product_name,
            category: item.product_category
        }));

        res.json({
            success: true,
            data: formattedPendingReviews
        });
    } catch (error) {
        console.error('Pending reviews error:', error);
        res.status(500).json({
            success: false,
            error: '작성 가능한 리뷰를 불러오는데 실패했습니다.'
        });
    }
});

// GET /api/shop/reviews/my - Get user's reviews
router.get('/reviews/my', async (req, res) => {
    try {
        if (!req.session || !req.session.user) {
            return res.status(401).json({
                success: false,
                error: '로그인이 필요합니다.'
            });
        }

        const userId = req.session.user.id;
        const { supabase } = require('../utils/supabaseClient');

        // 사용자가 작성한 리뷰들과 상품 정보를 함께 조회
        const { data: myReviews, error } = await supabase
            .from('reviews')
            .select(`
                id,
                rating,
                content,
                created_at,
                products (
                    name,
                    category
                )
            `)
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('My reviews query error:', error);
            return res.status(500).json({
                success: false,
                error: '내 리뷰를 불러오는데 실패했습니다.'
            });
        }

        // 데이터 형식 변환
        const formattedReviews = myReviews.map(review => ({
            id: review.id,
            product_name: review.products.name,
            category: review.products.category,
            rating: review.rating,
            content: review.content,
            created_at: review.created_at
        }));

        res.json({
            success: true,
            data: formattedReviews
        });
    } catch (error) {
        console.error('My reviews error:', error);
        res.status(500).json({
            success: false,
            error: '내 리뷰를 불러오는데 실패했습니다.'
        });
    }
});

// POST /api/shop/reviews - Submit a new review
router.post('/reviews', async (req, res) => {
    try {
        if (!req.session || !req.session.user) {
            return res.status(401).json({
                success: false,
                error: '로그인이 필요합니다.'
            });
        }

        const { order_id, product_id, rating, content } = req.body;
        const userId = req.session.user.id;

        // Validate input
        if (!order_id || !product_id || !rating || !content) {
            return res.status(400).json({
                success: false,
                error: '모든 필드를 입력해주세요.'
            });
        }

        if (rating < 1 || rating > 5) {
            return res.status(400).json({
                success: false,
                error: '평점은 1-5 사이의 값이어야 합니다.'
            });
        }

        // Validate UUID formats
        if (!isValidUUID(order_id) || !isValidUUID(product_id)) {
            return res.status(400).json({
                success: false,
                error: '유효하지 않은 ID입니다.'
            });
        }

        const { supabase } = require('../utils/supabaseClient');

        // 해당 주문이 사용자의 것이고 배송 완료 상태인지 확인
        const { data: orderCheck, error: orderError } = await supabase
            .from('orders')
            .select('id, status')
            .eq('id', order_id)
            .eq('user_id', userId)
            .eq('status', 'delivered')
            .single();

        if (orderError || !orderCheck) {
            return res.status(400).json({
                success: false,
                error: '리뷰를 작성할 수 없는 주문입니다.'
            });
        }

        // 해당 주문에 해당 상품이 포함되어 있는지 확인
        const { data: orderItemCheck, error: itemError } = await supabase
            .from('order_items')
            .select('id')
            .eq('order_id', order_id)
            .eq('product_id', product_id)
            .single();

        if (itemError || !orderItemCheck) {
            return res.status(400).json({
                success: false,
                error: '해당 주문에 포함되지 않은 상품입니다.'
            });
        }

        // 이미 리뷰를 작성했는지 확인
        const { data: existingReview, error: reviewCheckError } = await supabase
            .from('reviews')
            .select('id')
            .eq('user_id', userId)
            .eq('order_id', order_id)
            .eq('product_id', product_id)
            .single();

        if (existingReview) {
            return res.status(400).json({
                success: false,
                error: '이미 리뷰를 작성한 상품입니다.'
            });
        }

        // 리뷰 등록
        const { error: insertError } = await supabase
            .from('reviews')
            .insert([{
                user_id: userId,
                order_id: order_id,
                product_id: product_id,
                rating: parseInt(rating),
                content: content.trim()
            }]);

        if (insertError) {
            console.error('Review insertion error:', insertError);
            return res.status(500).json({
                success: false,
                error: '리뷰 등록에 실패했습니다.'
            });
        }

        res.json({
            success: true,
            message: '리뷰가 성공적으로 등록되었습니다.'
        });
    } catch (error) {
        console.error('Review submission error:', error);
        res.status(500).json({
            success: false,
            error: '리뷰 등록에 실패했습니다.'
        });
    }
});

// POST /api/shop/wishlist - Add item to wishlist
router.post('/wishlist', async (req, res) => {
    try {
        if (!req.session || !req.session.user) {
            return res.status(401).json({
                success: false,
                error: '로그인이 필요합니다.'
            });
        }

        const { product_id } = req.body;
        const userId = req.session.user.id;

        if (!product_id) {
            return res.status(400).json({
                success: false,
                error: '상품 ID가 필요합니다.'
            });
        }

        // Validate UUID format
        if (!isValidUUID(product_id)) {
            return res.status(400).json({
                success: false,
                error: '유효하지 않은 상품 ID입니다.'
            });
        }

        const { supabase } = require('../utils/supabaseClient');

        // 상품이 존재하고 활성 상태인지 확인
        const { data: product, error: productError } = await supabase
            .from('products')
            .select('id, status')
            .eq('id', product_id)
            .eq('status', 'active')
            .single();

        if (productError || !product) {
            return res.status(404).json({
                success: false,
                error: '상품을 찾을 수 없습니다.'
            });
        }

        // 찜하기 추가 (중복 시 무시)
        const { error: insertError } = await supabase
            .from('wishlist')
            .insert([{
                user_id: userId,
                product_id: product_id
            }])
            .select();

        if (insertError) {
            // 중복 키 오류인 경우
            if (insertError.code === '23505') {
                return res.json({
                    success: true,
                    message: '이미 찜한 상품입니다.'
                });
            }
            
            console.error('Wishlist insertion error:', insertError);
            return res.status(500).json({
                success: false,
                error: '찜하기에 실패했습니다.'
            });
        }

        res.json({
            success: true,
            message: '찜한 상품에 추가되었습니다.'
        });
    } catch (error) {
        console.error('Wishlist addition error:', error);
        res.status(500).json({
            success: false,
            error: '찜하기에 실패했습니다.'
        });
    }
});

// GET /api/shop/qna/:id/access - Check access permission for secret Q&A
router.get('/qna/:id/access', async (req, res) => {
    console.log('QnA 접근 권한 확인 API 호출됨:', req.params.id);
    try {
        const { id } = req.params;
        
        if (!isValidUUID(id)) {
            return res.status(400).json({
                success: false,
                error: '유효하지 않은 문의 ID입니다.'
            });
        }

        // 로그인 상태 확인
        if (!req.session || !req.session.user) {
            return res.status(401).json({
                success: false,
                error: '로그인이 필요합니다.'
            });
        }

        const userId = req.session.user.id;

        // QnaManager를 사용하여 Q&A 조회
        const result = await qnaManager.getQnaById(id);

        if (!result.success || !result.data) {
            return res.status(404).json({
                success: false,
                error: '문의를 찾을 수 없습니다.'
            });
        }

        const qna = result.data;

        // 비밀글이 아니면 누구나 접근 가능
        if (!qna.is_secret) {
            return res.json({
                success: true,
                message: '접근 권한이 있습니다.',
                data: {
                    content: qna.content,
                    answer_content: qna.answer
                }
            });
        }

        // 비밀글인 경우 작성자 본인인지 확인
        if (qna.user_id !== userId) {
            return res.status(403).json({
                success: false,
                error: '작성자만 비밀글을 볼 수 있습니다.'
            });
        }

        res.json({
            success: true,
            message: '접근 권한이 있습니다.',
            data: {
                content: qna.content,
                answer_content: qna.answer
            }
        });
    } catch (error) {
        console.error('Q&A access check error:', error);
        res.status(500).json({
            success: false,
            error: '접근 권한 확인에 실패했습니다.'
        });
    }
});

// POST /api/shop/qna - Submit a new Q&A
router.post('/qna', async (req, res) => {
    try {
        const { productId, title, content, isSecret, type } = req.body;
        
        if (!productId || !title || !content) {
            return res.status(400).json({
                success: false,
                error: '필수 정보가 누락되었습니다.'
            });
        }

        if (!isValidUUID(productId)) {
            return res.status(400).json({
                success: false,
                error: '유효하지 않은 상품 ID입니다.'
            });
        }

        // 사용자 정보 가져오기 (로컬 JSON에서 정확한 정보 조회)
        const userInfo = getUserFromSession(req.session);
        const userId = userInfo.id;
        const username = userInfo.displayName;

        // 상품이 존재하는지 확인
        const product = await productManager.getProductById(productId);
        
        if (!product || product.status !== 'active') {
            return res.status(404).json({
                success: false,
                error: '상품을 찾을 수 없습니다.'
            });
        }

        // QnaManager를 사용하여 Q&A 저장
        const result = await qnaManager.createQna({
            productId,
            userId,
            username,
            title: title.trim(),
            content: content.trim(),
            type: type || '일반문의',
            isSecret: isSecret || false
        });

        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: result.error || '문의 등록에 실패했습니다.'
            });
        }

        console.log('Q&A 등록 성공:', result.data);

        res.json({
            success: true,
            message: '문의가 등록되었습니다.',
            data: {
                id: result.data.id,
                title: result.data.title,
                createdAt: result.data.created_at
            }
        });
    } catch (error) {
        console.error('Q&A submission error:', error);
        res.status(500).json({
            success: false,
            error: '문의 등록에 실패했습니다.'
        });
    }
});

// GET /api/shop/event-products - Get event products
router.get('/event-products', async (req, res) => {
    try {
        const result = await productManager.getEventProducts();
        
        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: result.error,
                message: result.message
            });
        }

        res.json({
            success: true,
            products: result.data
        });
    } catch (error) {
        console.error('Event products error:', error);
        res.status(500).json({
            success: false,
            error: '이벤트 상품을 불러오는데 실패했습니다.',
            message: '잠시 후 다시 시도해주세요.'
        });
    }
});

module.exports = router;