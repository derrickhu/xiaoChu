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
import plotly.graph_objects as go
import pandas as pd

SCRIPT_DIR = Path(__file__).parent
DATA_DIR = SCRIPT_DIR / 'data'

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
    st.caption('数据来源: 微信云数据库')


# ========== 加载数据 ==========

players = load_collection('playerData')
if not players:
    st.warning('暂无数据。请先点击侧边栏「刷新数据」，或运行 `node export_wx.js`')
    st.stop()

df = pd.DataFrame(players)
total = len(df)

# ========== 顶部指标卡 ==========

st.header('总览')

floors = df['bestFloor'].fillna(0) if 'bestFloor' in df.columns else pd.Series([0])
runs = df['totalRuns'].fillna(0) if 'totalRuns' in df.columns else pd.Series([0])
cleared = int((floors >= 30).sum())

stats_col = df.get('stats', pd.Series(dtype=object))
combos = stats_col.apply(lambda x: x.get('maxCombo', 0) if isinstance(x, dict) else 0)
dex_counts = df['petDex'].apply(lambda x: len(x) if isinstance(x, list) else 0) if 'petDex' in df.columns else pd.Series([0])

col1, col2, col3, col4, col5, col6 = st.columns(6)
col1.metric('玩家总数', total)
col2.metric('通关率', f'{cleared/total*100:.1f}%')
col3.metric('平均最高层', f'{floors.mean():.1f}')
col4.metric('人均对局', f'{runs.mean():.1f}')
col5.metric('中位连击', f'{combos[combos>0].median():.0f}' if (combos > 0).any() else '-')
col6.metric('中位图鉴', f'{dex_counts[dex_counts>0].median():.0f}' if (dex_counts > 0).any() else '-')

st.divider()

# ========== Tab 页 ==========

tab1, tab2, tab3, tab4, tab5, tab6 = st.tabs([
    '📊 进度分布', '⚔️ 数值平衡', '🐾 宠物生态', '🧘 修炼系统', '🏰 关卡挑战', '💎 经济与引导'
])

# ---------- Tab 1: 进度分布 ----------
with tab1:
    c1, c2 = st.columns(2)

    with c1:
        fig = px.histogram(df, x='bestFloor', nbins=max(int(floors.max()), 10),
                           title='最高层数分布',
                           labels={'bestFloor': '最高层数', 'count': '玩家数'},
                           color_discrete_sequence=['#4CAF50'])
        fig.add_vline(x=floors.median(), line_dash='dash', line_color='red',
                      annotation_text=f'中位数: {floors.median():.0f}')
        st.plotly_chart(fig, use_container_width=True)

    with c2:
        fig = px.histogram(df, x='totalRuns', nbins=30,
                           title='总对局数分布',
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
        title='玩家分层',
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
                         title='最高层宠物使用率 Top 20',
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
        fig = px.pie(attr_df, names='属性', values='出场次数', title='最高层宠物属性分布')
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


# ---------- Tab 5: 关卡挑战 ----------
with tab5:
    c1, c2 = st.columns(2)

    with c1:
        if 'stageClearRecord' in df.columns:
            stage_counter = Counter()
            for record in df['stageClearRecord'].dropna():
                if isinstance(record, dict):
                    for sid in record.keys():
                        stage_counter[sid] += 1

            if stage_counter:
                def stage_sort(s):
                    parts = s.replace('stage_', '').split('_')
                    try:
                        return tuple(int(p) for p in parts)
                    except ValueError:
                        return (999, 999)

                sorted_stages = sorted(stage_counter.items(), key=lambda x: stage_sort(x[0]))
                stage_df = pd.DataFrame(sorted_stages, columns=['关卡', '通过人数'])
                stage_df['通过率(%)'] = (stage_df['通过人数'] / total * 100).round(1)

                fig = px.bar(stage_df, x='关卡', y='通过率(%)', title='固定关卡通过率',
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

# ========== 底部：原始数据查看 ==========

st.divider()
with st.expander('📋 查看原始数据'):
    st.dataframe(df, use_container_width=True)
