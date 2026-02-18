/**
 * 渲染环境共享对象
 * 所有 view 模块通过 init() 获取画布上下文和常量引用
 */
let _ctx, _R, _TH, _W, _H, _S, _safeTop, _COLS, _ROWS

function init(ctx, R, TH, W, H, S, safeTop, COLS, ROWS) {
  _ctx = ctx; _R = R; _TH = TH
  _W = W; _H = H; _S = S; _safeTop = safeTop
  _COLS = COLS; _ROWS = ROWS
}

module.exports = {
  init,
  get ctx() { return _ctx },
  get R() { return _R },
  get TH() { return _TH },
  get W() { return _W },
  get H() { return _H },
  get S() { return _S },
  get safeTop() { return _safeTop },
  get COLS() { return _COLS },
  get ROWS() { return _ROWS },
}
