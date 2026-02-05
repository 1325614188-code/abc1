
import React, { useState, useEffect } from 'react';
import { ModuleId, AnalysisResult } from './types';
import { MODULES } from './constants';
import Layout from './components/Layout';
import ImagePicker from './components/ImagePicker';
import { generateImageWithAI, analyzeWithAI, validateImageContent } from './services/geminiService';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginModal from './components/LoginModal';
import AdminDashboard from './components/AdminDashboard';
import WelcomeBanner from './components/WelcomeBanner';
import { getDeviceId } from './services/deviceService';

const MainApp: React.FC = () => {
  const { user, loading: authLoading, deductCredit, deviceId, refreshUser, logout } = useAuth();
  const [activeModule, setActiveModule] = useState<ModuleId | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showMemberCenter, setShowMemberCenter] = useState(false);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  // States for inputs
  const [faceImg, setFaceImg] = useState<string | null>(null);
  const [itemImg, setItemImg] = useState<string | null>(null);
  const [partnerImg, setPartnerImg] = useState<string | null>(null);
  const [gender, setGender] = useState<'female' | 'male'>('female');

  // 新增：兑换码和充值状态
  const [showRedeemModal, setShowRedeemModal] = useState(false);
  const [showRechargeModal, setShowRechargeModal] = useState(false);
  const [redeemCode, setRedeemCode] = useState('');
  const [redeemLoading, setRedeemLoading] = useState(false);
  const [wechatId, setWechatId] = useState('sekesm');
  const [alipayEnabled, setAlipayEnabled] = useState(false);
  const [copied, setCopied] = useState(false);
  const [rechargeLoading, setRechargeLoading] = useState<string | null>(null);

  // 图片放大弹窗状态
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  // 获取配置
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await fetch('/api/config');
        const data = await response.json();
        if (data.configs) {
          setWechatId(data.configs.wechat_id?.value || 'sekesm');
          // 读取充值开关 - 可能存储在 value 或 is_enabled 字段
          const alipayConfig = data.configs.alipay_enabled;
          setAlipayEnabled(
            alipayConfig?.is_enabled === true ||
            alipayConfig?.value === 'true' ||
            alipayConfig?.value === '1'
          );
        }
      } catch (err) {
        console.error('Error fetching config:', err);
      }
    };
    fetchConfig();
  }, []);

  const handleModuleClick = (id: ModuleId) => {
    if (!user) {
      setShowLoginModal(true);
      return;
    }
    setActiveModule(id);
    setResult(null);
    setFaceImg(null);
    setItemImg(null);
    setPartnerImg(null);
  };

  const runAnalysis = async () => {
    if (!user) return;
    if (user.credits <= 0) {
      alert("您的免费次数已用完，请联系管理员充值！");
      return;
    }

    if (!activeModule) return;
    setLoading(true);
    setResult(null);

    try {
      let prompt = '';
      let res: any;

      const imgParts = [];
      if (faceImg) imgParts.push({ data: faceImg, mimeType: 'image/jpeg' });
      if (itemImg) imgParts.push({ data: itemImg, mimeType: 'image/jpeg' });
      if (partnerImg) imgParts.push({ data: partnerImg, mimeType: 'image/jpeg' });

      // 图片内容验证
      const needsFaceCheck = [
        ModuleId.TryOnClothing,
        ModuleId.TryOnEarrings,
        ModuleId.HairstyleRef,
        ModuleId.BeautyScore,
        ModuleId.FacialColor,
        ModuleId.Physiognomy
      ].includes(activeModule);

      const needsTongueCheck = activeModule === ModuleId.TongueDiag;

      // 验证人脸照片
      if (needsFaceCheck && faceImg) {
        const validation = await validateImageContent(
          { data: faceImg, mimeType: 'image/jpeg' },
          'face'
        );
        if (!validation.valid) {
          alert(validation.message);
          setLoading(false);
          return;
        }
      }

      // 验证夫妻相双方照片
      if (activeModule === ModuleId.CoupleMatch) {
        if (faceImg) {
          const v1 = await validateImageContent({ data: faceImg, mimeType: 'image/jpeg' }, 'face');
          if (!v1.valid) {
            alert('男方照片：' + v1.message);
            setLoading(false);
            return;
          }
        }
        if (partnerImg) {
          const v2 = await validateImageContent({ data: partnerImg, mimeType: 'image/jpeg' }, 'face');
          if (!v2.valid) {
            alert('女方照片：' + v2.message);
            setLoading(false);
            return;
          }
        }
      }

      // 验证舌头照片
      if (needsTongueCheck && faceImg) {
        const validation = await validateImageContent(
          { data: faceImg, mimeType: 'image/jpeg' },
          'tongue'
        );
        if (!validation.valid) {
          alert(validation.message);
          setLoading(false);
          return;
        }
      }

      switch (activeModule) {
        case ModuleId.TryOnClothing:
          prompt = "这是一个虚拟试衣请求。请将第二张图片中的衣服款式穿在第一张图片中的人物身上。保持人物面容一致，背景自然。";
          res = await generateImageWithAI(prompt, imgParts);
          break;
        case ModuleId.TryOnEarrings:
          prompt = "这是一个虚拟试戴耳坠请求。请将第二张图片中的耳坠戴在第一张图片中的人物耳朵上。如果是正面图像，请左右两侧都显示。";
          res = await generateImageWithAI(prompt, imgParts);
          break;
        case ModuleId.HairstyleRef:
          prompt = `这是一个发型参考请求。请根据该人物的面型生成一张包含10种不同流行、适合${gender === 'female' ? '女性' : '男性'}发型的拼接效果图。`;
          res = await generateImageWithAI(prompt, imgParts);
          break;
        case ModuleId.BeautyScore:
          prompt = `请作为专业美学分析师，对这张${gender === 'female' ? '女士' : '男士'}照片进行全方位深度美学评估。

【五官精细分析】
1. 眉眼：眉形弧度、眉眼间距、眼型（杏眼/丹凤眼/桃花眼等）、双眼皮类型、眼神清澈度、睫毛浓密度
2. 鼻部：鼻梁高度、鼻翼宽度、鼻头形态、山根高低、鼻唇角度
3. 唇部：唇形（樱桃唇/花瓣唇等）、唇珠饱满度、唇色红润度、微笑弧度
4. 脸型轮廓：脸型判定（鹅蛋脸/瓜子脸/圆脸等）、下颌线条、颧骨高低、太阳穴饱满度
5. 额头与发际线：额头饱满度、发际线形状、面中比例

【骨相与结构分析】分析面部骨骼支撑感、立体度、侧面轮廓曲线

【皮肤状况评估】肤质细腻度、光泽感、匀净度、是否有瑕疵

【气质与神韵】整体气场、眼神魅力、表情自然度、独特个人风格

【综合评分】给出0-100的美学评分，并说明加分项和可提升空间

请以温暖鼓励的语气撰写，突出优点，委婉提出建议。

【写作风格要求】
- 采用小红书笔记风格，活泼亲切，多用emoji表情符号
- 每个分析要点用emoji开头（如✨💫🌸💕👀💋等）
- 内容分段清晰，每段之间空一行
- 语气要像闺蜜聊天一样亲切自然
- 适当使用感叹句增加感染力

返回JSON格式，包含title、score、content（详细分析，至少500字，分段展示）、advice（3-5条变美建议，每条用emoji开头）。`;
          res = await analyzeWithAI(prompt, imgParts);
          break;
        case ModuleId.CoupleMatch:
          prompt = `请作为资深情感分析专家，深度分析这两张人物照片的"夫妻相"契合程度。

【五官相似度对比分析】
1. 眉眼契合：双方眉形走势、眼型相似度、眼神气质是否呼应
2. 鼻部特征：鼻梁高度、鼻型是否有相似基因特征
3. 唇部轮廓：唇形厚薄、嘴角弧度、微笑时的相似感
4. 脸型匹配：面部轮廓线条、下颌角度、面部比例的协调性
5. 整体面相：额头、颧骨、下巴的骨相呼应程度

【气质与神韵分析】
- 两人眼神中传递的性格信息
- 气场是否互补或相融
- 笑容的感染力与默契度
- 整体形象的视觉和谐感

【缘分解读】
- 从面相学角度分析两人的姻缘深浅
- 性格互补性预测
- 相处模式推测
- 长期关系稳定性评估

【契合度评分】给出0-100的夫妻相契合度评分

请以浪漫温馨的语气撰写，给予美好祝福。

【写作风格要求】
- 采用小红书笔记风格，甜蜜浪漫，多用emoji表情符号
- 每个分析要点用emoji开头（如💕💗👫💑✨🌹💍等）
- 内容分段清晰，每段之间空一行
- 语气甜蜜温馨，像给好朋友分享恋爱心得
- 多用感叹句和祝福语

返回JSON格式，包含title、score、content（详细分析，至少500字，分段展示）、advice（3-5条经营感情的建议，每条用emoji开头）。`;
          res = await analyzeWithAI(prompt, imgParts);
          break;
        case ModuleId.TongueDiag:
          prompt = `请作为资深中医舌诊专家，对这张舌象照片进行专业详细的诊断分析。

【舌质详细分析】
1. 舌色：淡红/红/绛红/淡白/青紫等，判断气血状况
2. 舌形：胖大/瘦薄/裂纹/芒刺等形态特征
3. 舌体：软硬度、灵活度、是否有歪斜
4. 齿痕：有无齿痕、齿痕深浅程度、分布位置
5. 舌下络脉：颜色深浅、是否有瘀斑、曲张程度

【舌苔精细分析】
1. 苔色：白苔/黄苔/灰苔/黑苔，判断寒热虚实
2. 苔质：薄苔/厚苔/腻苔/剥苔/花剥苔
3. 润燥：润泽/干燥/滑腻程度
4. 分布：全舌/偏侧/根部/尖部苔象差异

【脏腑对应分析】
- 舌尖对应心肺状况
- 舌中对应脾胃功能
- 舌根对应肾与下焦
- 舌边对应肝胆情况

【体质判断】结合舌象判断当前体质类型（气虚/血虚/阴虚/阳虚/痰湿/湿热/血瘀/气郁等）

【健康提示】可能存在的健康隐患预警

请以专业但通俗易懂的语言撰写。

【写作风格要求】
- 采用小红书笔记风格，温暖关怀，多用emoji表情符号
- 每个分析要点用emoji开头（如🔍💚🌿🍵☕️💪🏥等）
- 内容分段清晰，每段之间空一行
- 语气像贴心的家庭医生，专业又亲切
- 把专业术语用通俗语言解释清楚

返回JSON格式，包含title、score（健康指数0-100）、content（详细分析，至少500字，分段展示）、advice（5-8条饮食起居调理建议，每条用emoji开头）。`;
          res = await analyzeWithAI(prompt, imgParts);
          break;
        case ModuleId.FacialColor:
          prompt = `请作为资深中医面诊专家，对这张面部照片进行全面的面色健康分析。

【整体面色分析】
1. 主色判断：红/黄/白/青/黑五色辨证
2. 光泽度：面部是否有光泽、润泽还是晦暗枯槁
3. 均匀度：肤色是否均匀、有无斑块色差
4. 红润度：气血充盈程度的体现

【面部分区诊察】
1. 额部（心区）：额头色泽反映心血管状况
2. 鼻部（脾区）：鼻头颜色反映脾胃消化功能
3. 左颊（肝区）：左脸颊反映肝胆疏泄情况
4. 右颊（肺区）：右脸颊反映肺与呼吸系统
5. 下颌（肾区）：下巴区域反映肾与生殖系统
6. 眼周：眼袋、黑眼圈、眼白颜色的健康信号
7. 唇色：唇部颜色深浅、润燥程度

【气血状况评估】
- 气虚表现：面色淡白、少华
- 血虚表现：面色萎黄、口唇淡
- 阴虚表现：颧红、潮热
- 阳虚表现：面色晄白、畏寒

【五官神气分析】眼神、表情、精神状态的健康反映

【体质类型判断】根据面色综合判断当前体质倾向

请以关怀温和的语气撰写。

【写作风格要求】
- 采用小红书笔记风格，温暖关怀，多用emoji表情符号
- 每个分析要点用emoji开头（如🌸💆‍♀️✨💪🍎🥗💤等）
- 内容分段清晰，每段之间空一行
- 语气像闺蜜分享护肤养生心得，亲切自然
- 把中医理论用生活化语言解释

返回JSON格式，包含title、score（健康指数0-100）、content（详细分析，至少500字，分段展示）、advice（5-8条针对性的调理建议，每条用emoji开头，包括饮食、作息、情志调节等）。`;
          res = await analyzeWithAI(prompt, imgParts);
          break;
        case ModuleId.Physiognomy:
          prompt = `请作为资深相学大师，根据中国传统面相学理论，对此人进行全方位的面相分析。

【五官精细相法】
1. 眉相（情缘宫/兄弟宫）：眉形浓淡、长短、眉头眉尾走势，分析兄弟缘、朋友运
2. 眼相（监察官/夫妻宫）：眼型、眼神、眼尾纹路，分析智慧、桃花、配偶情况
3. 鼻相（财帛宫/疾厄宫）：山根、鼻梁、鼻头、鼻翼，分析财运、健康、中年运势
4. 耳相（采听官）：耳形、耳垂、耳廓，分析少年运、福气、寿元
5. 唇相（出纳官）：唇形、唇色、人中，分析言语、食禄、子女缘

【面部十二宫详解】
- 命宫（印堂）：一生运势总枢纽
- 财帛宫（鼻头）：理财能力与财富积累
- 官禄宫（额中）：事业发展与贵人运
- 迁移宫（额角）：出外运、变动运
- 夫妻宫（眼尾）：婚姻感情质量
- 子女宫（眼下）：子女缘分与晚年福

【骨相格局分析】
- 额骨、颧骨、下颌骨的形态与命理意义
- 面部三停比例与人生阶段运势

【性格深度解读】
结合五官特征，详细分析此人的性格优势、潜在弱点、处事风格

【综合运势预测】
- 事业发展：适合的行业、贵人方位、事业高峰期
- 财富运势：正财偏财、理财建议、财运转折点
- 感情婚姻：桃花运势、理想伴侣类型、婚姻质量
- 健康提醒：面相反映的健康注意事项

请以积极正面的语气撰写，多给予鼓励和正能量指引。

【写作风格要求】
- 采用小红书笔记风格，神秘有趣，多用emoji表情符号
- 每个分析要点用emoji开头（如🔮✨💰💕👑🌟💫🎯等）
- 内容分段清晰，每段之间空一行
- 语气像神秘又亲切的算命大师，专业又有趣
- 多用积极正面的表达，给人信心和希望

返回JSON格式，包含title、score（综合运势指数0-100）、content（详细分析，至少600字，分段展示）、advice（5-8条开运改运建议，每条用emoji开头）。`;
          res = await analyzeWithAI(prompt, imgParts);
          break;
      }

      setResult(res);
      // NOTE: 只有成功后才扣除额度，失败不扣费
      await deductCredit();

    } catch (err: any) {
      console.error(err);
      const msg = err.message || "未知错误";
      // NOTE: 失败时不扣除额度
      alert(`AI分析出了点小差: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  // 生成分享链接
  const getShareLink = () => {
    const baseUrl = window.location.origin;
    const refCode = deviceId.slice(-6);
    return `${baseUrl}?ref=${refCode}`;
  };

  // 复制分享链接
  const copyShareLink = () => {
    navigator.clipboard.writeText(getShareLink());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 兑换码提交
  const handleRedeem = async () => {
    if (!user || !redeemCode.trim()) return;
    setRedeemLoading(true);

    try {
      const response = await fetch('/api/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: redeemCode.toUpperCase(),
          user_id: user.id,
          device_id: deviceId
        })
      });

      const data = await response.json();

      if (response.ok) {
        alert(`兑换成功！获得5次额度，当前共 ${data.credits} 次`);
        setRedeemCode('');
        setShowRedeemModal(false);
        await refreshUser();
      } else {
        alert(data.error || '兑换失败');
      }
    } catch (err) {
      console.error('Redeem error:', err);
      alert('兑换失败，请稍后重试');
    } finally {
      setRedeemLoading(false);
    }
  };

  // 充值处理函数
  const handleRecharge = async (packageId: string, credits: number, price: number) => {
    if (!user) return;
    setRechargeLoading(packageId);

    try {
      const response = await fetch('/api/alipay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_order',
          user_id: user.id,
          package_id: packageId
        })
      });

      const data = await response.json();

      if (response.ok && data.success && data.form_html) {
        // 在新窗口中打开支付宝支付页面
        const payWindow = window.open('', '_blank');
        if (payWindow) {
          payWindow.document.write(data.form_html);
          payWindow.document.close();
        } else {
          // 如果弹窗被拦截，使用当前页面跳转
          document.write(data.form_html);
          document.close();
        }
      } else {
        alert(data.error || '创建订单失败');
      }
    } catch (err) {
      console.error('Recharge error:', err);
      alert('充值失败，请稍后重试');
    } finally {
      setRechargeLoading(null);
    }
  };

  const renderModuleContent = () => {
    if (!activeModule) return null;

    const current = MODULES.find(m => m.id === activeModule);

    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-slate-500 text-sm mb-4">{current?.description}</p>

          <div className="grid grid-cols-2 gap-4">
            {(activeModule !== ModuleId.CoupleMatch && activeModule !== ModuleId.TongueDiag) && (
              <ImagePicker label="上传人脸照片" image={faceImg} onImageChange={setFaceImg} />
            )}

            {activeModule === ModuleId.TryOnClothing && (
              <ImagePicker label="上传衣服照片" image={itemImg} onImageChange={setItemImg} />
            )}

            {activeModule === ModuleId.TryOnEarrings && (
              <ImagePicker label="上传耳坠照片" image={itemImg} onImageChange={setItemImg} />
            )}

            {activeModule === ModuleId.CoupleMatch && (
              <>
                <ImagePicker label="男方照片" image={faceImg} onImageChange={setFaceImg} />
                <ImagePicker label="女方照片" image={partnerImg} onImageChange={setPartnerImg} />
              </>
            )}

            {activeModule === ModuleId.TongueDiag && (
              <ImagePicker label="上传舌象照片" image={faceImg} onImageChange={setFaceImg} className="col-span-2" />
            )}

            {(activeModule === ModuleId.HairstyleRef || activeModule === ModuleId.BeautyScore) && (
              <div className="flex flex-col space-y-2">
                <label className="text-sm font-medium text-slate-600">性别选择</label>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setGender('female')}
                    className={`flex-1 py-3 rounded-xl border text-sm transition-all ${gender === 'female' ? 'bg-pink-500 text-white border-pink-500' : 'bg-white text-slate-400 border-slate-200'}`}
                  >
                    女士
                  </button>
                  <button
                    onClick={() => setGender('male')}
                    className={`flex-1 py-3 rounded-xl border text-sm transition-all ${gender === 'male' ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-slate-400 border-slate-200'}`}
                  >
                    男士
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={runAnalysis}
            disabled={loading || (activeModule === ModuleId.CoupleMatch ? (!faceImg || !partnerImg) : (!faceImg && !itemImg))}
            className="w-full mt-6 py-4 bg-gradient-to-r from-pink-500 to-rose-400 text-white rounded-2xl font-bold shadow-lg shadow-pink-200 disabled:opacity-50 disabled:shadow-none transition-all active:scale-95 flex items-center justify-center space-x-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>AI正在深度分析中...</span>
              </>
            ) : (
              <span>开始AI分析 (剩余 {user?.credits} 次)</span>
            )}
          </button>
        </div>

        {/* Result Area */}
        {result && (
          <div className="bg-white rounded-3xl p-6 shadow-md border border-pink-50 animate-in zoom-in-95 duration-700">
            {typeof result === 'string' ? (
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-slate-800">生成效果</h3>
                <p className="text-xs text-pink-500 text-center">👆 点击图片可放大查看</p>
                <img
                  src={result}
                  alt="AI Result"
                  className="w-full rounded-2xl shadow-lg border-4 border-white cursor-zoom-in hover:opacity-90 transition-opacity"
                  onClick={() => setZoomedImage(result)}
                />
                <p className="text-xs text-center text-slate-400">生成的图片仅供参考，请根据实际情况选择</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <h3 className="text-xl font-bold text-slate-800">{result.title || '分析报告'}</h3>
                  {result.score !== undefined && (
                    <div className="text-center">
                      <div className="text-3xl font-black text-pink-500">{result.score}</div>
                      <div className="text-[10px] text-slate-400 uppercase tracking-widest">Score</div>
                    </div>
                  )}
                </div>

                <div className="prose prose-pink max-w-none">
                  <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">{result.content}</p>
                </div>

                {result.advice && result.advice.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-bold text-pink-600 flex items-center">
                      <span className="mr-2">💡</span> 建议：
                    </h4>
                    <ul className="space-y-2">
                      {result.advice.map((item: string, idx: number) => (
                        <li key={idx} className="flex items-start text-sm text-slate-600">
                          <span className="w-5 h-5 bg-pink-50 text-pink-500 rounded-full flex items-center justify-center flex-shrink-0 mr-3 text-[10px] font-bold">
                            {idx + 1}
                          </span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={() => setResult(null)}
              className="w-full mt-6 py-3 text-slate-400 text-sm hover:text-pink-500 transition-colors"
            >
              重新分析
            </button>
          </div>
        )}
      </div>
    );
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500"></div>
      </div>
    );
  }

  if (showAdmin) {
    return <AdminDashboard onBack={() => setShowAdmin(false)} />;
  }

  // 会员中心页面
  if (showMemberCenter && user) {
    return (
      <Layout title="会员中心" onBack={() => setShowMemberCenter(false)}>
        <div className="space-y-4">
          {/* 用户信息卡片 */}
          <div className="bg-gradient-to-br from-pink-500 to-rose-400 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center text-3xl">
                👤
              </div>
              <div>
                <h2 className="text-xl font-bold">{user.nickname}</h2>
                <p className="opacity-90 text-sm">剩余 {user.credits} 次额度</p>
              </div>
            </div>
            <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white opacity-10 rounded-full"></div>
          </div>

          {/* 分享得次数 - 包含分享链接 */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex items-center space-x-3 mb-3">
              <div className="w-10 h-10 bg-green-100 text-green-600 rounded-xl flex items-center justify-center text-xl">
                🔗
              </div>
              <div>
                <h3 className="font-bold text-slate-800">分享得次数</h3>
                <p className="text-xs text-slate-400">好友通过链接注册，你获得1次额度</p>
              </div>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-xs text-slate-500 mb-2 break-all">{getShareLink()}</p>
              <button
                onClick={copyShareLink}
                className="w-full py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition-colors"
              >
                {copied ? '✓ 已复制链接' : '复制分享链接'}
              </button>
            </div>
          </div>

          {/* 兑换码 - 直接展示输入框 */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex items-center space-x-3 mb-3">
              <div className="w-10 h-10 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center text-xl">
                🎁
              </div>
              <div>
                <h3 className="font-bold text-slate-800">兑换码</h3>
                <p className="text-xs text-slate-400">输入兑换码获得5次额度</p>
              </div>
            </div>
            <input
              type="text"
              value={redeemCode}
              onChange={(e) => setRedeemCode(e.target.value.toUpperCase())}
              placeholder="请输入9位兑换码"
              maxLength={9}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-200 text-center text-lg tracking-widest uppercase mb-3"
            />
            <button
              onClick={handleRedeem}
              disabled={redeemCode.length !== 9 || redeemLoading}
              className="w-full py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-bold disabled:opacity-50"
            >
              {redeemLoading ? '兑换中...' : '立即兑换'}
            </button>
            <p className="text-xs text-slate-400 text-center mt-3">
              添加微信 <span className="text-pink-500 font-bold">{wechatId}</span>，免费获得兑换码
            </p>
          </div>

          {/* 充值次数 - 条件显示，直接展示套餐 */}
          {alipayEnabled && (
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="flex items-center space-x-3 mb-3">
                <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center text-xl">
                  💰
                </div>
                <div>
                  <h3 className="font-bold text-slate-800">充值次数</h3>
                  <p className="text-xs text-slate-400">支付宝安全支付，即时到账</p>
                </div>
              </div>
              <div className="space-y-2">
                <button
                  onClick={() => handleRecharge('pkg_12', 12, 9.9)}
                  disabled={rechargeLoading === 'pkg_12'}
                  className="w-full p-3 border-2 border-pink-200 rounded-xl flex justify-between items-center hover:border-pink-400 transition-colors disabled:opacity-50"
                >
                  <div className="text-left">
                    <div className="font-bold text-slate-800">12次额度</div>
                    <div className="text-xs text-slate-400">¥0.82/次</div>
                  </div>
                  <div className="text-lg font-black text-pink-500">
                    {rechargeLoading === 'pkg_12' ? '处理中...' : '¥9.9'}
                  </div>
                </button>

                <button
                  onClick={() => handleRecharge('pkg_30', 30, 19.9)}
                  disabled={rechargeLoading === 'pkg_30'}
                  className="w-full p-3 border-2 border-pink-400 rounded-xl flex justify-between items-center bg-pink-50 relative disabled:opacity-50"
                >
                  <span className="absolute -top-2 -right-2 bg-pink-500 text-white text-[10px] px-2 py-0.5 rounded-full">推荐</span>
                  <div className="text-left">
                    <div className="font-bold text-slate-800">30次额度</div>
                    <div className="text-xs text-slate-400">¥0.66/次</div>
                  </div>
                  <div className="text-lg font-black text-pink-500">
                    {rechargeLoading === 'pkg_30' ? '处理中...' : '¥19.9'}
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* 退出登录按钮 */}
          <button
            onClick={() => {
              logout();
              setShowMemberCenter(false);
            }}
            className="w-full py-3 bg-slate-100 text-slate-500 rounded-xl text-sm font-medium hover:bg-slate-200 transition-colors"
          >
            退出登录
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout
      title={activeModule ? (MODULES.find(m => m.id === activeModule)?.title || '倾城之鉴') : '倾城之鉴'}
      onBack={activeModule ? () => setActiveModule(null) : undefined}
    >
      {!activeModule ? (
        <div className="space-y-6">
          {/* User Info Card */}
          <div className="bg-white rounded-2xl p-4 shadow-sm flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-pink-100 rounded-full flex items-center justify-center text-lg">
                {user ? '👤' : '👋'}
              </div>
              <div>
                <div className="font-bold text-slate-800">{user ? user.nickname : '游客'}</div>
                <div className="text-xs text-pink-500">{user ? `剩 ${user.credits} 次额度` : '登录体验更多功能'}</div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {user?.is_admin && (
                <button
                  onClick={() => setShowAdmin(true)}
                  className="px-3 py-1.5 bg-slate-100 rounded-lg text-xs text-slate-600 font-medium hover:bg-slate-200"
                >
                  管理后台
                </button>
              )}
              {user && (
                <button
                  onClick={() => setShowMemberCenter(true)}
                  className="px-3 py-1.5 bg-gradient-to-r from-pink-500 to-rose-400 text-white rounded-lg text-xs font-bold hover:shadow-md transition-all"
                >
                  会员中心
                </button>
              )}
              {!user && (
                <button
                  onClick={() => setShowLoginModal(true)}
                  className="px-3 py-1.5 bg-pink-50 text-pink-500 rounded-lg text-xs font-bold hover:bg-pink-100"
                >
                  登录/注册
                </button>
              )}
            </div>
          </div>

          {showLoginModal && !user && (
            <LoginModal onClose={() => setShowLoginModal(false)} />
          )}

          {/* Welcome Card with Install Prompt */}
          <WelcomeBanner />



          {/* Module Grid */}
          <div className="grid grid-cols-2 gap-4">
            {MODULES.map((module) => (
              <button
                key={module.id}
                onClick={() => handleModuleClick(module.id)}
                className="bg-white p-5 rounded-3xl shadow-sm hover:shadow-md transition-all active:scale-95 text-left border border-white hover:border-pink-100 group"
              >
                <div className={`w-12 h-12 ${module.color} rounded-2xl flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform`}>
                  {module.icon}
                </div>
                <h3 className="font-bold text-slate-800 mb-1">{module.title}</h3>
                <p className="text-[10px] text-slate-400 leading-tight">{module.description}</p>
              </button>
            ))}
          </div>

          {/* Footer Info */}
          <div className="py-8 text-center">
            <p className="text-slate-300 text-xs">AI 赋能 · 专属定制 · 倾城之鉴</p>
          </div>
        </div>
      ) : (
        renderModuleContent()
      )}

      {/* 兑换码弹窗 */}
      {showRedeemModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-800">兑换码</h3>
              <button onClick={() => setShowRedeemModal(false)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            <input
              type="text"
              value={redeemCode}
              onChange={(e) => setRedeemCode(e.target.value.toUpperCase())}
              placeholder="请输入9位兑换码"
              maxLength={9}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-pink-200 text-center text-lg tracking-widest uppercase"
            />

            <button
              onClick={handleRedeem}
              disabled={redeemCode.length !== 9 || redeemLoading}
              className="w-full mt-4 py-3 bg-gradient-to-r from-pink-500 to-rose-400 text-white rounded-xl font-bold disabled:opacity-50"
            >
              {redeemLoading ? '兑换中...' : '立即兑换'}
            </button>

            <p className="text-xs text-slate-400 text-center mt-4">
              添加微信 <span className="text-pink-500 font-bold">{wechatId}</span>，免费获得兑换码
            </p>
          </div>
        </div>
      )}

      {/* 充值弹窗 */}
      {showRechargeModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-800">充值次数</h3>
              <button onClick={() => setShowRechargeModal(false)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <button className="w-full p-4 border-2 border-pink-200 rounded-2xl flex justify-between items-center hover:border-pink-400 transition-colors">
                <div>
                  <div className="font-bold text-slate-800">12次额度</div>
                  <div className="text-xs text-slate-400">平均 ¥0.82/次</div>
                </div>
                <div className="text-xl font-black text-pink-500">¥9.9</div>
              </button>

              <button className="w-full p-4 border-2 border-pink-400 rounded-2xl flex justify-between items-center bg-pink-50 relative">
                <span className="absolute -top-2 -right-2 bg-pink-500 text-white text-[10px] px-2 py-0.5 rounded-full">推荐</span>
                <div>
                  <div className="font-bold text-slate-800">30次额度</div>
                  <div className="text-xs text-slate-400">平均 ¥0.66/次</div>
                </div>
                <div className="text-xl font-black text-pink-500">¥19.9</div>
              </button>
            </div>

            <p className="text-xs text-slate-400 text-center mt-4">
              支付宝安全支付 · 即时到账
            </p>
          </div>
        </div>
      )}

      {/* 图片放大弹窗 */}
      {zoomedImage && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setZoomedImage(null)}
        >
          <button
            onClick={() => setZoomedImage(null)}
            className="absolute top-4 right-4 text-white/80 hover:text-white text-xl p-2 z-10"
          >
            ✕ 关闭
          </button>
          <img
            src={zoomedImage}
            alt="放大查看"
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-300"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </Layout>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
};

export default App;
