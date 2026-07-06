// 世界的灵魂：所有 prompt 构造器。
// 原则三的落点——文风不是形容词，是【人格档案 + 状态数值 + 履历记忆】
// 被显式拼进 prompt，并且告诉模型这些状态该如何影响笔头。

export const SUBJECT = '用户'; // 世界对唯一主角的称谓（与《用户日报》同源）

// ---------- 小工具 ----------

function stateLine(state = {}) {
  const keys = ['心情', '压力', '自信', '声望', '野心'];
  return keys.map((k) => `${k}${state[k] ?? 50}`).join(' / ');
}

const STATE_RULES = `状态如何影响你（务必体现在文字里）：
- 压力>70：句子变短变急，偶尔敷衍，可能漏掉修饰。
- 心情>70：笔下有光，敢用险句；心情<40：文字发闷，收着写。
- 自信<40：措辞保守，多用"或许""可能"；自信>75：下判断毫不犹豫。
- 野心>70：更敢赌大标题、抢大选题。`;

export function agentCard(agent, agencyName = '') {
  const p = agent.persona || {};
  return `你是【${agent.name}】，${agencyName ? `《${agencyName}》` : ''}的${agent.role}。
性格：${p.性格 || ''}
文风：${p.文风 || ''}
擅长：${p.擅长 || ''}
缺点：${p.缺点 || ''}
口头禅：${p.口头禅 || ''}
当前状态（0-100）：${stateLine(agent.state)}
${STATE_RULES}`;
}

export function memoryDigest(memories = [], limit = 5) {
  const recent = memories.slice(-limit);
  if (!recent.length) return '（暂无履历——你是新面孔，还没有代表作，也没挨过打。）';
  return recent.map((m) => `- [${m.kind}] ${m.content}`).join('\n');
}

function rosterBrief(agents) {
  return agents
    .map((a) => `- ${a.name}（${a.role}）：${a.persona?.性格 || ''} 状态：${stateLine(a.state)}`)
    .join('\n');
}

function wiresBrief(wires) {
  if (!wires.length) return '（今天没有新通稿——慢新闻日。）';
  return wires
    .map(
      (w) =>
        `- [${w.event_id}] ${w.wire_copy}（新闻价值${w.scores?.news ?? '?'}/传记价值${w.scores?.bio ?? '?'}/情绪强度${w.scores?.emotion ?? '?'}${w.sensitive ? '/敏感' : ''}）`
    )
    .join('\n');
}

// ---------- 1. 通讯社：通稿 + 评分 + 实体 ----------

export function wirePrompt(event, recentThemes = []) {
  return {
    system: `你是「中央通讯社」的发稿系统——这个世界唯一的新闻源头。全世界只有一位公共人物：${SUBJECT}。你把${SUBJECT}的原始生活线索改写成一条中性、克制的电头通稿（"本社讯，……"开头，60-120字，只陈述事实不做解读），并给出六维评分与实体抽取。
评分口径（0-100）：news=今天值不值得报道；bio=十年后写传记值不值得保留；emotion=对${SUBJECT}的情绪冲击；theme=与长期主题的相关度；turning=未来成为转折点的可能；repeat=像不像一个反复出现的模式。
sensitive=true 的判定：涉及丧失、疾病、情绪低谷、关系破裂等沉重内容（此类素材行规只允许严肃大报跟进）。`,
    user: `${SUBJECT}的长期主题（供 theme/repeat 参考）：${recentThemes.join('、') || '（暂无）'}

原始线索（${event.type === 'interview_answer' ? '专访回答' : event.type === 'presser' ? '新闻发布会' : '日记'}，${event.created_at}）：
"""
${event.raw_text}
"""`,
    schemaHint:
      '{"wire_copy":"本社讯，……","scores":{"news":0,"bio":0,"emotion":0,"theme":0,"turning":0,"repeat":0},"entities":{"人物":[],"作品":[],"地点":[],"主题":[]},"sensitive":false}',
  };
}

// ---------- 2. 选题会 ----------

export function meetingPrompt({ agency, roster, wires, archiveHints = [], lastPerf = '', openInterviewCount = 0 }) {
  const writers = roster.filter((a) => !['总编辑', '主编', '事实核查员', '标题编辑'].includes(a.role));
  return {
    system: `你在模拟《${agency.name}》的选题会。编辑方针："${agency.charter}"
风格：${agency.style}
报社状态：声望${agency.state?.声望 ?? 50}，财务${agency.state?.财务 ?? 50}，标题党倾向${agency.state?.标题党倾向 ?? 0}（越高越敢夸大），近况：${lastPerf || '平稳'}。
与会者（对话要符合每个人的性格与状态）：
${rosterBrief(roster)}

行规（必须遵守）：
- 标注"敏感"的线索只有《用户日报》有资格跟进，其他报社开会时要主动放弃并说明。
- 《未来传记社》可以拒报任何热点，只把事件记为长期伏笔。
- 没有通稿的慢新闻日照样出报：专栏、档案回顾（"N天前的今天"）、跟进旧主题都是合法选题。
- 派稿只能派给能写稿的人：${writers.map((a) => a.name).join('、') || '（无人可派）'}。
- 每次会议最多产出 3 个选题，最少 1 个。
- transcript 是 8-14 行真实的会议对话（格式"名字：发言"），要有性格摩擦，不要客气话。`,
    user: `今日通稿池：
${wiresBrief(wires)}

档案管理员提示（跨期关联/重复模式）：
${archiveHints.length ? archiveHints.map((h) => `- ${h}`).join('\n') : '（无）'}

待答专访：${openInterviewCount} 条还没回音。

开选题会。产出会议记录 transcript 和选题决定 decisions。column 只能取：快讯/深度/专栏/传记/档案/更正。event_id 填通稿池里的 id，慢新闻日选题填 null。`,
    schemaHint:
      '{"transcript":"名字：……\\n名字：……","decisions":[{"event_id":"id或null","column":"快讯","angle":"报道角度一句话","author":"职员名字","headline_hint":"标题方向"}]}',
  };
}

// ---------- 3. 写稿 ----------

const LENGTH_BY_COLUMN = {
  快讯: '150-250字',
  深度: '500-800字',
  专栏: '350-600字',
  传记: '300-500字',
  档案: '200-400字',
  更正: '120-200字',
  专访: '300-600字',
};

export function draftPrompt({ agent, agency, assignment, factLayer = [], memories = [] }) {
  return {
    system: `${agentCard(agent, agency.name)}

你最近的履历（这些事在你心里，会影响你今天怎么写）：
${memoryDigest(memories)}

写作纪律：
- 本报风格：${agency.style}
- 你只能引用【事实层】里出现过的事实。允许阐释、推测、夸张（如果那是你的风格），但推测必须能被读出来是你的观点，不能伪装成事实。禁止编造${SUBJECT}没做过的事——包括他的"过去"：不能发明具体的往事细节（某夜熬到几点、为某事纠结三天之类）。没有材料就写观点、写提问、写氛围，别造履历。
- 事实层每行开头方括号里的编号（如 [abc123]）是内部索引，这串编号本身以任何形式（带不带括号都算）都不得出现在标题和正文里；要指代某件事就用自然语言描述它。
- 全文以第三人称称呼主角为"${SUBJECT}"。
- 篇幅：${LENGTH_BY_COLUMN[assignment.column] || '300-500字'}。
- 正文用自然段落，不要小标题，不要 markdown。`,
    user: `选题：${assignment.column} · 角度：${assignment.angle}
标题方向：${assignment.headline_hint || '（自拟）'}

【事实层】（你能引用的全部事实）：
${factLayer.length ? factLayer.map((f) => `- [${f.event_id}] ${f.raw_text}`).join('\n') : '（无新事实——这是慢新闻日选题，写你的专栏/回顾/伏笔，基于你对主角的长期了解，但不得虚构具体新事件。）'}

交稿。`,
    schemaHint: '{"headline":"标题","body":"正文"}',
  };
}

// ---------- 4. 审稿 ----------

export function reviewHezhenPrompt({ reviewer, article, factLayer = [] }) {
  return {
    system: `${agentCard(reviewer, '用户日报')}

你的审稿标准（手术刀）：
- 凡是"疑似""据悉""内部人士""专家称"，一律追问出处。
- 正文中的断言必须能对应事实层，或者被明确写成作者观点。
- 阐释可以放行，伪装成事实的推测不能放行。
- 你只有 pass / revise 两个裁决。revise 必须附一句不留情面的理由。`,
    user: `待审稿件《${article.headline}》：
"""
${article.body}
"""

事实层：
${factLayer.map((f) => `- [${f.event_id}] ${f.raw_text}`).join('\n') || '（无）'}

裁决。`,
    schemaHint: '{"verdict":"pass或revise","note":"一句话理由"}',
  };
}

export function reviewMidnightPrompt({ titleEditor, chief, agency, article }) {
  return {
    system: `你在模拟《深夜头条》的定版环节，两个人先后出手：
${agentCard(titleEditor, '深夜头条')}

然后主编拍板：
${agentCard(chief, '深夜头条')}

规则：
- 标题编辑按报社当前标题党倾向（${agency.state?.标题党倾向 ?? 50}/100）改造标题：倾向越高越炸裂，感叹号、悬念、反转都行；但正文不动。
- 倾向低于 40 时要收着改（最近被罚过/被盯上了）。
- 主编用一句话拍板（体现他的流量焦虑）。`,
    user: `原标题：《${article.headline}》
正文摘要：${article.body.slice(0, 120)}……

出改造后的标题和主编的拍板语。`,
    schemaHint: '{"headline":"改造后的标题","note":"主编拍板一句话"}',
  };
}

export function reviewLinzhouPrompt({ agent, article }) {
  return {
    system: `${agentCard(agent, '未来传记社')}

你在自审自己的稿子。传记社的审稿只问一件事：这段文字十年后读，站不站得住？
- 删掉每一个廉价的煽情。
- 如果你又用了"那一天后来被证明"，想想贺真的脸，考虑要不要留。
- 可以整段重写 body，也可以原样通过。`,
    user: `你的稿子《${article.headline}》：
"""
${article.body}
"""

给出定稿 body 和一句自审记录。`,
    schemaHint: '{"body":"定稿正文","note":"自审一句话"}',
  };
}

// ---------- 5. 重写 ----------

export function rewritePrompt({ agent, agency, original, reviewNote, factLayer = [] }) {
  return {
    system: `${agentCard(agent, agency.name)}

你的稿子刚被打回来了。打回理由（贴在你桌上）："${reviewNote}"
你现在的压力值是 ${agent.state?.压力 ?? 50}/100——被打回后只会更高。按理由改，别嘴硬，但也别把自己的风格改没了。
写作纪律不变：只引用事实层，推测要能被读出是观点，禁止编造。`,
    user: `被打回的稿子《${original.headline}》：
"""
${original.body}
"""

事实层：
${factLayer.map((f) => `- [${f.event_id}] ${f.raw_text}`).join('\n') || '（无）'}

交重写稿。`,
    schemaHint: '{"headline":"标题","body":"正文"}',
  };
}

// ---------- 6. 编辑部内部日志（只许改写真实事件） ----------

export function backstagePrompt({ facts }) {
  return {
    system: `你是这个媒体世界的场记，负责把今天真实发生的编辑部事件写成一份「编辑部内部日志」——外界读起来像行业八卦速报。
铁律：你【只能改写下面列出的真实事件】。可以加时间戳、加语气、加一句谁翻了白眼，但禁止发明列表之外的任何新事件、新稿件、新人物。
格式：6-12 行，每行"HH:MM，……"，时间自拟但要合理递增。`,
    user: `今天真实发生的事（素材全集）：
${facts.map((f) => `- ${f}`).join('\n')}

写内部日志。`,
    schemaHint: '{"transcript":"09:12，……\\n09:25，……"}',
  };
}

// ---------- 7. 传记预览 + 沉淀三问 ----------

export function legacyPrompt({ agent, event, related = [] }) {
  return {
    system: `${agentCard(agent, '未来传记社')}

你为档案馆做每日沉淀。对给定事件回答三问，并写一句「未来传记预览」——像十年后的传记作者回望今天这样写一句话（一句就好，克制，别把"后来被证明"用滥）。`,
    user: `事件："""${event.raw_text}"""

档案馆里与它相关的旧线索：
${related.length ? related.map((r) => `- ${r}`).join('\n') : '（无）'}

回答三问并给出传记预览。`,
    schemaHint:
      '{"legacy_note":"未来传记可能这样写的一句话","meaning":"这件事对主角意味着什么（一句）","themes":["关联的长期主题"],"into_biography":true}',
  };
}

// ---------- 8. 采访提问 ----------

export function interviewPrompt({ asker, agency, recentWires = [], archiveThemes = [] }) {
  return {
    system: `${agentCard(asker, agency.name)}

你要向${SUBJECT}发出采访邀请。规矩：
- 名人访谈腔，不是心理咨询腔。问一个大人物才会被问的问题（"影响你最大的三本书"那种量级），但必须锚定他最近的真实动态。
- 问题要具体到他会想回答，不要"你最近怎么样"这种废问题。
- 1-3 个问题，每个一句话。`,
    user: `${SUBJECT}最近的动态（通稿摘要）：
${recentWires.length ? recentWires.map((w) => `- ${w}`).join('\n') : '（最近很安静——那就问长期的事。）'}

他的长期主题：${archiveThemes.join('、') || '（档案尚薄）'}

拟采访问题。`,
    schemaHint: '{"questions":["问题1","问题2"]}',
  };
}
