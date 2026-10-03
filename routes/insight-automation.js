const express = require('express');
const { adminAuth } = require('../utils/authMiddleware');
const { createOriginChecker } = require('../utils/httpSecurity');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function createInsightRouters(service) {
    const admin = express.Router();
    const handle = fn => async (req,res) => {
        try { const data = await fn(req); res.json({ success:true,data }); }
        catch (error) { res.status(error.status || 503).json({ success:false,error:error.status ? error.message : '자동화 요청을 처리하지 못했습니다.' }); }
    };
    admin.use(adminAuth);
    const allowedOrigin = createOriginChecker();
    admin.use((req,res,next) => {
        res.set('Cache-Control','no-store');
        if (!['GET','HEAD'].includes(req.method) && req.headers.origin && !allowedOrigin(req.headers.origin)) return res.status(403).json({ success:false,error:'요청 출처를 확인해주세요.' });
        next();
    });
    admin.param('id',(req,res,next,id) => UUID.test(id) ? next() : res.status(400).json({ success:false,error:'작업 ID를 확인해주세요.' }));
    function revision(req) {
        if (!Number.isInteger(req.body.revision) || req.body.revision < 1) throw Object.assign(new Error('현재 글 버전이 필요합니다.'),{ status:400 });
        return req.body.revision;
    }
    admin.get('/status',handle(() => service.status()));
    admin.get('/categories',handle(() => service.categories()));
    admin.patch('/settings',handle(req => service.configure(req.body)));
    admin.post('/collect',handle(() => service.collect({ force:true })));
    admin.post('/process',handle(() => service.processNext()));
    admin.get('/jobs/:id',handle(req => service.job(req.params.id)));
    admin.patch('/jobs/:id',handle(req => service.edit(req.params.id,revision(req),req.body.article,req.body.products,req.body.media)));
    admin.post('/jobs/:id/retry',handle(req => service.retry(req.params.id,revision(req))));
    admin.post('/jobs/:id/reject',handle(req => service.reject(req.params.id,revision(req))));
    admin.post('/jobs/:id/approve',handle(req => service.approve(req.params.id,revision(req),String(req.session.user.username || req.session.user.id))));

    return { admin };
}
module.exports = { createInsightRouters };
