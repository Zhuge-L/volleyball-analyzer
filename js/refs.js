/* ============================================================
 * 评判标准与拍摄机位的文献出处（答辩 /「评判标准」弹窗引用）
 * 精英/3D 动捕数值仅作上限参考，公体课评分采用教学可执行区间。
 * ============================================================ */

export const REFS = {
  R1: { tag: 'R1', title: '排球跨步垫球技术运动学分析（硕士学位论文）', note: '膝最大屈曲约 60°；上体倾斜 55°–72°', url: 'https://xueshu.baidu.com/usercenter/paper/show?paperid=a4539d5d55a2021437bbb4eb8bbe8539' },
  R2: { tag: 'R2', title: '辽宁职业学院：排球垫球怎么考怎么练（2024）', note: '击球部位、插—夹—提、常见错误', url: 'https://www.lnpc.edu.cn/tyjxb/2024/1223/c1514a31211/page.htm' },
  R3: { tag: 'R3', title: '鞍山市中考特长生排球项目测试方法与评分标准（2025）', note: '结果性落点与考试口径', url: 'http://files.anshan.gov.cn/files/ueditor/ASJYJ/jsp/upload/file/20250912/1757638724986027717.pdf' },
  R5: { tag: 'R5', title: 'Paulo et al. (2018). Predicting volleyball serve-reception. J Sports Sci 36:2621–2630', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5089979/' },
  R7: { tag: 'R7', title: '上手发球技术动作（教学口径：抛球高度与击球点）', url: 'https://baike.baidu.com/item/%E4%B8%8A%E6%89%8B%E5%8F%91%E7%90%83/12713720' },
  R8: { tag: 'R8', title: 'Reeser et al. (2010). Upper Limb Biomechanics During the Volleyball Serve and Spike. Sports Health 2(5):368–374', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC3445065/' },
  R10: { tag: 'R10', title: 'Bari et al. (2023). Kinematic variables that predict jump serve efficacy. Medicine 102(31):e34471', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC10402994/' },
  R16: { tag: 'R16', title: '排球正面下手发球技术动作要领（面对球网、腹前击球、钟摆挥臂）', url: 'https://wenwen.sogou.com/question/q824150512.htm' },
  R18: { tag: 'R18', title: 'Underhand serve 弹道分析：出手角约 40°–50°', url: 'http://ffden-2.phys.uaf.edu/211_fall2004.web.dir/jason_gresehover/webproject/Underhand.htm' },
  R19: { tag: 'R19', title: '中国政法大学排球课程考试标准（下手发球技评）', url: 'https://jwc.cupl.edu.cn/__local/1/B9/1B/D944825BA33FA1277D5F76FEA7F_D602EC3C_3194040.pdf' },
  R20: { tag: 'R20', title: 'Travlos (2010). Specificity and variability of practice… underhand volleyball serve. Percept Mot Skills 110(1):298–312' },
  R23: { tag: 'R23', title: 'Coleman et al. (1993). A three-dimensional cinematographical analysis of the volleyball spike. J Sports Sci 11(4):295–302' },
  R24: { tag: 'R24', title: '排球运动员扣球起跳动作人体环节的运动特征《体育学刊》', url: 'https://tyxk.scnu.edu.cn/editer/doc/20108241725186340.pdf' },
  R25: { tag: 'R25', title: '扣球起跳膝屈最优区间 110°–130°（教学/训练综述）' },
  R27: { tag: 'R27', title: '万京一等 (2004). 扣球击球在重心最高点之后.《北京体育大学学报》' },
  R37: { tag: 'R37', title: '正面上手传球：击球点在前额前上方约一球距离（15–20 cm）' },
  R38: { tag: 'R38', title: '正面双手上手传球教学：缓冲—发力约 0.025–0.03 s' },
  R40: { tag: 'R40', title: 'Ozawa et al. (2021). Biomechanical analysis of volleyball overhead pass. Sports Biomech 20(7):844–857' },
  R42: { tag: 'R42', title: 'Cabarkapa et al. (2022). Kinetic and Kinematic Characteristics of Setting Motions. Biomechanics 2(4):538–546', url: 'https://www.mdpi.com/2673-7078/2/4/42' },
  C1: { tag: 'C1', title: 'AI Video-Based Analysis of the Volleyball Forearm Pass（后斜 4.3 m / 高 1.2 m）', url: 'https://www.mdpi.com/2673-4591/134/1/90' },
  C2: { tag: 'C2', title: 'Bari 2023 跳发机位：侧面 12–13 m、高 1.5 m、120 fps' },
  C6: { tag: 'C6', title: 'Oliosi et al. (2026). Smartphone camera positioning. JMIR mHealth uHealth. 斜向 1.8–2 m 检出率高' },
  C7: { tag: 'C7', title: '扣球研究常用 120–240 fps、快门 ≥1/1000 s' },
  C9: { tag: 'C9', title: 'Ramasamy et al. (2023). 过头动作肩旋转单目 2D 不可靠. Appl Sci 13(16):9463' },
  C12: { tag: 'C12', title: 'Komisar et al. (2021). 光轴偏离 30° 时水平速度误差约 2.5 倍. PLoS ONE' },
  C14: { tag: 'C14', title: 'Francia (2024). MediaPipe 机位×距离×高度验证：髋高优于近地，避免俯仰拍' },
};

export function citeList(tags) {
  return tags.map((t) => REFS[t]).filter(Boolean);
}
