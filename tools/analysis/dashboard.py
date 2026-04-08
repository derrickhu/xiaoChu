"""
灵宠消消塔 — 运营数据仪表盘
用法: streamlit run dashboard.py
"""

import json
import subprocess
import sys
from pathlib import Path
from collections import Counter, defaultdict

import streamlit as st
import plotly.express as px
import pandas as pd

SCRIPT_DIR = Path(__file__).parent
DATA_DIR = SCRIPT_DIR / 'data'


@st.cache_data
def _cached_weapon_details():
    if load_weapon_details is None:
        return {}
    return load_weapon_details()


@st.cache_data
def _cached_pet_names():
    if load_pet_names is None:
        return {}
    return load_pet_names()


# 与 analyze.py 共用本地榜构建逻辑
try:
    from analyze import (
        build_local_leaderboard_rows,
        build_rank_cross_report,
        compute_stage_progress,
        build_stage_leaderboard_rows,
        format_player_record_readable,
        load_weapon_details,
        load_pet_names,
        pet_pool_dataframe,
        saved_stage_team_dataframe,
        weapon_collection_dataframe,
        stage_clear_dataframe,
        pet_dex_dataframe,
        fragment_bank_dataframe,
        idle_dispatch_dataframe,
        build_player_select_labels,
        format_stage_farthest_label,
        static_pets_balance_dataframe,
        static_weapons_balance_dataframe,
        load_pool_growth_constants_json,
        static_enemies_balance_dataframe,
        static_stages_summary_dataframe,
        load_balance_combat_scalars_json,
        load_tower_floors_reference_json,
        load_balance_all_json,
    )
except ImportError:
    build_local_leaderboard_rows = None
    build_rank_cross_report = None
    compute_stage_progress = None
    build_stage_leaderboard_rows = None
    format_player_record_readable = None
    load_weapon_details = None
    load_pet_names = None
    pet_pool_dataframe = None
    saved_stage_team_dataframe = None
    weapon_collection_dataframe = None
    stage_clear_dataframe = None
    pet_dex_dataframe = None
    fragment_bank_dataframe = None
    idle_dispatch_dataframe = None
    build_player_select_labels = None
    format_stage_farthest_label = None
    static_pets_balance_dataframe = None
    static_weapons_balance_dataframe = None
    load_pool_growth_constants_json = None
    static_enemies_balance_dataframe = None
    static_stages_summary_dataframe = None
    load_balance_combat_scalars_json = None
    load_tower_floors_reference_json = None
    load_balance_all_json = None

# ========== 页面配置 ==========

# 灵宠池 constants 项中文说明（仪表盘只读展示）
_POOL_CFG_HELP = {
    'POOL_MAX_LV': '灵宠池等级上限（常规来源；实际还受星级等级上限封顶）',
    'POOL_ADV_MAX_LV': '「关卡 stage」入池灵宠的等级上限',
    'POOL_STAR_ATK_MUL': '各星级对攻击力的乘数（相对基础 atk）',
    'POOL_STAR_FRAG_COST': '升至该星级消耗的碎片（累计规则以 petPoolConfig 为准）',
    'POOL_STAR_LV_REQ': '升星所需的灵宠等级',
    'POOL_STAR_LV_CAP': '各星级对应的灵宠等级上限',
    'POOL_STAR_AWAKEN_COST': '觉醒消耗（若有）',
    'POOL_R_LV_BONUS_RATE': 'R 品质每级附加攻击力（非 R 为每级 +1 攻的对比基数）',
    'POOL_EXP_BASE': '升级经验公式常数项',
    'POOL_EXP_LINEAR': '升级经验 · 等级一次项系数',
    'POOL_EXP_POW_EXP': '升级经验 · 等级幂指数',
    'POOL_EXP_POW_COEFF': '升级经验 · 幂项系数',
    'POOL_RARITY_EXP_MUL': '按 R/SR/SSR 的经验需求倍率',
    'POOL_FRAGMENT_TO_EXP': '每 1 碎片分解转化为多少灵宠经验（见 balance/pool）',
}


st.set_page_config(page_title='灵宠消消塔 · 数据分析', page_icon='🐾', layout='wide')

# ========== 数据加载 ==========

def load_collection(name):
    filepath = DATA_DIR / f'{name}.json'
    if not filepath.exists():
        return []
    text = filepath.read_text(encoding='utf-8').strip()
    if not text:
        return []
    if text.startswith('['):
        return json.loads(text)
    records = []
    for line in text.splitlines():
        line = line.strip()
        if line:
            try:
                records.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    return records


def refresh_data():
    """调用 export_wx.js 刷新数据"""
    result = subprocess.run(
        ['node', str(SCRIPT_DIR / 'export_wx.js')],
        capture_output=True, text=True, cwd=str(SCRIPT_DIR))
    return result.returncode == 0, result.stdout + result.stderr


# ========== 侧边栏 ==========

with st.sidebar:
    st.title('灵宠消消塔')
    st.caption('运营数据分析仪表盘')
    st.divider()

    if st.button('🔄 刷新数据', use_container_width=True):
        with st.spinner('正在从云数据库拉取...'):
            ok, log = refresh_data()
        if ok:
            st.success('数据刷新成功')
            st.cache_data.clear()
            st.rerun()
        else:
            st.error('刷新失败')
            st.code(log, language='text')

    st.divider()
    st.caption('数据来源: 微信云数据库 · WX_SECRET 与 CDN 脚本同源（环境变量 / scripts/.cdn_secret / 本目录 .env）')


# ========== 加载数据 ==========

players = load_collection('playerData')
has_players = bool(players)
if not has_players:
    st.warning(
        '暂无玩家导出数据。可先侧边栏「刷新数据」，或执行 `node export_wx.js`。'
        '「📐 游戏数值配置」仍可直接读取仓库内静态表，便于调数值。'
    )

df = pd.DataFrame(players) if has_players else pd.DataFrame()
total = len(df)

# 秘境进度列（与客户端 stageClearRecord 一致）
if compute_stage_progress is not None and has_players:
    _sm = [compute_stage_progress(p) for p in players if isinstance(p, dict)]
    stage_df = pd.DataFrame(_sm) if _sm else pd.DataFrame()
else:
    stage_df = pd.DataFrame()

# ========== 顶部指标卡 ==========

st.header('总览')
st.caption('秘境（固定关卡）为主线玩法；通天塔（肉鸽）为支线。指标已拆成「秘境 / 通天塔」两组。')

if not has_players:
    floors = pd.Series(dtype=float)
    runs = pd.Series(dtype=float)
    tower_cleared = 0
    stats_col = pd.Series(dtype=object)
    combos = pd.Series(dtype=float)
    dex_counts = pd.Series(dtype=float)
else:
    floors = df['bestFloor'].fillna(0) if 'bestFloor' in df.columns else pd.Series([0])
    runs = df['totalRuns'].fillna(0) if 'totalRuns' in df.columns else pd.Series([0])
    tower_cleared = int((floors >= 30).sum())
    stats_col = df.get('stats', pd.Series(dtype=object))
    combos = stats_col.apply(lambda x: x.get('maxCombo', 0) if isinstance(x, dict) else 0)
    dex_counts = df['petDex'].apply(lambda x: len(x) if isinstance(x, list) else 0) if 'petDex' in df.columns else pd.Series([0])

st.markdown('**秘境（主玩法）**')
s1, s2, s3, s4 = st.columns(4)
if has_players and len(stage_df) > 0 and total > 0:
    has_stage = int((stage_df['farthest_normal_ch'] > 0).sum())
    s1.metric('有秘境进度占比', f'{has_stage/total*100:.1f}%', help='至少通过一关普通秘境')
    s2.metric('总星数·中位', f'{stage_df["stage_total_stars"].median():.0f}')
    s3.metric('普通关通关·中位', f'{stage_df["stage_normal_cleared"].median():.0f}')
    s4.metric('精英关通关·中位', f'{stage_df["stage_elite_cleared"].median():.0f}')
else:
    s1.metric('秘境数据', '—', help='无玩家数据或无法解析 stageClearRecord')

st.markdown('**通天塔（肉鸽）**')
col1, col2, col3, col4 = st.columns(4)
col1.metric('玩家总数', total)
if has_players and total > 0:
    col2.metric('塔通关率(≥30层)', f'{tower_cleared/total*100:.1f}%')
    col3.metric('塔·均最高层', f'{floors.mean():.1f}')
    col4.metric('塔·人均对局', f'{runs.mean():.1f}')
    col5, col6 = st.columns(2)
    col5.metric('中位连击', f'{combos[combos>0].median():.0f}' if (combos > 0).any() else '-')
    col6.metric('中位图鉴', f'{dex_counts[dex_counts>0].median():.0f}' if (dex_counts > 0).any() else '-')
else:
    col2.metric('塔通关率(≥30层)', '—')
    col3.metric('塔·均最高层', '—')
    col4.metric('塔·人均对局', '—')
    col5, col6 = st.columns(2)
    col5.metric('中位连击', '—')
    col6.metric('中位图鉴', '—')

st.divider()

# ========== Tab 页 ==========

tab_balance, tab_stage, tab_player, tab0, tab1, tab2, tab3, tab4, tab5, tab6, tab7 = st.tabs([
    '📐 游戏数值配置',
    '🗺️ 秘境（主玩法）',
    '👤 玩家透视',
    '🏆 通天塔榜',
    '📊 塔进度分布',
    '⚔️ 数值平衡',
    '🐾 宠物生态',
    '🧘 修炼系统',
    '🏰 秘境关卡漏斗',
    '💎 经济与引导',
    '📎 排行·未完成局·挂机',
])

# ---------- Tab：仓库静态数值（灵宠 / 法宝 / 养成常量）----------
with tab_balance:
    st.subheader('游戏数值配置（与客户端同步）')
    st.caption(
        '数据直接 `require` 仓库 `js/data/pets.js`、`weapons.js`、`constants.js`，不依赖玩家导出；'
        '改表后刷新本页即可对照。局内实际战力还受 buff、关卡缩放等影响，此处仅为配置底表。'
    )
    if static_pets_balance_dataframe is None or static_weapons_balance_dataframe is None:
        st.error('无法从 analyze 加载静态表导出函数。')
    else:
        try:
            pets_cfg = static_pets_balance_dataframe()
        except Exception as e:
            pets_cfg = pd.DataFrame()
            st.error(f'读取灵宠静态表失败（需本机 node 可用）: {e}')
        try:
            weapons_cfg = static_weapons_balance_dataframe()
        except Exception as e:
            weapons_cfg = pd.DataFrame()
            st.error(f'读取法宝静态表失败: {e}')
        try:
            pool_const = load_pool_growth_constants_json() if load_pool_growth_constants_json else {}
        except Exception as e:
            pool_const = {}
            st.warning(f'读取 constants 失败: {e}')

        enemies_df = pd.DataFrame()
        stages_df = pd.DataFrame()
        combat_bal = {}
        if static_enemies_balance_dataframe:
            try:
                enemies_df = static_enemies_balance_dataframe()
            except Exception as e:
                st.warning(f'敌人注册表导出失败: {e}')
        if static_stages_summary_dataframe:
            try:
                stages_df = static_stages_summary_dataframe()
            except Exception as e:
                st.warning(f'秘境关卡导出失败: {e}')
        if load_balance_combat_scalars_json:
            try:
                combat_bal = load_balance_combat_scalars_json()
            except Exception as e:
                st.warning(f'balance/enemy 导出失败: {e}')

        tower_ref = {}
        if load_tower_floors_reference_json:
            try:
                tower_ref = load_tower_floors_reference_json()
            except Exception as e:
                st.warning(f'通天塔逐层数值导出失败: {e}')

        bal_all = {}
        if load_balance_all_json:
            try:
                bal_all = load_balance_all_json()
            except Exception as e:
                st.warning(f'balance 全量数据导出失败: {e}')

        _pet_names = _cached_pet_names()
        _wpn_details = _cached_weapon_details()

        bc1, bc2, bc3, bc4, bc5, bc6 = st.tabs([
            '🐾 灵宠 · 技能 / 基础 atk / cd',
            '⚔️ 法宝全表',
            '📈 灵宠池养成（可读）',
            '👹 敌人注册表',
            '🗺️ 秘境关卡数值',
            '🗼 通天塔数值',
        ])

        with bc1:
            if pets_cfg.empty:
                st.info('无灵宠表数据')
            else:
                attr_opts = ['(全部)'] + sorted(pets_cfg['attr'].dropna().unique().tolist())
                r_opts = ['(全部)'] + sorted(pets_cfg['rarity'].dropna().unique().tolist())
                st_col, ty_col = st.columns(2)
                with st_col:
                    fa = st.selectbox('属性', attr_opts, key='cfg_pet_attr')
                with ty_col:
                    fr = st.selectbox('品质', r_opts, key='cfg_pet_rarity')
                q = st.text_input('筛选：名称 / id / 技能名 / 技能类型 子串', '', key='cfg_pet_q')
                dfp = pets_cfg
                if fa != '(全部)':
                    dfp = dfp[dfp['attr'] == fa]
                if fr != '(全部)':
                    dfp = dfp[dfp['rarity'] == fr]
                if q.strip():
                    qv = q.strip().lower()
                    mask = (
                        dfp['id'].astype(str).str.lower().str.contains(qv, na=False)
                        | dfp['name'].astype(str).str.lower().str.contains(qv, na=False)
                        | dfp['skillName'].astype(str).str.lower().str.contains(qv, na=False)
                        | dfp['skillType'].astype(str).str.lower().str.contains(qv, na=False)
                    )
                    dfp = dfp[mask]
                st.dataframe(
                    dfp.rename(columns={
                        'id': '宠物ID', 'name': '名称', 'attr': '属性', 'rarity': '品质',
                        'baseAtk': '基础atk', 'skillCd': '技能CD', 'skillName': '技能名',
                        'skillType': '技能类型', 'skillDesc': '技能描述',
                    }),
                    use_container_width=True,
                    hide_index=True,
                    height=480,
                )
                st.caption(f'共 {len(dfp)} / {len(pets_cfg)} 只 · pets.js getAllPets')
                c1, c2 = st.columns(2)
                with c1:
                    if 'skillType' in dfp.columns:
                        agg = dfp.groupby('skillType', dropna=False).size().reset_index(name='只数')
                        fig = px.bar(agg.sort_values('只数', ascending=False).head(24),
                                     x='skillType', y='只数', title='技能效果类型分布（筛选后）')
                        st.plotly_chart(fig, use_container_width=True)
                with c2:
                    if not dfp.empty and 'rarity' in dfp.columns and 'baseAtk' in dfp.columns:
                        fig = px.box(dfp, x='rarity', y='baseAtk', title='基础 atk 按品质（筛选后）')
                        st.plotly_chart(fig, use_container_width=True)
                csv_p = dfp.to_csv(index=False).encode('utf-8-sig')
                st.download_button('下载灵宠配置 CSV', csv_p, 'static_pets_balance.csv', 'text/csv', key='dl_pets_cfg')

        with bc2:
            if weapons_cfg.empty:
                st.info('无法宝表数据')
            else:
                st.caption(
                    '「掉落档位」= `weapons.js` 里 **WEAPON_RARITY** 的分组，用于固定关等奖池权重，'
                    '**不是**法宝配置对象上的品质属性（与灵宠 R/SR/SSR 命名易混，故不用「品质」一词）。'
                    '「—」多为通天塔专属等未进该分档的 id。'
                )
                wty = ['(全部)'] + sorted(weapons_cfg['type'].dropna().unique().tolist())
                rw = ['(全部)'] + sorted(weapons_cfg['dropTier'].dropna().unique().tolist())
                u1, u2 = st.columns(2)
                with u1:
                    ft = st.selectbox('法宝效果类型', wty, key='cfg_w_type')
                with u2:
                    fwr = st.selectbox('掉落档位（奖池分组）', rw, key='cfg_w_rarity')
                wq = st.text_input('筛选：名称 / id / 描述 子串', '', key='cfg_w_q')
                dfw = weapons_cfg
                if ft != '(全部)':
                    dfw = dfw[dfw['type'] == ft]
                if fwr != '(全部)':
                    dfw = dfw[dfw['dropTier'] == fwr]
                if wq.strip():
                    wql = wq.strip().lower()
                    dfw = dfw[
                        dfw['id'].astype(str).str.lower().str.contains(wql, na=False)
                        | dfw['name'].astype(str).str.lower().str.contains(wql, na=False)
                        | dfw['desc'].astype(str).str.lower().str.contains(wql, na=False)
                    ]
                st.dataframe(
                    dfw.rename(columns={
                        'id': '法宝ID', 'name': '名称', 'dropTier': '掉落档位', 'type': '效果类型', 'desc': '描述',
                    }),
                    use_container_width=True,
                    hide_index=True,
                    height=480,
                )
                st.caption(f'共 {len(dfw)} / {len(weapons_cfg)} 件 · WEAPONS')
                st.download_button('下载法宝配置 CSV', dfw.to_csv(index=False).encode('utf-8-sig'),
                                   'static_weapons_balance.csv', 'text/csv', key='dl_w_cfg')

        with bc3:
            st.caption(
                '与 `petPoolConfig.js` / `constants.js` 中 POOL_* 一致；升级具体公式见客户端 `petExpToNextLevel`。'
            )
            if not pool_const:
                st.info('无 constants 数据（需 node 拉取 constants）')
            else:
                def _dict_star_table(d, val_name):
                    if not isinstance(d, dict):
                        return pd.DataFrame()
                    keys = sorted(d.keys(), key=lambda x: int(x) if str(x).isdigit() else 0)
                    return pd.DataFrame([{'星级': str(k), val_name: d[k]} for k in keys])

                scalar_order = [
                    'POOL_MAX_LV', 'POOL_ADV_MAX_LV', 'POOL_R_LV_BONUS_RATE',
                    'POOL_EXP_BASE', 'POOL_EXP_LINEAR', 'POOL_EXP_POW_EXP', 'POOL_EXP_POW_COEFF',
                ]
                sc_rows = []
                for key in scalar_order:
                    if key not in pool_const:
                        continue
                    v = pool_const[key]
                    sc_rows.append({
                        '配置项': key,
                        '说明': _POOL_CFG_HELP.get(key, ''),
                        '值': v,
                    })
                for key, v in pool_const.items():
                    if key in scalar_order or isinstance(v, dict):
                        continue
                    sc_rows.append({
                        '配置项': key,
                        '说明': _POOL_CFG_HELP.get(key, ''),
                        '值': json.dumps(v, ensure_ascii=False) if isinstance(v, (list, dict)) else v,
                    })
                if sc_rows:
                    st.markdown('##### 标量与简单参数')
                    st.dataframe(pd.DataFrame(sc_rows), use_container_width=True, hide_index=True)

                col_a, col_b = st.columns(2)
                with col_a:
                    sam = pool_const.get('POOL_STAR_ATK_MUL')
                    if isinstance(sam, dict):
                        st.markdown('##### 升星 · 攻击力倍率')
                        st.dataframe(_dict_star_table(sam, '攻击力倍率'), use_container_width=True, hide_index=True)
                    sfc = pool_const.get('POOL_STAR_FRAG_COST')
                    if isinstance(sfc, dict):
                        st.markdown('##### 升星 · 消耗碎片')
                        st.dataframe(_dict_star_table(sfc, '消耗碎片'), use_container_width=True, hide_index=True)
                with col_b:
                    slc = pool_const.get('POOL_STAR_LV_CAP')
                    if isinstance(slc, dict):
                        st.markdown('##### 各星级 · 等级上限')
                        st.dataframe(_dict_star_table(slc, '等级上限'), use_container_width=True, hide_index=True)
                    slr = pool_const.get('POOL_STAR_LV_REQ')
                    if isinstance(slr, dict):
                        st.markdown('##### 升星 · 所需灵宠等级')
                        st.dataframe(_dict_star_table(slr, '所需等级'), use_container_width=True, hide_index=True)

                rem = pool_const.get('POOL_RARITY_EXP_MUL')
                if isinstance(rem, dict):
                    st.markdown('##### 品质 · 升级经验倍率（相对基础公式）')
                    _r_ord = {'R': 0, 'SR': 1, 'SSR': 2}
                    st.dataframe(
                        pd.DataFrame([{'品质': k, '经验倍率': rem[k]} for k in sorted(rem.keys(), key=lambda x: _r_ord.get(x, 9))]),
                        use_container_width=True, hide_index=True,
                    )

                awake = pool_const.get('POOL_STAR_AWAKEN_COST')
                if isinstance(awake, dict) and awake:
                    st.markdown('##### 觉醒消耗（若有）')
                    st.dataframe(
                        pd.DataFrame([{'档位': k, '消耗': json.dumps(awake[k], ensure_ascii=False) if isinstance(awake[k], dict) else awake[k]} for k in awake]),
                        use_container_width=True, hide_index=True,
                    )

                st.info(
                    '**升级经验（概念）**：对每只宠，下一级所需经验 ≈ '
                    '⌊(POOL_EXP_BASE + Lv×LINEAR + Lv^POW_EXP×COEFF) × POOL_RARITY_EXP_MUL[该宠品质]⌋ '
                    '（详见 `petPoolConfig.petExpToNextLevel`）。'
                )

                with st.expander('查看原始 JSON（调试可复制）'):
                    st.json(pool_const)

        with bc4:
            st.caption('`enemyRegistry.js` 中 ENEMIES：秘境关卡引用这些 id；面板为配置底表，进关后可能有 Boss 保底/精英倍率等再缩放。')
            if enemies_df.empty:
                st.info('无敌人表')
            else:
                ea = ['(全部)'] + sorted(enemies_df['attr'].dropna().unique().tolist())
                c_f1, c_f2 = st.columns(2)
                with c_f1:
                    f_attr = st.selectbox('属性', ea, key='cfg_enemy_attr')
                with c_f2:
                    fe_q = st.text_input('筛选 id / 名称 / 技能', '', key='cfg_enemy_q')
                ed = enemies_df
                if f_attr != '(全部)':
                    ed = ed[ed['attr'] == f_attr]
                if fe_q.strip():
                    t = fe_q.strip().lower()
                    ed = ed[
                        ed['id'].astype(str).str.lower().str.contains(t, na=False)
                        | ed['name'].astype(str).str.lower().str.contains(t, na=False)
                        | ed['skills'].astype(str).str.lower().str.contains(t, na=False)
                    ]
                st.dataframe(
                    ed.rename(columns={
                        'id': '敌人ID', 'name': '名称', 'attr': '属性', 'hp': 'HP', 'atk': '攻击',
                        'def': '防御', 'skills': '技能keys', 'isBoss': 'Boss', 'isElite': '精英标记',
                    }),
                    use_container_width=True, hide_index=True, height=420,
                )
                st.download_button('下载敌人表 CSV', ed.to_csv(index=False).encode('utf-8-sig'),
                                   'static_enemies.csv', 'text/csv', key='dl_enemy')

            if combat_bal:
                st.markdown('##### 秘境精英血量/攻防倍率（按章节 STAGE_ELITE_MULTIPLIERS）')
                sem = combat_bal.get('STAGE_ELITE_MULTIPLIERS')
                if isinstance(sem, dict):
                    srows = [{'chapter': ch, **(sem[ch] if isinstance(sem[ch], dict) else {})} for ch in sorted(sem.keys(), key=lambda x: int(x) if str(x).isdigit() else 0)]
                    st.dataframe(pd.DataFrame(srows), use_container_width=True, hide_index=True)
                _tower_related = frozenset({
                    'MONSTER_TIERS', 'TOWER_ELITE_MUL', 'TOWER_BOSS_SCALING', 'MONSTER_RANDOM_RANGE',
                })
                _other_cb = {
                    k: combat_bal[k] for k in combat_bal
                    if k not in ('MONSTER_TIERS', 'STAGE_ELITE_MULTIPLIERS') and k not in _tower_related
                }
                with st.expander('其它秘境相关缩放（Boss 保底、小怪血量折扣、防御折算等）'):
                    st.json(_other_cb)

        with bc5:
            st.caption('由 `stages.js` 构建的 STAGES：主战斗体为每关 **最后一波** 第一个敌人（含 Boss 关底缩放后的面板）。')
            if stages_df.empty:
                st.info('无关卡表')
            else:
                ch_opt = ['(全部)'] + [str(x) for x in sorted(stages_df['chapter'].dropna().unique().tolist())]
                od_opt = ['(全部)'] + [str(x) for x in sorted(stages_df['order'].dropna().unique().tolist())]
                df_opt = ['(全部)', 'normal', 'elite']
                g1, g2, g3 = st.columns(3)
                with g1:
                    gc = st.selectbox('章节', ch_opt, key='cfg_stage_ch')
                with g2:
                    go = st.selectbox('关序', od_opt, key='cfg_stage_ord')
                with g3:
                    gd = st.selectbox('难度', df_opt, key='cfg_stage_diff')
                gq = st.text_input('筛选 关卡 id / 显示名', '', key='cfg_stage_q')
                sd = stages_df
                if gc != '(全部)':
                    sd = sd[sd['chapter'] == int(gc)]
                if go != '(全部)':
                    sd = sd[sd['order'] == int(go)]
                if gd != '(全部)':
                    sd = sd[sd['difficulty'] == gd]
                if gq.strip():
                    t = gq.strip().lower()
                    sd = sd[
                        sd['id'].astype(str).str.lower().str.contains(t, na=False)
                        | sd['displayName'].astype(str).str.lower().str.contains(t, na=False)
                    ]

                st5_battle, st5_reward = st.tabs(['⚔️ 战斗数值', '🎁 奖励数值'])
                _stage_rename_battle = {
                    'id': '关卡ID', 'displayName': '名称', 'chapter': '章', 'order': '关',
                    'globalOrd': '秘境序', 'recCultLevel': '推荐修炼', 'recPetStar': '推荐星级',
                    'difficulty': '难度', 'stamina': '体力', 'battleSoulStone': '局内灵石',
                    'enemyName': '主敌人', 'hp': 'HP', 'atk': '攻击', 'def': '防御',
                    'sTurnLimit': 'S评价回合≤', 'aTurnLimit': 'A评价回合≤',
                }
                _stage_rename_reward = {
                    'id': '关卡ID', 'displayName': '名称', 'chapter': '章', 'order': '关',
                    'globalOrd': '秘境序', 'recCultLevel': '推荐修炼', 'recPetStar': '推荐星级',
                    'difficulty': '难度',
                    'fcPetName': '首通宠物(整宠)', 'fcPetId': '宠物ID', 'fcPetRarity': '宠物品质',
                    'fcPetFrag': '重复碎片数', 'fcPetLvCap': '宠物养成上限',
                    'fcWeaponName': '首通法宝(整件)', 'fcWeaponId': '法宝ID',
                    'fcWeaponOrd': '法宝档位', 'fcWeaponRarity': '法宝品质',
                    'fcExp': '首通经验', 'fcSoulStone': '首通灵石',
                    'rpFragMin': '重复碎片min', 'rpFragMax': '重复碎片max',
                    'rpExp': '重复经验', 'rpSoulStone': '重复灵石',
                }
                _battle_cols = [c for c in _stage_rename_battle if c in sd.columns]
                _reward_cols = [c for c in _stage_rename_reward if c in sd.columns]

                with st5_battle:
                    st.caption('秘境序 / 推荐修炼 / 推荐星级含义同「奖励数值」页说明。')
                    st.dataframe(
                        sd[_battle_cols].rename(columns=_stage_rename_battle),
                        use_container_width=True, hide_index=True, height=480,
                    )
                with st5_reward:
                    st.caption(
                        '首通宠物奖励为**整宠**直接入池；重复获得时转为升星碎片（R=3片 SR=5片 SSR=10片）。法宝为**整件**直接获得。'
                        ' 秘境序：全局第 1～96 关进度；推荐修炼/星级见 `CHAPTER_RECOMMENDED`。'
                    )
                    rd = sd[_reward_cols].copy()
                    st.dataframe(
                        rd.rename(columns=_stage_rename_reward),
                        use_container_width=True, hide_index=True, height=480,
                    )

                    if bal_all:
                        with st.expander('🎯 品质配额表（来自 balance/stage.js）'):
                            def _quota_df(quota_dict, label):
                                rows = []
                                for ch in range(1, 13):
                                    q = quota_dict.get(str(ch), quota_dict.get(ch, {}))
                                    rows.append({'章': ch, 'R': q.get('R', 0), 'SR': q.get('SR', 0), 'SSR': q.get('SSR', 0)})
                                df = pd.DataFrame(rows)
                                df.columns = ['章', f'{label} R', f'{label} SR', f'{label} SSR']
                                return df

                            npq = bal_all.get('NORMAL_PET_QUOTA', {})
                            epq = bal_all.get('ELITE_PET_QUOTA', {})
                            nwq = bal_all.get('NORMAL_WPN_QUOTA', {})
                            ewq = bal_all.get('ELITE_WPN_QUOTA', {})

                            st.markdown('**宠物品质配额**（每章 8 只）')
                            pet_q = _quota_df(npq, '普通').merge(_quota_df(epq, '精英'), on='章')
                            st.dataframe(pet_q, use_container_width=True, hide_index=True)

                            st.markdown('**法宝品质配额**（每章 4 把）')
                            wpn_q = _quota_df(nwq, '普通').merge(_quota_df(ewq, '精英'), on='章')
                            st.dataframe(wpn_q, use_container_width=True, hide_index=True)

                            boss_min = bal_all.get('BOSS_REWARD_MIN_RARITY', {})
                            if boss_min:
                                st.markdown('**Boss 关(x-8)保底品质**')
                                boss_rows = []
                                for ch in range(1, 13):
                                    boss_rows.append({
                                        '章': ch,
                                        '普通宠物': boss_min.get('normalPet', {}).get(str(ch), ''),
                                        '精英宠物': boss_min.get('elitePet', {}).get(str(ch), ''),
                                        '普通法宝': boss_min.get('normalWpn', {}).get(str(ch), ''),
                                        '精英法宝': boss_min.get('eliteWpn', {}).get(str(ch), ''),
                                    })
                                st.dataframe(pd.DataFrame(boss_rows), use_container_width=True, hide_index=True)

                            overrides = bal_all.get('STAGE_REWARD_PET_OVERRIDES', {})
                            if overrides:
                                st.markdown('**特殊覆盖**（避免与新手赠送宠物重复）')
                                ov_display = [
                                    {'关卡': f'stage_{k.replace("_", "-")}', '覆盖宠物ID': v,
                                     '宠物名称': _pet_names.get(v, v)}
                                    for k, v in overrides.items()
                                ]
                                st.dataframe(pd.DataFrame(ov_display), use_container_width=True, hide_index=True)

                st.caption(f'共 {len(sd)} / {len(stages_df)} 条')
                st.download_button('下载关卡摘要 CSV', sd.to_csv(index=False).encode('utf-8-sig'),
                                   'static_stages_summary.csv', 'text/csv', key='dl_stage')

        with bc6:
            st.subheader('通天塔（肉鸽）数值')
            st.caption(
                '数据来自 `balance/enemy.js`（MONSTER_TIERS、精英/Boss 倍率）与 `tower.js`（`generateMonster` / '
                '`generateElite` / `generateBoss`）。逐层表为随机系数取中位后的典型值，供调优对照。'
            )
            if combat_bal:
                st.markdown('##### 层段 hp/atk 区间（MONSTER_TIERS）')
                tiers = combat_bal.get('MONSTER_TIERS')
                if isinstance(tiers, list):
                    st.dataframe(pd.DataFrame(tiers), use_container_width=True, hide_index=True)
                st.markdown('##### 精英 / Boss 倍率（TOWER_ELITE_MUL · TOWER_BOSS_SCALING）')
                ctw1, ctw2 = st.columns(2)
                with ctw1:
                    st.caption('精英：hp = 基础×(2.8~3.5)，atk×(1.8~2.3)，def×固定倍率')
                    tel = combat_bal.get('TOWER_ELITE_MUL')
                    if tel:
                        st.json(tel)
                with ctw2:
                    st.caption('Boss：按 floor/10 档递增至上限')
                    tbs = combat_bal.get('TOWER_BOSS_SCALING')
                    if tbs:
                        st.json(tbs)
                rnd = combat_bal.get('MONSTER_RANDOM_RANGE')
                if rnd:
                    st.caption(f'MONSTER_RANDOM_RANGE（普通怪 hp/atk 额外浮动）: `{rnd}`')

            if tower_ref and tower_ref.get('normal') and len(tower_ref['normal']) > 0:
                st.markdown('##### 逐层典型面板（与 `tower.js` 一致）')
                _tel_def = '—'
                if combat_bal and isinstance(combat_bal.get('TOWER_ELITE_MUL'), dict):
                    _tel_def = combat_bal['TOWER_ELITE_MUL'].get('def', '—')
                st.caption(
                    f"层数 1–{tower_ref.get('towerMaxFloor', 30)}。**普通**：插值 × RANDOM 中点 "
                    f"({tower_ref.get('randMid')})；**精英**：hp/atk 区间中点 "
                    f"{tower_ref.get('eliteHpMulMid', 0):.3f} / {tower_ref.get('eliteAtkMulMid', 0):.3f}，def×{_tel_def}；"
                    '**Boss**：10/20/30 层，`TOWER_BOSS_SCALING`。实局仍有波动。'
                )
                tw1, tw2, tw3 = st.tabs(['普通遭遇', '精英遭遇', 'Boss(10·20·30层)'])
                _tw_rename = {'floor': '层数', 'hp': 'HP', 'atk': '攻击', 'def': '防御'}
                with tw1:
                    st.dataframe(
                        pd.DataFrame(tower_ref['normal']).rename(columns=_tw_rename),
                        use_container_width=True, hide_index=True, height=360,
                    )
                    st.download_button(
                        '下载普通层 CSV',
                        pd.DataFrame(tower_ref['normal']).to_csv(index=False).encode('utf-8-sig'),
                        'tower_normal_floors.csv', 'text/csv', key='dl_tw_n',
                    )
                with tw2:
                    st.dataframe(
                        pd.DataFrame(tower_ref['elite']).rename(columns=_tw_rename),
                        use_container_width=True, hide_index=True, height=360,
                    )
                    st.download_button(
                        '下载精英层 CSV',
                        pd.DataFrame(tower_ref['elite']).to_csv(index=False).encode('utf-8-sig'),
                        'tower_elite_floors.csv', 'text/csv', key='dl_tw_e',
                    )
                with tw3:
                    boss_rf = tower_ref.get('boss') or []
                    st.dataframe(
                        pd.DataFrame(boss_rf).rename(columns={
                            'floor': '层数', 'hp': 'HP', 'atk': '攻击', 'def': '防御',
                            'hpMul': '应用HP倍率', 'atkMul': '应用攻击倍率', 'defMul': '应用防御倍率',
                            'bossLevel': 'boss档(≈层/10)',
                        }),
                        use_container_width=True, hide_index=True,
                    )
                    st.download_button(
                        '下载 Boss 层 CSV',
                        pd.DataFrame(boss_rf).to_csv(index=False).encode('utf-8-sig'),
                        'tower_boss_floors.csv', 'text/csv', key='dl_tw_b',
                    )
            else:
                st.info('未能生成通天塔逐层表（需 node 与 analyze.load_tower_floors_reference_json）')

# ---------- Tab 秘境：主玩法进度 ----------
with tab_stage:
    st.subheader('秘境进度总览')
    st.caption(
        '来自 `stageClearRecord`：总星数为各关最高评级 B/A/S 折算星数之和；最远关按已通关普通/精英关推进计算。'
    )
    if build_stage_leaderboard_rows is None:
        st.error('无法加载 build_stage_leaderboard_rows')
    elif len(stage_df) == 0:
        st.info('无 stageClearRecord 可用数据')
    else:
        c_a, c_b = st.columns(2)
        with c_a:
            fig = px.histogram(
                stage_df, x='stage_total_stars', nbins=min(40, max(12, int(stage_df['stage_total_stars'].max()) + 2)),
                title='秘境：总星数分布',
                labels={'stage_total_stars': '总星数', 'count': '玩家数'},
                color_discrete_sequence=['#5C6BC0'],
            )
            fig.add_vline(
                x=stage_df['stage_total_stars'].median(), line_dash='dash', line_color='red',
                annotation_text=f"中位 {stage_df['stage_total_stars'].median():.0f}")
            st.plotly_chart(fig, use_container_width=True)
        with c_b:
            prog = stage_df['farthest_normal_ch'] * 100 + stage_df['farthest_normal_ord']
            prog_ok = prog[prog > 0]
            if len(prog_ok) > 0:
                fig = px.histogram(
                    prog_ok, nbins=32,
                    title='最远普通关进度分（章×100+关，仅已过关玩家）',
                    labels={'value': '进度分', 'count': '玩家数'},
                    color_discrete_sequence=['#7E57C2'],
                )
                fig.add_vline(x=prog_ok.median(), line_dash='dash', line_color='red',
                              annotation_text=f"中位 {prog_ok.median():.0f}")
                st.plotly_chart(fig, use_container_width=True)
            else:
                st.info('暂无普通秘境通关记录')

        c_c, c_d = st.columns(2)
        with c_c:
            fig = px.histogram(
                stage_df, x='stage_normal_cleared', nbins=max(20, int(stage_df['stage_normal_cleared'].max()) + 2),
                title='普通秘境：已通关关卡数分布',
                labels={'stage_normal_cleared': '关卡数', 'count': '玩家数'},
                color_discrete_sequence=['#26A69A'],
            )
            st.plotly_chart(fig, use_container_width=True)
        with c_d:
            fig = px.histogram(
                stage_df, x='stage_elite_cleared', nbins=max(12, int(stage_df['stage_elite_cleared'].max()) + 2),
                title='精英秘境：已通关关卡数分布',
                labels={'stage_elite_cleared': '关卡数', 'count': '玩家数'},
                color_discrete_sequence=['#FF7043'],
            )
            st.plotly_chart(fig, use_container_width=True)

        st.subheader('本地秘境进度榜')
        st_rows = build_stage_leaderboard_rows(players)
        st_lb = pd.DataFrame(st_rows)
        if not st_lb.empty:
            if '_updateTime' in st_lb.columns:
                st_lb['更新时间'] = pd.to_datetime(st_lb['_updateTime'], unit='ms').dt.strftime('%Y-%m-%d %H:%M')
            disp = st_lb.rename(columns={
                'rank': '名次',
                '_openid': 'OpenID',
                'stage_total_stars': '总星数',
                'stage_normal_cleared': '普通通关数',
                'stage_elite_cleared': '精英通关数',
                'farthest_normal_label': '最远普通关',
                'farthest_elite_label': '最远精英关',
            })
            show_cols = [c for c in ['名次', 'OpenID', '总星数', '普通通关数', '精英通关数', '最远普通关', '最远精英关', '更新时间'] if c in disp.columns]
            st.dataframe(disp[show_cols], use_container_width=True, hide_index=True)
            st.download_button(
                label='下载秘境榜 CSV',
                data=disp[show_cols].to_csv(index=False).encode('utf-8-sig'),
                file_name='local_stage_leaderboard.csv',
                mime='text/csv',
            )

# ---------- Tab 玩家透视（单玩家：灵宠、法宝、秘境等）----------
with tab_player:
    st.subheader('单玩家档案')
    st.caption(
        '从全量 playerData 中选一人，查看灵宠池、已拥有法宝、秘境通关、图鉴与碎片等；名称自仓库 js 静态表解析。'
    )
    if not has_players:
        st.info('暂无玩家导出数据，请先刷新侧边栏数据后再使用本页。')
    elif (
        build_player_select_labels is None
        or pet_pool_dataframe is None
        or format_player_record_readable is None
    ):
        st.error('无法加载 analyze 单玩家模块')
    else:
        filter_q = st.text_input(
            '查找（完整 OpenID / OpenID 一段 / 与下方展示文案任意子串匹配，不区分大小写）',
            '',
            key='player_insight_filter',
        )
        labels = build_player_select_labels(players)

        def _player_openid_lower(player_idx):
            p = players[player_idx]
            if not isinstance(p, dict):
                return ''
            return str(p.get('_openid') or p.get('openid') or '').lower()

        if filter_q.strip():
            q = filter_q.strip().lower()
            labels = [
                (lab, idx) for lab, idx in labels
                if q in lab.lower() or q in _player_openid_lower(idx)
            ]
        if not labels:
            st.warning('没有匹配的玩家，请清空筛选或换关键词')
        else:
            label_list = [x[0] for x in labels]
            indices = [x[1] for x in labels]
            pick = st.selectbox(
                f'选择玩家（共 {len(labels)} 人）',
                range(len(label_list)),
                format_func=lambda i: label_list[i],
            )
            rec = players[indices[pick]]
            oid = str(rec.get('_openid') or rec.get('openid') or '')
            sp = compute_stage_progress(rec) if compute_stage_progress else {}

            wdet = _cached_weapon_details()
            pnames = _cached_pet_names()

            m1, m2, m3, m4 = st.columns(4)
            m1.metric('OpenID', oid[-12:] if len(oid) >= 12 else oid or '—')
            m2.metric('秘境总星', sp.get('stage_total_stars', 0))
            m3.metric('通天塔最高层', int(rec.get('bestFloor') or 0))
            m4.metric('灵宠池人数', len(rec.get('petPool') or []) if isinstance(rec.get('petPool'), list) else 0)

            if format_stage_farthest_label:
                st.write(
                    f"**最远普通关** {format_stage_farthest_label(sp, False)} · "
                    f"**最远精英** {format_stage_farthest_label(sp, True)} · "
                    f"**当前装备法宝** `{rec.get('equippedWeaponId') or '无'}`"
                )

            cult = rec.get('cultivation') if isinstance(rec.get('cultivation'), dict) else {}
            if cult:
                with st.expander('修炼 cultivation（等级 / 五维）'):
                    st.json({
                        'level': cult.get('level'),
                        'exp': cult.get('exp'),
                        'skillPoints': cult.get('skillPoints'),
                        'levels': cult.get('levels'),
                    })

            pu1, pu2 = st.columns(2)
            with pu1:
                st.markdown('**秘境编队 savedStageTeam**')
                if saved_stage_team_dataframe is not None:
                    tdf = saved_stage_team_dataframe(rec, pnames)
                else:
                    tdf = pd.DataFrame()
                if not tdf.empty:
                    st.dataframe(tdf, use_container_width=True, hide_index=True)
                else:
                    st.caption('无保存编队')

            with pu2:
                st.markdown('**体力 stamina**')
                stm = rec.get('stamina') if isinstance(rec.get('stamina'), dict) else {}
                if stm:
                    st.json(stm)
                else:
                    st.caption('无 stamina 字段')

            ptab1, ptab2, ptab3, ptab4, ptab5 = st.tabs([
                '🐾 灵宠池 & 图鉴',
                '⚔️ 法宝',
                '🗺️ 秘境通关明细',
                '💎 碎片 & 派遣',
                '📄 文本摘要 & JSON',
            ])

            with ptab1:
                c1, c2 = st.columns(2)
                with c1:
                    st.markdown('**灵宠池**（养成状态）')
                    st.caption(
                        '**品质** R/SR/SSR：宠物静态稀有度，与养成无关；'
                        '**星级**：升星档位；**养成等级**：灵宠池中的 Lv（经验升级，≠品质）。'
                    )
                    ppdf = pet_pool_dataframe(rec, pnames)
                    if ppdf.empty:
                        st.caption('灵宠池为空')
                    else:
                        st.dataframe(ppdf, use_container_width=True, hide_index=True)
                        st.caption(f'共 {len(ppdf)} 只')
                with c2:
                    st.markdown('**图鉴 petDex**（≥3星收录）')
                    ddf = pet_dex_dataframe(rec, pnames)
                    if ddf.empty:
                        st.caption('图鉴为空')
                    else:
                        st.dataframe(ddf, use_container_width=True, hide_index=True)
                        st.caption(f'共 {len(ddf)} 条')

            with ptab2:
                st.markdown('**已拥有法宝 weaponCollection**')
                wwdf = weapon_collection_dataframe(rec, wdet)
                if wwdf.empty:
                    st.caption('无法宝数据')
                else:
                    st.dataframe(wwdf, use_container_width=True, hide_index=True)
                st.markdown('**通天塔历史阵容（stats.bestFloorPets / bestFloorWeapon）**')
                raw_stats = rec.get('stats') if isinstance(rec.get('stats'), dict) else {}
                bpets = raw_stats.get('bestFloorPets') if isinstance(raw_stats.get('bestFloorPets'), list) else []
                if bpets:
                    bdf = pd.DataFrame(bpets)
                    st.dataframe(bdf, use_container_width=True, hide_index=True)
                else:
                    st.caption('无最高层阵容记录')
                bw = raw_stats.get('bestFloorWeapon')
                if isinstance(bw, dict):
                    st.json(bw)
                elif bw:
                    st.text(str(bw))

            with ptab3:
                scdf = stage_clear_dataframe(rec)
                if scdf.empty:
                    st.caption('暂无秘境通关记录')
                else:
                    st.dataframe(scdf, use_container_width=True, hide_index=True)
                    st.caption(f'已通关 {len(scdf)} 条关卡记录')

            with ptab4:
                a1, a2 = st.columns(2)
                with a1:
                    st.markdown('**碎片银行 fragmentBank**（未入池）')
                    fbdf = fragment_bank_dataframe(rec)
                    if fbdf.empty:
                        st.caption('无碎片银行数据')
                    else:
                        fbdf2 = fbdf.copy()
                        fbdf2['名称'] = fbdf2['宠物ID'].map(lambda x: pnames.get(str(x), ''))
                        st.dataframe(fbdf2, use_container_width=True, hide_index=True)
                with a2:
                    st.markdown('**派遣挂机 idleDispatch**')
                    idf = idle_dispatch_dataframe(rec, pnames)
                    if idf.empty:
                        st.caption('无派遣中槽位')
                    else:
                        st.dataframe(idf, use_container_width=True, hide_index=True)
                soul = rec.get('soulStone')
                aw = rec.get('awakenStone')
                if soul is not None or aw is not None:
                    st.write(f'灵石 soulStone: **{soul}** · 觉醒石 awakenStone: **{aw}**')

            with ptab5:
                try:
                    readable = format_player_record_readable(rec)
                    st.text_area('运营可读摘要（与 analyze 控制台一致）', readable, height=420)
                except Exception as e:
                    st.warning(f'生成可读摘要失败: {e}')
                try:
                    jraw = json.dumps(rec, ensure_ascii=False, indent=2, default=str)
                    st.download_button(
                        label='下载该玩家完整 JSON',
                        data=jraw.encode('utf-8'),
                        file_name=f'player_{oid[-8:] if len(oid) >= 8 else "data"}.json',
                        mime='application/json',
                    )
                except Exception as e:
                    st.warning(f'导出 JSON 失败: {e}')

# ---------- Tab 0: 本地最高层榜（playerData，无需排行授权）----------
with tab0:
    st.subheader('本地通天塔榜（最高层）')
    st.caption(
        '肉鸽通天塔：数据来自 playerData；排序与云端速通榜一致（层数优先；≥30层看通关回合）。'
    )
    if build_local_leaderboard_rows is None:
        st.error('无法加载 analyze.build_local_leaderboard_rows')
    else:
        lb_rows = build_local_leaderboard_rows(players)
        lb_df = pd.DataFrame(lb_rows)
        if not lb_df.empty:
            # 将毫秒时间戳转换为可读日期时间
            if '_updateTime' in lb_df.columns:
                lb_df['updateTime'] = pd.to_datetime(lb_df['_updateTime'], unit='ms').dt.strftime('%Y-%m-%d %H:%M')
            disp = lb_df.rename(columns={
                'rank': '名次',
                '_openid': 'OpenID',
                'bestFloor': '最高层',
                'bestTotalTurns': '通关回合',
                'maxCombo': '最高连击',
                'totalRuns': '总对局',
                'cultivationLevel': '修炼等级',
                'petDexCount': '图鉴数',
                'updateTime': '更新时间',
            })
            st.dataframe(disp, use_container_width=True, hide_index=True)
            csv_bytes = disp.to_csv(index=False).encode('utf-8-sig')
            st.download_button(
                label='下载 CSV',
                data=csv_bytes,
                file_name='local_floor_leaderboard.csv',
                mime='text/csv',
            )
            top_n = min(30, len(lb_df))
            head = lb_df.head(top_n)
            fig = px.bar(
                head, x='rank', y='bestFloor',
                title=f'前 {top_n} 名 — 通天塔最高层',
                labels={'rank': '名次', 'bestFloor': '最高层'},
            )
            st.plotly_chart(fig, use_container_width=True)
        else:
            st.info('无数据')

# ---------- Tab 1: 通天塔进度分布 ----------
with tab1:
    st.caption('本页为**通天塔（肉鸽）**维度；秘境主玩法见首 Tab。')
    if not has_players or df.empty or 'bestFloor' not in df.columns:
        st.info('暂无玩家数据')
    else:
        c1, c2 = st.columns(2)

        with c1:
            fig = px.histogram(df, x='bestFloor', nbins=max(int(floors.max()), 10),
                               title='通天塔：最高层数分布',
                               labels={'bestFloor': '最高层数', 'count': '玩家数'},
                               color_discrete_sequence=['#4CAF50'])
            fig.add_vline(x=floors.median(), line_dash='dash', line_color='red',
                          annotation_text=f'中位数: {floors.median():.0f}')
            st.plotly_chart(fig, use_container_width=True)

        with c2:
            fig = px.histogram(df, x='totalRuns', nbins=30,
                               title='通天塔：总对局数分布',
                               labels={'totalRuns': '总对局数', 'count': '玩家数'},
                               color_discrete_sequence=['#2196F3'])
            fig.add_vline(x=runs.median(), line_dash='dash', line_color='red',
                          annotation_text=f'中位数: {runs.median():.0f}')
            st.plotly_chart(fig, use_container_width=True)

        light = int((runs <= 5).sum())
        mid = int(((runs > 5) & (runs <= 30)).sum())
        heavy = int((runs > 30).sum())
        fig = px.pie(
            names=['轻度(≤5局)', '中度(6-30局)', '重度(>30局)'],
            values=[light, mid, heavy],
            title='玩家分层（按通天塔 totalRuns）',
            color_discrete_sequence=['#81C784', '#64B5F6', '#E57373'])
        st.plotly_chart(fig, use_container_width=True)


# ---------- Tab 2: 数值平衡 ----------
with tab2:
    c1, c2 = st.columns(2)

    with c1:
        combo_data = combos[combos > 0]
        if len(combo_data) > 0:
            fig = px.histogram(combo_data, nbins=20,
                               title='最高连击分布',
                               labels={'value': '最高连击', 'count': '玩家数'},
                               color_discrete_sequence=['#FF9800'])
            fig.add_vline(x=combo_data.median(), line_dash='dash', line_color='red',
                          annotation_text=f'中位数: {combo_data.median():.0f}')
            st.plotly_chart(fig, use_container_width=True)
        else:
            st.info('暂无连击数据')

    with c2:
        turns = stats_col.apply(lambda x: x.get('bestTotalTurns', 0) if isinstance(x, dict) else 0)
        turns_pos = turns[turns > 0]
        if len(turns_pos) > 0:
            fig = px.histogram(turns_pos, nbins=20,
                               title='通关回合数分布（仅通关玩家）',
                               labels={'value': '回合数', 'count': '玩家数'},
                               color_discrete_sequence=['#9C27B0'])
            fig.add_vline(x=turns_pos.median(), line_dash='dash', line_color='red',
                          annotation_text=f'中位数: {turns_pos.median():.0f}')
            st.plotly_chart(fig, use_container_width=True)
        else:
            st.info('暂无通关数据')


# ---------- Tab 3: 宠物生态 ----------
with tab3:
    c1, c2 = st.columns(2)

    with c1:
        pet_counter = Counter()
        for s in stats_col.dropna():
            if isinstance(s, dict):
                for p in s.get('bestFloorPets', []):
                    if isinstance(p, dict) and 'name' in p:
                        pet_counter[p['name']] += 1

        if pet_counter:
            pet_df = pd.DataFrame(pet_counter.most_common(20), columns=['宠物', '使用人数'])
            fig = px.bar(pet_df, y='宠物', x='使用人数', orientation='h',
                         title='通天塔最高层阵容·宠物使用率 Top 20',
                         color='使用人数', color_continuous_scale='RdPu')
            fig.update_layout(yaxis={'autorange': 'reversed'})
            st.plotly_chart(fig, use_container_width=True)
        else:
            st.info('暂无宠物使用数据')

    with c2:
        dex_pos = dex_counts[dex_counts > 0]
        if len(dex_pos) > 0:
            fig = px.histogram(dex_pos, nbins=max(int(dex_pos.max()), 5),
                               title='图鉴收集数量分布',
                               labels={'value': '已收集数', 'count': '玩家数'},
                               color_discrete_sequence=['#00BCD4'])
            fig.add_vline(x=dex_pos.median(), line_dash='dash', line_color='red',
                          annotation_text=f'中位数: {dex_pos.median():.0f}')
            st.plotly_chart(fig, use_container_width=True)
        else:
            st.info('暂无图鉴数据')

    # 宠物属性分布
    attr_counter = Counter()
    for s in stats_col.dropna():
        if isinstance(s, dict):
            for p in s.get('bestFloorPets', []):
                if isinstance(p, dict) and 'attr' in p:
                    attr_counter[p['attr']] += 1
    if attr_counter:
        attr_df = pd.DataFrame(attr_counter.most_common(), columns=['属性', '出场次数'])
        fig = px.pie(attr_df, names='属性', values='出场次数', title='通天塔最高层·宠物属性分布')
        st.plotly_chart(fig, use_container_width=True)


# ---------- Tab 4: 修炼系统 ----------
with tab4:
    cult_data = df.get('cultivation', pd.Series(dtype=object))
    c1, c2 = st.columns(2)

    with c1:
        levels = cult_data.apply(lambda x: x.get('level', 1) if isinstance(x, dict) else 1)
        fig = px.histogram(levels, nbins=max(int(levels.max()), 5),
                           title='修炼等级分布',
                           labels={'value': '修炼等级', 'count': '玩家数'},
                           color_discrete_sequence=['#795548'])
        fig.add_vline(x=levels.median(), line_dash='dash', line_color='red',
                      annotation_text=f'中位数: {levels.median():.0f}')
        st.plotly_chart(fig, use_container_width=True)

    with c2:
        attr_names = {'body': '体魄', 'spirit': '灵力', 'wisdom': '智慧',
                      'defense': '防御', 'sense': '感知'}
        attr_totals = defaultdict(float)
        count = 0
        for c in cult_data.dropna():
            if isinstance(c, dict) and 'levels' in c and isinstance(c['levels'], dict):
                for a, v in c['levels'].items():
                    attr_totals[a] += v
                count += 1

        if count > 0:
            attrs_order = ['body', 'spirit', 'wisdom', 'defense', 'sense']
            attr_df = pd.DataFrame({
                '属性': [attr_names.get(a, a) for a in attrs_order],
                '平均等级': [attr_totals.get(a, 0) / count for a in attrs_order]
            })
            fig = px.bar(attr_df, x='属性', y='平均等级', title='五维属性平均加点',
                         color='属性',
                         color_discrete_sequence=['#F44336', '#2196F3', '#FFEB3B', '#4CAF50', '#9C27B0'])
            st.plotly_chart(fig, use_container_width=True)
        else:
            st.info('暂无修炼数据')


# ---------- Tab 5: 秘境关卡漏斗（逐关通过率）----------
with tab5:
    st.caption('秘境主玩法：每一关在全量玩家中的「曾有通关记录」占比（含重复闯关）。')
    c1, c2 = st.columns(2)

    with c1:
        if 'stageClearRecord' in df.columns:
            stage_counter = Counter()
            for record in df['stageClearRecord'].dropna():
                if isinstance(record, dict):
                    for sid, rec in record.items():
                        if isinstance(rec, dict) and rec.get('cleared'):
                            stage_counter[sid] += 1

            if stage_counter:
                def stage_sort(s):
                    parts = s.replace('stage_', '').replace('_elite', '').split('_')
                    try:
                        return tuple(int(p) for p in parts if p.isdigit())
                    except ValueError:
                        return (999, 999)

                sorted_stages = sorted(stage_counter.items(), key=lambda x: stage_sort(x[0]))
                funnel_df = pd.DataFrame(sorted_stages, columns=['关卡', '通过人数'])
                funnel_df['通过率(%)'] = (funnel_df['通过人数'] / total * 100).round(1)

                fig = px.bar(funnel_df, x='关卡', y='通过率(%)', title='秘境：逐关通过率（有通关记录人数 / 全量玩家）',
                             color='通过率(%)', color_continuous_scale='Blues',
                             text='通过率(%)')
                fig.update_traces(textposition='outside')
                st.plotly_chart(fig, use_container_width=True)
            else:
                st.info('暂无关卡通过数据')
        else:
            st.info('暂无关卡数据')

    with c2:
        if 'dailyChallenges' in df.columns:
            challenge_counter = Counter()
            for dc in df['dailyChallenges'].dropna():
                if isinstance(dc, dict):
                    counts_map = dc.get('counts', {})
                    if isinstance(counts_map, dict):
                        for sid, cnt in counts_map.items():
                            challenge_counter[sid] += cnt

            if challenge_counter:
                ch_df = pd.DataFrame(challenge_counter.most_common(15), columns=['关卡', '总挑战次数'])
                fig = px.bar(ch_df, y='关卡', x='总挑战次数', orientation='h',
                             title='每日挑战关卡热度 Top 15',
                             color='总挑战次数', color_continuous_scale='Oranges')
                fig.update_layout(yaxis={'autorange': 'reversed'})
                st.plotly_chart(fig, use_container_width=True)
            else:
                st.info('暂无挑战数据')
        else:
            st.info('暂无挑战数据')


# ---------- Tab 6: 经济与引导 ----------
with tab6:
    c1, c2 = st.columns(2)

    with c1:
        # 新手引导
        if 'guideFlags' in df.columns:
            guide_counter = Counter()
            for gf in df['guideFlags'].dropna():
                if isinstance(gf, dict):
                    for flag in gf.keys():
                        guide_counter[flag] += 1

            if guide_counter:
                sorted_guides = sorted(guide_counter.items(), key=lambda x: -x[1])
                guide_df = pd.DataFrame(sorted_guides, columns=['引导步骤', '完成人数'])
                guide_df['完成率(%)'] = (guide_df['完成人数'] / total * 100).round(1)

                fig = px.bar(guide_df, y='引导步骤', x='完成率(%)', orientation='h',
                             title='新手引导完成率',
                             color='完成率(%)', color_continuous_scale='Teal',
                             text='完成率(%)')
                fig.update_traces(textposition='outside')
                fig.update_layout(yaxis={'autorange': 'reversed'})
                st.plotly_chart(fig, use_container_width=True)
            else:
                st.info('暂无引导数据')

    with c2:
        # 宝箱领取
        if 'chestRewards' in df.columns:
            chest_counter = Counter()
            for cr in df['chestRewards'].dropna():
                if isinstance(cr, dict):
                    claimed = cr.get('claimed', {})
                    if isinstance(claimed, dict):
                        for m in claimed.keys():
                            chest_counter[m] += 1

            if chest_counter:
                def chest_sort(m):
                    parts = m.split('_')
                    try:
                        return int(parts[-1])
                    except (ValueError, IndexError):
                        return 999

                sorted_ch = sorted(chest_counter.items(), key=lambda x: chest_sort(x[0]))
                ch_df = pd.DataFrame(sorted_ch, columns=['宝箱', '领取人数'])
                ch_df['领取率(%)'] = (ch_df['领取人数'] / total * 100).round(1)

                fig = px.bar(ch_df, x='宝箱', y='领取率(%)', title='宝箱领取率',
                             color='领取率(%)', color_continuous_scale='YlOrBr',
                             text='领取率(%)')
                fig.update_traces(textposition='outside')
                fig.update_xaxes(tickangle=45)
                st.plotly_chart(fig, use_container_width=True)
            else:
                st.info('暂无宝箱数据')

    # 碎片经济
    st.subheader('碎片经济')
    c3, c4 = st.columns(2)

    with c3:
        if 'fragmentBank' in df.columns:
            frag_totals = df['fragmentBank'].apply(
                lambda x: sum(x.values()) if isinstance(x, dict) and x else 0)
            frag_pos = frag_totals[frag_totals > 0]

            if len(frag_pos) > 0:
                fig = px.histogram(frag_pos, nbins=20,
                                   title='碎片总持有量分布',
                                   labels={'value': '碎片总数', 'count': '玩家数'},
                                   color_discrete_sequence=['#607D8B'])
                fig.add_vline(x=frag_pos.median(), line_dash='dash', line_color='red',
                              annotation_text=f'中位数: {frag_pos.median():.0f}')
                st.plotly_chart(fig, use_container_width=True)
            else:
                st.info('暂无碎片数据')

    with c4:
        if 'fragmentBank' in df.columns:
            pet_frag = Counter()
            for fb in df['fragmentBank'].dropna():
                if isinstance(fb, dict):
                    for pid, cnt in fb.items():
                        pet_frag[pid] += cnt

            if pet_frag:
                frag_df = pd.DataFrame(pet_frag.most_common(15), columns=['宠物ID', '全服碎片总量'])
                fig = px.bar(frag_df, y='宠物ID', x='全服碎片总量', orientation='h',
                             title='碎片持有量 Top 15',
                             color='全服碎片总量', color_continuous_scale='YlGn')
                fig.update_layout(yaxis={'autorange': 'reversed'})
                st.plotly_chart(fig, use_container_width=True)


# ---------- Tab 7: 排行交叉、未完成局、派遣/体力（无 DAU 流水）----------
with tab7:
    st.caption('基于单次导出的截面数据；排行与存档对比可看出授权/提交覆盖，非留存指标。')
    if build_rank_cross_report is None:
        st.error('无法加载 build_rank_cross_report')
    else:
        rep = build_rank_cross_report(players)
        m1, m2, m3, m4 = st.columns(4)
        m1.metric('playerData 人数', rep['player_total'])
        m2.metric('bestFloor≥1', rep['players_with_floor_ge_1'])
        m3.metric('有进度但不在速通榜', rep['has_progress_not_in_rankall'])
        m4.metric('rankAll 去重 uid', rep['rank_all_uids'])
        st.json({k: rep[k] for k in rep if k != 'sample_progress_not_rankall'})
        if rep.get('sample_progress_not_rankall'):
            st.caption('sample：有进度却不在速通榜的 openid 示例（前 20）')
            st.code('\n'.join(rep['sample_progress_not_rankall'][:20]))

    st.subheader('未完成局 savedRun')
    if 'savedRun' in df.columns:
        def _has_sr(x):
            return isinstance(x, dict) and bool(x)

        sr_ok = df['savedRun'].apply(_has_sr)
        st.metric('带有进行中存档人数', int(sr_ok.sum()), delta=f'占比 {sr_ok.mean()*100:.1f}%')
        floors = []
        for x in df.loc[sr_ok, 'savedRun']:
            floors.append(int(x.get('floor') or 0))
        if floors:
            fig = px.histogram(pd.Series(floors, name='层数'), nbins=min(24, max(floors) + 1),
                               title='savedRun 当前层分布')
            st.plotly_chart(fig, use_container_width=True)
    else:
        st.info('无 savedRun 列')

    st.subheader('派遣槽位 & 体力比例')
    slot_list = []
    ratio_list = []
    for _, row in df.iterrows():
        idle = row.get('idleDispatch') if isinstance(row.get('idleDispatch'), dict) else {}
        slots = idle.get('slots') if isinstance(idle.get('slots'), list) else []
        slot_list.append(min(3, len(slots)))
        stam = row.get('stamina') if isinstance(row.get('stamina'), dict) else {}
        try:
            c, m = float(stam.get('current', 0)), float(stam.get('max', 0) or 0)
            ratio_list.append(c / m if m > 0 else None)
        except (TypeError, ValueError):
            ratio_list.append(None)
    c1, c2 = st.columns(2)
    with c1:
        fig = px.histogram(pd.Series(slot_list, name='槽位数'), nbins=8,
                           title='派遣占用槽位数')
        st.plotly_chart(fig, use_container_width=True)
    with c2:
        rl = [x for x in ratio_list if x is not None]
        if rl:
            fig = px.histogram(pd.Series(rl, name='比例'), nbins=20, title='体力 current/max')
            st.plotly_chart(fig, use_container_width=True)

    st.subheader('头像 & 固定关编队 Top')
    ac1, ac2 = st.columns(2)
    with ac1:
        if 'selectedAvatar' in df.columns:
            avdf = df['selectedAvatar'].fillna('(空)').astype(str).value_counts().reset_index()
            avdf.columns = ['头像', '人数']
            fig = px.bar(avdf.head(12), x='头像', y='人数', title='selectedAvatar')
            st.plotly_chart(fig, use_container_width=True)
    with ac2:
        pet_ctr = Counter()
        if 'savedStageTeam' in df.columns:
            for team in df['savedStageTeam'].dropna():
                if isinstance(team, list):
                    for pid in team:
                        pet_ctr[str(pid)] += 1
        if pet_ctr:
            tdf = pd.DataFrame(pet_ctr.most_common(12), columns=['petId', '次数'])
            fig = px.bar(tdf, x='petId', y='次数', title='savedStageTeam 宠物出现次数')
            st.plotly_chart(fig, use_container_width=True)


# ========== 底部：原始数据查看 ==========

st.divider()
with st.expander('📋 查看原始数据'):
    st.dataframe(df, use_container_width=True)
