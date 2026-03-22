"""生成模拟 playerData 用于测试 analyze.py"""
import json
import random
import os

random.seed(42)

PET_NAMES = [
    '火灵', '水灵', '风灵', '雷灵', '冰灵',
    '岩灵', '木灵', '光灵', '暗灵', '毒灵',
    '龙灵', '凤灵', '虎灵', '龟灵', '蛇灵',
    '鹤灵', '狼灵', '熊灵', '鹰灵', '兔灵',
]
ATTRS = ['fire', 'water', 'wind', 'thunder', 'ice', 'earth', 'wood', 'light', 'dark', 'poison']
GUIDE_FLAGS = ['buff_first', 'cult_intro', 'cultivation_unlock', 'pet_pool_intro', 'stage_intro', 'dispatch_intro']
STAGES = ['stage_1_1', 'stage_1_2', 'stage_1_3', 'stage_2_1', 'stage_2_2', 'stage_2_3', 'stage_2_4', 'stage_2_5',
          'stage_3_1', 'stage_3_2', 'stage_3_3']

def gen_player(i):
    # 模拟不同层次的玩家
    player_type = random.choices(['new', 'casual', 'mid', 'hardcore'], weights=[30, 35, 25, 10])[0]

    if player_type == 'new':
        best_floor = random.randint(1, 5)
        total_runs = random.randint(1, 3)
        cult_level = 1
    elif player_type == 'casual':
        best_floor = random.randint(3, 15)
        total_runs = random.randint(3, 15)
        cult_level = random.randint(1, 5)
    elif player_type == 'mid':
        best_floor = random.randint(10, 25)
        total_runs = random.randint(10, 50)
        cult_level = random.randint(3, 12)
    else:
        best_floor = random.randint(20, 30)
        total_runs = random.randint(30, 200)
        cult_level = random.randint(8, 20)

    num_pets = min(best_floor // 3 + 1, 5)
    chosen_pets = random.sample(PET_NAMES, num_pets)
    best_floor_pets = [{'name': p, 'attr': random.choice(ATTRS)} for p in chosen_pets[:min(5, len(chosen_pets))]]

    max_combo = max(0, best_floor * random.randint(2, 8) + random.randint(-5, 10))
    best_total_turns = best_floor * random.randint(3, 6) if best_floor >= 30 else 0

    dex_count = min(len(PET_NAMES), max(0, int(best_floor * 0.5 + random.randint(-2, 5))))
    pet_dex = random.sample(PET_NAMES, min(dex_count, len(PET_NAMES)))

    attrs = ['body', 'spirit', 'wisdom', 'defense', 'sense']
    attr_levels = {}
    points = max(0, cult_level - 1) * 2
    for a in attrs:
        if points <= 0:
            attr_levels[a] = 0
        else:
            v = random.randint(0, min(points, cult_level))
            attr_levels[a] = v
            points -= v

    # 关卡通过
    stage_record = {}
    num_stages_cleared = min(len(STAGES), max(0, best_floor // 3))
    for s in STAGES[:num_stages_cleared]:
        stage_record[s] = {'cleared': True, 'bestRating': random.choice(['S', 'A', 'B']), 'clearCount': random.randint(1, 10)}

    # 每日挑战
    daily_counts = {}
    if total_runs > 5:
        for s in random.sample(STAGES[:num_stages_cleared] if num_stages_cleared > 0 else STAGES[:2],
                               min(3, max(1, num_stages_cleared))):
            daily_counts[s] = random.randint(1, 5)

    # 新手引导
    guide_done = {}
    guide_progress = min(len(GUIDE_FLAGS), max(1, best_floor // 2))
    for g in GUIDE_FLAGS[:guide_progress]:
        guide_done[g] = True

    # 宝箱
    chest_claimed = {}
    chest_levels = [f'lv_{i}' for i in range(1, 11)]
    for cl in chest_levels[:min(len(chest_levels), best_floor // 3)]:
        chest_claimed[cl] = True

    # 碎片
    frag_bank = {}
    if total_runs > 5:
        num_frags = random.randint(1, 8)
        for pet_id in random.sample(PET_NAMES, min(num_frags, len(PET_NAMES))):
            frag_bank[pet_id] = random.randint(1, 30)

    return {
        '_id': f'mock_{i:04d}',
        '_openid': f'openid_{i:04d}',
        '_version': 9,
        'bestFloor': best_floor,
        'totalRuns': total_runs,
        'stats': {
            'totalBattles': total_runs * random.randint(5, 15),
            'totalCombos': total_runs * random.randint(3, 10),
            'maxCombo': max_combo,
            'bestFloorPets': best_floor_pets,
            'bestFloorWeapon': {'name': random.choice(['星辰剑', '月光杖', '风暴锤', '冰霜弓', '烈焰扇'])} if best_floor > 5 else None,
            'bestTotalTurns': best_total_turns,
        },
        'petDex': pet_dex,
        'cultivation': {
            'level': cult_level,
            'exp': random.randint(0, 500),
            'totalExpEarned': cult_level * 300 + random.randint(0, 200),
            'skillPoints': random.randint(0, 3),
            'levels': attr_levels,
        },
        'stageClearRecord': stage_record,
        'dailyChallenges': {'date': '2026-03-22', 'counts': daily_counts},
        'guideFlags': guide_done,
        'chestRewards': {'claimed': chest_claimed},
        'fragmentBank': frag_bank,
    }

if __name__ == '__main__':
    players = [gen_player(i) for i in range(200)]
    os.makedirs('data', exist_ok=True)
    with open('data/playerData.json', 'w', encoding='utf-8') as f:
        json.dump(players, f, ensure_ascii=False, indent=2)
    print(f'生成 {len(players)} 条模拟数据 → data/playerData.json')
