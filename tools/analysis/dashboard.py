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
        weapon_collection_dataframe,
        stage_clear_dataframe,
        pet_dex_dataframe,
        fragment_bank_dataframe,
        idle_dispatch_dataframe,
        build_player_select_labels,
        format_stage_farthest_label,
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
    weapon_collection_dataframe = None
    stage_clear_dataframe = None
    pet_dex_dataframe = None
    fragment_bank_dataframe = None
    idle_dispatch_dataframe = None
    build_player_select_labels = None
    format_stage_farthest_label = None

# ========== 页面配置 ==========

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
if not players:
    st.warning('暂无数据。请先侧边栏「刷新数据」，或于本目录执行 `node export_wx.js`（需已配置 WX_SECRET，见 scripts/.cdn_secret）')
    st.stop()

df = pd.DataFrame(players)
total = len(df)

# 秘境进度列（与客户端 stageClearRecord 一致）
if compute_stage_progress is not None:
    _sm = [compute_stage_progress(p) for p in players if isinstance(p, dict)]
    stage_df = pd.DataFrame(_sm) if _sm else pd.DataFrame()
else:
    stage_df = pd.DataFrame()

# ========== 顶部指标卡 ==========

st.header('总览')
st.caption('秘境（固定关卡）为主线玩法；通天塔（肉鸽）为支线。指标已拆成「秘境 / 通天塔」两组。')

floors = df['bestFloor'].fillna(0) if 'bestFloor' in df.columns else pd.Series([0])
runs = df['totalRuns'].fillna(0) if 'totalRuns' in df.columns else pd.Series([0])
tower_cleared = int((floors >= 30).sum())

stats_col = df.get('stats', pd.Series(dtype=object))
combos = stats_col.apply(lambda x: x.get('maxCombo', 0) if isinstance(x, dict) else 0)
dex_counts = df['petDex'].apply(lambda x: len(x) if isinstance(x, list) else 0) if 'petDex' in df.columns else pd.Series([0])

st.markdown('**秘境（主玩法）**')
s1, s2, s3, s4 = st.columns(4)
if len(stage_df) > 0 and total > 0:
    has_stage = int((stage_df['farthest_normal_ch'] > 0).sum())
    s1.metric('有秘境进度占比', f'{has_stage/total*100:.1f}%', help='至少通过一关普通秘境')
    s2.metric('总星数·中位', f'{stage_df["stage_total_stars"].median():.0f}')
    s3.metric('普通关通关·中位', f'{stage_df["stage_normal_cleared"].median():.0f}')
    s4.metric('精英关通关·中位', f'{stage_df["stage_elite_cleared"].median():.0f}')
else:
    s1.metric('秘境数据', '—', help='无法解析 stageClearRecord')

st.markdown('**通天塔（肉鸽）**')
col1, col2, col3, col4 = st.columns(4)
col1.metric('玩家总数', total)
col2.metric('塔通关率(≥30层)', f'{tower_cleared/total*100:.1f}%')
col3.metric('塔·均最高层', f'{floors.mean():.1f}')
col4.metric('塔·人均对局', f'{runs.mean():.1f}')

col5, col6 = st.columns(2)
col5.metric('中位连击', f'{combos[combos>0].median():.0f}' if (combos > 0).any() else '-')
col6.metric('中位图鉴', f'{dex_counts[dex_counts>0].median():.0f}' if (dex_counts > 0).any() else '-')

st.divider()

# ========== Tab 页 ==========

tab_stage, tab_player, tab0, tab1, tab2, tab3, tab4, tab5, tab6, tab7 = st.tabs([
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
    if (
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
                team = rec.get('savedStageTeam')
                if isinstance(team, list) and team:
                    tdf = pd.DataFrame({
                        '宠物ID': team,
                        '名称': [pnames.get(str(x), '') for x in team],
                    })
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

    # 玩家分层饼图
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
