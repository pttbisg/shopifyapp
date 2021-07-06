import Router from "koa-router";
const router = new Router();

router.get('/create', (ctx) => {
  ctx.res.statusCode = 200;
});

module.exports = router;
