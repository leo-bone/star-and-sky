// 中英文切换：以中文原文作字典键；英文模式下命中则替换，未命中（或中文模式）原样返回，
// 因此即使新增文案忘记配英文，中文界面也绝不坏。
const EN = {
  // ---- 顶部品牌 / 导航 ----
  '星与星空': 'Stars & Sky',
  '序章': 'Prologue', '问答': 'Quiz', '认星': 'Claim Star', '星空': 'Star Map',
  '建国': 'Build Kingdom', '星图': 'Star Chart',
  '我的星球 ✦': 'My Star ✦',
  // ---- 首页电影开场 ----
  '推开城邦之门 · 进入宇宙': 'Open the Gate · Enter the Cosmos',
  '跳过片头，直接认领': 'Skip Intro',
  '先探索真实星空': 'Explore the real sky',
  '继续我的星空': 'Continue my sky',
  // ---- 认星页 ----
  '你找到了你的星': 'You have found your star',
  '在亿万光年之外，它为你而亮。': 'Beyond billions of light-years, it shines for you.',
  '拖拽旋转 · 滚轮缩放': 'Drag to rotate · Scroll to zoom',
  '认领这颗星': 'Claim this star',
  '进入真实星空 · 找到你的星': 'Enter the real sky · find your star',
  // ---- 真实星空页 ----
  '星座线': 'Constellation lines', '名称': 'Names', '银河': 'Milky Way', '行星': 'Planets',
  '复位': 'Reset',
  '金色光点 = 云端全世界的星 · 点击即可访问 TA 的星图': 'Gold dots = stars from all over the world · tap to visit their sky',
  '视星等': 'Magnitude', '距离': 'Distance',
  '输入星名 / 编号查找，如 Vega、HD 48915、α CMa': 'Search by star name / number, e.g. Vega, HD 48915, α CMa',
  '返回': 'Back',
  '返回认星': 'Back to claim', '定位我的星': 'Locate my star', '认领并命名': 'Claim & name',
  '返回认领星球': 'Back to claim star',
  '建立城邦 · 生成凭证': 'Build kingdom · Create pass',
  '完成生成凭证': 'Finish creating pass',
  '长按图片即可保存到手机相册': 'Long-press the image to save it to your phone album',
  '本证书为私人纪念档案，仅用于纪念，非国际天文学联合会官方颁发': 'This certificate is a private commemorative archive for remembrance only, not officially issued by the International Astronomical Union.',
  '关闭': 'Close',
  // ---- 建国页 ----
  '建立你的星辰王国': 'Build Your Star Kingdom',
  '认领之后，这片天体归你统治。命名、立法、组阁、设计旗帜。': 'Once claimed, this celestial body is yours to rule. Name it, legislate, appoint, design its flag.',
  '星名 / 王国之名': 'Star / Kingdom name',
  '统治者称号': 'Ruler title',
  '颁布律法（每条一行，回车添加）': 'Laws (one per line, press Enter to add)',
  '议会席位（每行 姓名 · 职务）': 'Council seats (each line: Name · Role)',
  '星球寄语 · 留言（将随星辰一起保存在云端，朋友也能看到）': 'Star message (saved to the cloud with your star, visible to friends)',
  '例如：凛冬之冠、晨曦联邦…': 'e.g. Winter Crown, Dawn Federation…',
  '例如：星皇、守望者、第一议长…': 'e.g. Star King, Watcher, First Speaker…',
  '写下第一条律法…': 'Write your first law…',
  '如：林夜 · 外交大臣': 'e.g. Lin Ye · Minister of Foreign Affairs',
  '写一句留给这颗星、也留给后来仰望它的人的话…': 'Leave a word for this star, and for those who gaze at it later…',
  '设计你的星球旗帜': 'Design your star flag',
  '底色': 'Base', '点缀': 'Accent', '渐变': 'Gradient',
  '星徽': 'Star', '月牙': 'Moon', '星环': 'Ring', '光芒': 'Rays', '横幅': 'Band',
  '竖纹': 'V-stripes', '斜分': 'Diagonal', '山峦': 'Mountain', '边框': 'Border',
  '铭文': 'Inscription', '辉光': 'Glow', '星云': 'Nebula', '星数': 'Stars',
  '星核': 'Starcore', '极光带': 'Aurora Belt', '余烬': 'Ember', '冰晶': 'Ice',
  '旗帜铭文（如：光·秩序）': 'Flag inscription (e.g. Light·Order)',
  '命名并生成星图': 'Name & generate star chart',
  '认领星球': 'Claim Star',
  '认领并命名星球': 'Claim & name star',
  '保存': 'Save',
  '不想取名？一键认领，星名用国际通用名，证书照常生成': 'Skip naming? One tap to claim — the star keeps its official designation; certificate still generated',
  '✦ 星名已锁定 · 查看我的星图': '✦ Star name locked · view my star',
  '认领者 · ': 'Claimed by · ',
  '纯色': 'Solid',
  // ---- 证书 ----
  '天 体 写 真 · PORTRAIT': 'PORTRAIT', '所 在 星 图 · STAR CHART': 'STAR CHART',
  '观 测 数 据 · OBSERVATION DATA': 'OBSERVATION DATA',
  '议会 · COUNCIL': 'COUNCIL', '议会：依星律自治': 'Council: self-governed by star law',
  '✦ 星际公民 · 永载名册': '✦ Interstellar Citizen · Forever recorded',
  '星球寄语': 'Star message',
  '★ 你的星': '★ Your star', '我的星': 'My star', '我的星 ✦': 'My star ✦',
  '天球坐标 · ': 'Celestial coord · ',
  '恒星编号': 'Star No.', '国际命名': 'Designation', '星表编号': 'Catalog No.',
  '光谱类型': 'Spectral type', '表面温度': 'Surface temp', '直径': 'Diameter',
  '质量': 'Mass', '光度': 'Luminosity', '距地球': 'Distance', '所属星系': 'Galaxy',
  '所在星座': 'Constellation', '天球坐标': 'Coordinates', '物质构成': 'Composition',
  '含氧量': 'Oxygen', '表面重力': 'Gravity', '自转周期': 'Rotation',
  '行星数量': 'Planets', '卫星数量': 'Moons', '星龄': 'Age',
  '天体编号': 'Object No.', '行星类型': 'Planet type',
  // ---- 宇宙页分组参数标题 ----
  '基础信息': 'Basic Info', '物理参数': 'Physical', '天体坐标': 'Coordinates',
  // ---- 建国页 ----
  '高级旗帜细节': 'Advanced flag details',
  // ---- 新版认领证书 ----
  '星球认领证书': 'Planet Claim Certificate',
  '星球名称': 'Planet Name', '注册人': 'Registrant', '星际公民': 'Star Citizen',
  '注册时间': 'Registered', '注册号 ': 'Reg. No. ',
  '仰望星辰，不是为了拥有，': 'We look up not to possess the stars,',
  '而是为了让记忆在宇宙中有坐标。': 'but to give our memories a coordinate in the cosmos.',
  // ---- 新版认领证书（deep-space archive 风）----
  '兹证明': 'This is to certify that',
  '星体档案': 'Celestial Archive',
  '认领人': 'Claimant', '已于': 'on', '完成星球纪念认领': 'completed the commemorative claim',
  '星辰档案': 'Star Archive', '纪念存证': 'Memorial Proof',
  '兹证明 · 此星已被正式认领': 'This is to certify that this star has been officially claimed',
  '赤经 RA': 'R.A.', '赤纬 Dec': 'Decl.', '视星等': 'App. Mag.',
  '光谱类型': 'Spectral', '距离地球': 'Distance', '所属星座': 'Constellation',
  '证书编号': 'Cert. No.', '扫码分享这颗星球记录': 'Scan to share this star record',
  '于浩瀚宇宙之中，认领属于自己的星辰，以此为记，恒久留存。': 'In the vast cosmos, claim a star of your own — a mark to last forever.',
  '备注：本证书为平台纪念性质认领证书，并非 IAU 国际天文学联合会官方天体命名凭证，仅作为数字纪念藏品。': 'Note: This is a commemorative certificate issued by the platform. It is not an official naming credential from the IAU (International Astronomical Union), and serves solely as a digital keepsake.',
  // ---- 分享页 ----
  '你正在浏览一颗被分享的星辰 —— 它属于全世界，也属于此刻仰望它的你。': 'You are viewing a shared star — it belongs to the whole world, and to you, gazing at it now.',
  '你的星图已诞生': 'Your star chart is born',
  '保存这张星图，分享给世界。这是你在这片宇宙中留下的坐标。': 'Save this chart and share it with the world. It is the coordinate you leave in the universe.',
  '下载星图 PNG': 'Download PNG', '复制分享链接': 'Copy share link', '重新认领一颗': 'Claim another',
  '提示：图片含你的星名、坐标与王国信息，可自由传播。': 'Tip: the image contains your star name, coordinates and kingdom info — free to share.',
  '高级版 · 星之周边': 'Premium · Star Merch', '即将上线': 'Coming soon',
  '想把这片宇宙带回家？以下高级版与实体周边正在筹备中，免费版功能不受任何影响。': 'Want to bring this universe home? Premium and physical merch are in the works; the free version is unaffected.',
  '高清印刷证书': 'HD printed certificate', '实物星图卷轴': 'Star chart scroll', '定制星球模型': 'Custom star model',
  '命名权证书': 'Naming-right certificate', '星主题周边': 'Star-themed merch',
  '博物馆级装裱': 'Museum framing', '丝绢烫金': 'Silk & gold', '3D 上色': '3D painted',
  '永久核验': 'Permanent verify', '服饰·饰品': 'Apparel·Jewelry',
  '留下邮箱，高级版首发时通知你': 'Leave your email; we will notify you at premium launch',
  '加入候补名单': 'Join waitlist',
  '当前为免费版：完整认领、星图生成与分享均不收费。': 'Current version is free: full claim, chart generation and sharing cost nothing.',
  '星语 · 给这颗星留言': 'Star Whispers · leave a message',
  '查看即将上线': 'See what’s coming',
  '← 返回星图': '← Back to chart',
  '正在筹备高清证书、实物星图卷轴与星球模型等，免费版功能不受影响。': 'HD certificate, star-chart scroll and custom star models in the works; the free version is unaffected.',
  '无论多远，写下一句话，让后来仰望它的人读到。留言随星辰一起保存在云端。': 'No matter how far, write a line for those who will gaze at it later. Saved to the cloud with the star.',
  '昵称（可选）': 'Nickname (optional)', '写下一句给这颗星的话…': 'Write a line for this star…',
  '留下星语': 'Leave a whisper',
  '世界星图墙': 'World Star Wall',
  '每一颗被认领的星，都在为“星辰属于全世界”点亮真实坐标。': 'Every claimed star lights a real coordinate for “stars belong to the whole world”.',
  '已被认领': 'Claimed', '颗星辰': 'stars',
  '还没有星辰被点亮。认领你的第一颗，让世界星图墙亮起来。': 'No star lit yet. Claim your first to light up the World Star Wall.',
  '我也要认一颗星': 'I want to claim one too',
  ' 的星': '’s star', ' 王国': ' Kingdom', '「': '“', '」': '”',
  '已加入候补名单 ✦ 高级版首发时我们会通过邮箱通知你。': 'On the waitlist ✦ we will email you at premium launch.',
  '已加入候补名单，感谢支持 ✦': 'On the waitlist — thank you for your support',
  // ---- 通用提示 ----
  '星图已保存，去分享吧': 'Chart saved — go share it',
  '截图组件加载失败，请检查网络后重试': 'Screenshot tool failed; check your network and retry',
  '生成失败，请重试': 'Generation failed; please retry',
  '先完成问答，认领一颗属于你的星': 'Finish the quiz to claim a star of your own',
  '星图加载中…': 'Loading star map…',
  '未找到该星，换个名字或编号试试': 'Star not found — try another name or number',
  '已定位你的星': 'My star located',
  '云端已点亮': 'Lit in the cloud:', '颗星辰': 'stars', '颗星辰 ✦': 'stars ✦',
  '先给你的星辰王国起个名字吧': 'Give your star kingdom a name first',
  '这颗星辰已被认领，换个名字再建国吧': 'This star is already claimed — pick another name',
  '刚刚被认领，换个名字再点生成': 'Just claimed by someone — pick another name',
  '分享链接已复制，去送给朋友吧': 'Share link copied — send it to a friend',
  '还没有可分享的星图': 'No star chart to share yet',
  '请填写有效的邮箱地址': 'Please enter a valid email',
  '已加入候补名单': 'Joined the waitlist', '感谢支持': 'Thank you for your support',
  // ---- 首页已认领 CTA（动态写入）----
  '查看我的星球 ✦': 'View my star ✦',
  '我的星球 · 随时查阅 ✦': 'My star · view anytime ✦',
  '我也要认一颗星 ✦': 'I want to claim one too ✦',
  '城邦之门': 'The City Gate',
  '还没有进行中的星空': 'No sky in progress yet',
  '无法打开这颗星': 'Cannot open this star',
  '星图还没准备好': 'Star chart not ready yet',
  '写点什么再留下吧': 'Write something before leaving',
  '星语已留在云端': 'Whisper saved to the cloud',
  '留言发送失败，稍后再试': 'Message failed — try later',
  '先生成你的星图，再来留言吧 ✦': 'Generate your star chart first, then leave a whisper ✦',
  '还没有星语，写下第一句吧 ✦': 'No whispers yet — write the first line ✦',
  '已调阅': 'Opened',
  // ---- 问答 ----
  '艺术 / 音乐': 'Art / Music', '科学 / 探索': 'Science', '自然 / 旅行': 'Nature',
  '竞技 / 挑战': 'Challenge', '安静 / 思考': 'Quiet', '社交 / 联结': 'Social',
  '白羊座': 'Aries', '金牛座': 'Taurus', '双子座': 'Gemini', '巨蟹座': 'Cancer',
  '狮子座': 'Leo', '处女座': 'Virgo', '天秤座': 'Libra', '天蝎座': 'Scorpio',
  '射手座': 'Sagittarius', '摩羯座': 'Capricorn', '水瓶座': 'Aquarius', '双鱼座': 'Pisces',
  '外向': 'Extrovert', '内向': 'Introvert', '理性': 'Rational', '感性': 'Emotional',
  '冒险': 'Adventurous', '稳健': 'Steady', '领导者': 'Leader', '协作者': 'Collaborator',
  '探索': 'Explore', '自由': 'Freedom', '真理': 'Truth', '仁爱': 'Love', '秩序': 'Order', '创造': 'Create',
  '探索未知': 'Explore the unknown', '自由不羁': 'Free spirit', '追寻真理': 'Seek truth',
  '悲悯仁爱': 'Compassion', '建立秩序': 'Build order', '创造万物': 'Create all things',
  '宇宙决定': 'Let the cosmos decide',
  '你被什么吸引？': 'What draws you in?',
  '选择 1–3 项爱好，它们会塑造你星辰的禀赋。（可多选）': 'Pick 1–3 interests; they shape your star’s gifts. (multiple)',
  '你的星，落在哪片星座？': 'Which constellation holds your star?',
  '选一片星座，我们便在那片天区里为你认领一颗真实恒星；也可交给宇宙决定。': 'Pick a constellation and we claim a real star there for you; or let the cosmos decide.',
  '你属于哪片星象？': 'Which sign are you?',
  '你的星座，将影响恒星的光谱与温度。': 'Your sign influences the star’s spectrum and temperature.',
  '你怎样存在于世界？': 'How do you exist in the world?',
  '每组选一个，它们决定恒星的体积、质量与自转。': 'Pick one per pair; they decide size, mass and spin.',
  '你信奉什么？': 'What do you believe?',
  '人生信念，将指引你的星辰落入哪片星系。': 'Your belief guides which galaxy your star falls into.',
  '生成我的星星': 'Generate my star', '下一题': 'Next',
  '请至少选择一项爱好': 'Pick at least one interest',
  '请选择一片星座，或交给宇宙决定': 'Pick a constellation, or let the cosmos decide',
  '请选择一个星座': 'Pick a sign',
  '请选择一种人生信念': 'Pick a belief',
  // ---- 旗帜预设 / 渐变（显示在建国页 UI）----
  '雅典': 'Athens', '星海': 'Star Sea', '赤焰': 'Ember', '翠垣': 'Verdant', '月邦': 'Luna', '紫宸': 'Amethyst',
  '极光': 'Aurora', '星云': 'Nebula', '帝星': 'Imperial', '冰封': 'Frozen', '黎明': 'Dawn',
  // ---- 证书正文（固定文案）----
  '兹证明，宇宙深处一颗': 'This certifies that, in the depths of the cosmos, a',
  '恒星': 'star', '行星': 'planet',
  '自此冠以「': 'is henceforth named “', '」之名，归属其认领者，永载星际公民名册。': '”, belonging to its claimant, forever recorded in the Interstellar Citizen Registry.',
  '本星名与坐标引自真实天文星表（Yale 亮星表 / Hipparcos）。注册号': 'Star name and coordinates are cited from real catalogs (Yale Bright Star / Hipparcos). Registry No.',
  '与星表编号': 'and catalog No.', '永久存档，可在「真实星空」页定位核验。': 'are permanently archived and verifiable on the “Real Sky” page.',
  // ---- 哲思金句 ----
  '我们都是星尘所铸，却又仰望星空。': 'We are all stardust, yet we look up at the stars.',
  '在群星之间你并不渺小，你本就是宇宙认识自己的方式。': 'Among the stars you are not small — you are how the universe knows itself.',
  '每一颗星，都是一封写给未来的信。': 'Every star is a letter written to the future.',
  '我们仰望同一片天空，却各自认领了不同的光。': 'We gaze at the same sky, yet each claims a different light.',
  '宇宙从不喧哗，它只是恒久地亮着，等你被看见。': 'The universe never shouts; it simply shines, waiting for you to be seen.',
  '你认领的不是一颗星，而是一段属于自己的永恒坐标。': 'You claim not a star, but an eternal coordinate of your own.',
  // ---- 恒星光谱名 / 行星类型（证书数值）----
  '蓝特超巨星': 'Blue hypergiant', '蓝白星': 'Blue-white star', '白色星': 'White star',
  '黄白星': 'Yellow-white star', '类太阳黄星': 'Sun-like yellow star', '橙矮星': 'Orange dwarf',
  '红矮星': 'Red dwarf', '红超巨星': 'Red supergiant', '红巨星': 'Red giant', '橙巨星': 'Orange giant',
  '黄巨星': 'Yellow giant', '黄白巨星': 'Yellow-white giant', '恒星': 'Star',
  '类地行星': 'Terrestrial', '荒漠行星': 'Desert world', '冰封行星': 'Ice world',
  '月球型行星': 'Moon-like world', '气态巨行星': 'Gas giant',
  '蓝特超巨星 ':'Blue hypergiant ', '类太阳黄星 ':'Sun-like yellow star ',
  // ---- 星系 / 特征（证书数值）----
  '银河系 · 猎户臂边缘':'Orion Arm, Milky Way','本星系群 · 银晕':'Local Group · Halo',
  '银河系 · 旋臂':'Spiral arm, Milky Way','银心 · 核球外缘':'Galactic center · Bulge',
  '银河系 · 银晕':'Milky Way · Halo','大麦哲伦云':'Large Magellanic Cloud',
  '小麦哲伦云':'Small Magellanic Cloud','银河系 · 远银极':'Milky Way · Galactic pole',
  '银河系 · 猎户臂':'Orion Arm, Milky Way','三角座星系外围':'Triangulum Galaxy edge',
  '玉夫座矮星系':'Sculptor Dwarf','天炉座星系团边缘':'Fornax Cluster edge',
  '银河系 · 旋臂 (2)':'Spiral arm, Milky Way','M81 星系群':'M81 Group',
  '鲸鱼座超星系团':'Cetus Supercluster','后发座星系团边缘':'Coma Cluster edge',
  '室女座超团边缘':'Virgo Supercluster edge','巨引源附近':'Near Great Attractor',
  '本超星系团外缘':'Local Supercluster edge','银河系 · 尘埃带':'Milky Way · Dust lane',
  '船底座星云区':'Carina Nebula','玫瑰星云区':'Rosette Nebula','鹰状星云区':'Eagle Nebula',
  '银河系悬臂边缘':'Orion Arm, Milky Way','本星系群外围':'Local Group outskirts',
  '室女座超星系团':'Virgo Supercluster','拉尼亚凯亚巨引源':'Laniakea Great Attractor',
  '银河系银晕':'Milky Way Halo','大麦哲伦云 (2)':'Large Magellanic Cloud',
  '小麦哲伦云 (2)':'Small Magellanic Cloud','仙女座外围':'Andromeda outskirts',
  '银河系猎户臂':'Orion Arm, Milky Way','三角座星系':'Triangulum Galaxy',
  '玉夫座矮星系 (2)':'Sculptor Dwarf','天炉座星系团':'Fornax Cluster',
  '银河系旋臂':'Spiral arm, Milky Way','M81星系群':'M81 Group',
  '鲸鱼座超星系团 (2)':'Cetus Supercluster','后发座星系团':'Coma Cluster',
  '银河系核球外缘':'Galactic center · Bulge','室女座超团':'Virgo Supercluster',
  '巨引源附近 (2)':'Near Great Attractor','本超星系团中心':'Local Supercluster center',
  '银河系尘埃带':'Milky Way · Dust lane','船底座星云':'Carina Nebula',
  '玫瑰星云':'Rosette Nebula','鹰状星云':'Eagle Nebula',
  '表面荡漾着极光般的光谱涟漪，被视为宇宙的乐器。':'Its surface ripples with aurora-like spectra, like an instrument of the cosmos.',
  '周围环绕可观测的尘埃环，是天然的恒星实验室。':'Wrapped in observable dust rings, a natural stellar laboratory.',
  '拥有一颗含液态水的宜居卫星，绿意盎然。':'It has a habitable moon with liquid water, lush and green.',
  '磁场极强，耀斑喷发如战旗猎猎。':'A fierce magnetic field; flares burst like battle banners.',
  '自转极慢，光芒沉稳如冥想之火。':'Spins slowly; its light is calm like a meditative fire.',
  '被伴星环绕，构成稳定的多星系统。':'Ringed by companions, a stable multi-star system.',
  '这是一颗沉默燃烧、等待被命名的星。':'A silently burning star, waiting to be named.',
  '在亿万光年之外，它为你而亮。 (2)':'Beyond billions of light-years, it shines for you.',
  '它的光，出发时世界还很年轻。':'Its light set out when the world was young.',
  '你与它的相遇，是宇宙级别的巧合。':'Your meeting with it is a cosmic coincidence.',
  '它不属于任何机构，此刻它属于你。':'It belongs to no institution; right now it is yours.',
  // ---- 星座（证书/星空页值，IAU 标准英文名）----
  '猎户座':'Orion', '天琴座':'Lyra', '仙女座':'Andromeda', '天蝎座':'Scorpius',
  '大熊座':'Ursa Major', '小熊座':'Ursa Minor', '天鹰座':'Aquila', '天鹅座':'Cygnus',
  '武仙座':'Hercules', '英仙座':'Perseus', '双子座':'Gemini', '狮子座':'Leo',
  '室女座':'Virgo', '天秤座':'Libra', '麒麟座':'Monoceros', '船底座':'Carina',
  '御夫座':'Auriga', '北冕座':'Corona Borealis', '蛇夫座':'Ophiuchus', '长蛇座':'Hydra',
  // ---- 大气气体成分（证书/宇宙页值）----
  '氢 H':'H', '氦 He':'He', '氧 O₂':'O₂', '氮 N₂':'N₂', '二氧化碳 CO₂':'CO₂',
  '甲烷 CH₄':'CH₄', '氨 NH₃':'NH₃', '水蒸气 H₂O':'H₂O', '氖 Ne':'Ne',
  // ---- 证书/星空页补充 ----
  '注册时间 UTC':'Registered (UTC)',
  '星案特册 注册星球':'STAR ARCHIVE',
  // ---- 单位（距离/自转）----
  '光年':' ly', '小时':'h', '天':'d',
  // ---- 建国门禁 / 钱包铸造 ----
  '连接账户':'Connect account', '生成王国凭证':'Create Kingdom Pass',
  '生成中…':'Creating…', '已生成 · 解锁建国':'Created · kingdom unlocked',
  '请安装 MetaMask 等账户工具':'Please install MetaMask or an account tool',
  '签名被取消或失败':'Signature cancelled or failed',
  '未获取到账户':'No account obtained',
  '请先连接账户并生成凭证':'Connect an account and create the pass first',
  '建国需先生成王国凭证':'Create your Kingdom Pass to build',
  '普通用户需连接账户并生成王国凭证，才能解锁旗帜设计与建国。生成后，王国数据随证书永久保存与分享，可随时核验。':'Connect an account and create the Kingdom Pass to unlock flag design and kingdom building. The kingdom data is permanently saved and shared with the certificate, verifiable anytime.',
  '核验':'Verify', '已生成':'Created',
  '请安装 Phantom':'Please install Phantom',
  '连接已取消':'Connection cancelled',
  '该方式暂未开放':'This method is not available yet',
  '证书尚未生成，请稍候':'Certificate not ready yet, please wait',
  '不支持的方式':'Unsupported method', '生成失败':'Creation failed',
  '账户已连接':'Account connected', '未连接':'Not connected',
};

let currentLang = (typeof localStorage !== 'undefined' && localStorage.getItem('star-sky-lang')) || 'zh';

export function getLang(){ return currentLang; }

export function t(s){
  if (currentLang === 'en' && s != null && EN[s] != null) return EN[s];
  return s;
}

export function setLang(l){
  currentLang = (l === 'en') ? 'en' : 'zh';
  try { localStorage.setItem('star-sky-lang', currentLang); } catch(e){}
  document.documentElement.lang = currentLang === 'en' ? 'en' : 'zh-CN';
  applyI18n();
  if (typeof window !== 'undefined' && typeof window.__onLangChange === 'function'){
    window.__onLangChange(currentLang);
  }
}

export function applyI18n(){
  if (typeof document === 'undefined') return;
  document.querySelectorAll('[data-i18n]').forEach(el=>{
    const k = el.getAttribute('data-i18n');
    if (k != null) el.textContent = t(k);
  });
  document.querySelectorAll('[data-i18n-ph]').forEach(el=>{
    const k = el.getAttribute('data-i18n-ph');
    if (k != null) el.setAttribute('placeholder', t(k));
  });
  const tg = document.getElementById('lang-toggle');
  if (tg) tg.textContent = currentLang === 'en' ? '中文' : 'EN';
  // 语言标记挂到 body，供纯 CSS 文案（如 info 卡“编号”前缀）按语言切换
  if (typeof document !== 'undefined' && document.body){
    document.body.classList.toggle('lang-en', currentLang === 'en');
  }
  // 影院开场诗（含 <b> 强调，需保留标签）
  const ct0 = document.getElementById('ct-0');
  const ct1 = document.getElementById('ct-1');
  const ct2 = document.getElementById('ct-2');
  if (currentLang === 'en'){
    if (ct0) ct0.innerHTML = 'In ancient Greece, people gazed at the stars, believing each one was a guardian deity.';
    if (ct1) ct1.innerHTML = 'Now, the gate of the city-state opens for you —';
    if (ct2) ct2.innerHTML = 'beyond it lies the <b>vast cosmos</b>, and a star waiting to be named.';
  } else {
    if (ct0) ct0.innerHTML = '在古希腊，人们仰望星空，相信每颗星都是一位守护神。';
    if (ct1) ct1.innerHTML = '如今，城邦之门为你而开——';
    if (ct2) ct2.innerHTML = '门后，是<b>浩瀚宇宙</b>，与一颗正等待你命名的星。';
  }
}

export function initLangToggle(){
  const btn = document.getElementById('lang-toggle');
  if (!btn) return;
  applyI18n();
  btn.addEventListener('click', ()=> setLang(currentLang === 'en' ? 'zh' : 'en'));
}
