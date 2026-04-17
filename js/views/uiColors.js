/**
 * 全局 UI 色板 — 灵宠消消塔
 * 所有 View 的文字 / 按钮 / 背景配色统一从此处读取，避免各处硬编码 rgba/hex 出现对比度参差。
 *
 * 色系说明（国风金棕 · 低饱和）：
 *   - primary  主干文字（标题 / 关键数据）
 *   - secondary 次级文字（说明 / 小标题）
 *   - muted    弱化文字（辅助提示）
 *   - success  完成 / 达成 / 解锁
 *   - warn     警告 / 未完成 / 限制
 *   - danger   危险 / 错误 / 消耗不足
 *   - soul     灵石相关（从旧的淡蓝 #5577AA 迁至深金棕，与图标色系对齐）
 *   - awaken   觉醒石相关
 *   - fragment 碎片相关
 *   - frame    面板金边 / 分割线
 *   - bg       面板底色
 */

const UI_COLORS = {
  // === 文字层级 ===
  textPrimary:   '#3A2A10',  // 主标题 / 名称 / 关键数字
  textSecondary: '#7A5A28',  // 段落 / 说明文字
  textMuted:     '#9A7A40',  // 弱化提示（对比度仍满足可读）
  textDim:       'rgba(90,70,40,0.55)',   // 最弱（仅装饰性辅助，不承载关键信息）
  textOnDark:    '#FFFFFF',   // 深底上的主文字
  textOnDarkDim: 'rgba(255,255,255,0.65)', // 深底上的次文字

  // === 状态色 ===
  success:       '#2E8B2E',  // 深绿（解锁 / 挑战完成 / 积极反馈）
  successLight:  '#5BAA5B',  // 浅一档
  warn:          '#CC7A00',  // 警告（未完成 / 差一点 / 限时）
  warnLight:     '#E89A1A',
  danger:        '#CC3333',  // 错误 / 不可撤回 / 资源不足
  dangerLight:   '#E85050',

  // === 资源类（与图标主色对齐） ===
  soulLabel:     '#7A5A28',  // 灵石标签
  soulValue:     '#B8860B',  // 灵石数值（深金 · DarkGoldenRod）
  soulAccent:    '#C87830',  // 首通/里程碑灵石（更暖）
  awakenLabel:   '#5A4A80',
  awakenValue:   '#7A5AB8',
  fragmentLabel: '#8B6A2E',
  fragmentValue: '#C99830',
  cultExpLabel:  '#8B7355',  // 修炼经验标签
  cultExpValue:  '#B8860B',  // 修炼经验数值
  universalFrag: '#D85AA8',  // 万能碎片彩虹色代表色

  // === 面板 / 边框 ===
  panelBg:       'rgba(255,252,245,0.92)',
  panelBgSolid:  '#FFFCF5',
  panelBorder:   'rgba(201,168,76,0.5)',
  panelBorderDim:'rgba(201,168,76,0.25)',
  divider:       'rgba(180,140,60,0.35)',

  // === 按钮 ===
  btnPrimaryFill:   '#E8B820',
  btnPrimaryText:   '#3A2410',
  btnSecondaryFill: 'rgba(255,255,255,0.12)',
  btnSecondaryText: '#FFFFFF',
  btnDisabledFill:  'rgba(128,128,128,0.25)',
  btnDisabledText:  'rgba(120,100,70,0.55)',

  // === 交互态 ===
  pressedOverlay:   'rgba(0,0,0,0.12)',   // 按下态叠加（轻）
  hoverOverlay:     'rgba(255,255,255,0.08)',
}

module.exports = UI_COLORS
