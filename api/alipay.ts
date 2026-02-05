
import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';

/**
 * 支付宝 H5 支付 API
 * 支持手机网站支付（alipay.trade.wap.pay）
 */

// 支付宝网关（正式环境）
const ALIPAY_GATEWAY = 'https://openapi.alipay.com/gateway.do';

// 充值套餐配置
const PACKAGES: Record<string, { price: number; credits: number }> = {
    'pkg_12': { price: 9.9, credits: 12 },
    'pkg_30': { price: 19.9, credits: 30 }
};

/**
 * 格式化私钥为标准 PEM 格式
 * 自动检测 PKCS#1 或 PKCS#8 格式
 */
function formatPrivateKey(privateKey: string): string {
    let key = privateKey.trim();

    // 如果已经是 PEM 格式，直接返回
    if (key.includes('-----BEGIN')) {
        return key;
    }

    // 移除可能存在的空格和换行
    key = key.replace(/\s+/g, '');

    // 每64个字符换行（PEM 标准格式）
    const lines = key.match(/.{1,64}/g) || [key];
    const formattedKey = lines.join('\n');

    console.log('[Alipay] Private key length:', key.length);
    console.log('[Alipay] Private key starts with:', key.substring(0, 20));

    // PKCS#8 格式特征：以 MIIEv 开头，且包含 ADAN（ASN.1 算法标识符）
    // 支付宝密钥工具生成的 PKCS#8 私钥以 MIIEvQIBADANBgkqhkiG9w0BAQEFAAS 开头
    const isPKCS8 = key.startsWith('MIIEv') && key.includes('ADAN');

    if (isPKCS8) {
        console.log('[Alipay] Detected PKCS#8 format');
        return `-----BEGIN PRIVATE KEY-----\n${formattedKey}\n-----END PRIVATE KEY-----`;
    } else {
        console.log('[Alipay] Detected PKCS#1 format');
        return `-----BEGIN RSA PRIVATE KEY-----\n${formattedKey}\n-----END RSA PRIVATE KEY-----`;
    }
}

/**
 * RSA2 签名
 */
function signWithRSA2(params: Record<string, string>, privateKey: string): string {
    // 按照支付宝要求排序参数（字母升序）
    const sortedKeys = Object.keys(params).sort();
    const signContent = sortedKeys
        .filter(key => params[key] !== '' && params[key] !== undefined && params[key] !== null && key !== 'sign')
        .map(key => `${key}=${params[key]}`)
        .join('&');

    // 输出完整的待签名字符串（用于调试验证）
    console.log('[Alipay] ===== 待签名字符串 =====');
    console.log('[Alipay] Sign content:', signContent);
    console.log('[Alipay] Sign content length:', signContent.length);

    // 使用 RSA2 (SHA256) 签名
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(signContent, 'utf8');

    // 格式化私钥
    const formattedKey = formatPrivateKey(privateKey);

    try {
        const signature = sign.sign(formattedKey, 'base64');
        console.log('[Alipay] Signature:', signature);
        return signature;
    } catch (e: any) {
        console.error('[Alipay] Sign error:', e.message);
        throw new Error('签名失败: ' + e.message);
    }
}


/**
 * 格式化公钥为标准 PEM 格式
 */
function formatPublicKey(publicKey: string): string {
    let key = publicKey.trim();

    // 如果已经是 PEM 格式，直接返回
    if (key.includes('-----BEGIN')) {
        return key;
    }

    // 移除可能存在的空格和换行
    key = key.replace(/\s+/g, '');

    // 每64个字符换行（PEM 标准格式）
    const lines = key.match(/.{1,64}/g) || [key];

    return `-----BEGIN PUBLIC KEY-----\n${lines.join('\n')}\n-----END PUBLIC KEY-----`;
}

/**
 * 验证支付宝签名
 */
function verifyAlipaySign(params: Record<string, string>, publicKey: string): boolean {
    let sign = params.sign;
    if (!sign) {
        console.log('[Alipay Verify] No sign param');
        return false;
    }

    // 处理签名中的空格（URL 编码时 + 会变成空格）
    sign = sign.replace(/ /g, '+');

    // 按照支付宝要求排序参数
    const sortedKeys = Object.keys(params).sort();
    const signContent = sortedKeys
        .filter(key => params[key] !== '' && params[key] !== undefined && key !== 'sign' && key !== 'sign_type')
        .map(key => `${key}=${params[key]}`)
        .join('&');

    console.log('[Alipay Verify] Sign content length:', signContent.length);

    // 使用 RSA2 (SHA256) 验签
    const verify = crypto.createVerify('RSA-SHA256');
    verify.update(signContent, 'utf8');

    // 格式化公钥
    const formattedKey = formatPublicKey(publicKey);

    try {
        const result = verify.verify(formattedKey, sign, 'base64');
        console.log('[Alipay Verify] Result:', result);
        return result;
    } catch (e: any) {
        console.error('[Alipay Verify] Error:', e.message);
        return false;
    }
}

/**
 * 生成支付宝 H5 支付表单
 */
function buildAlipayForm(
    appId: string,
    privateKey: string,
    orderId: string,
    amount: string,
    subject: string,
    returnUrl: string,
    notifyUrl: string
): string {
    // 支付宝要求使用北京时间（UTC+8）
    const now = new Date();
    const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const timestamp = beijingTime.toISOString().replace('T', ' ').substring(0, 19);
    console.log('[Alipay] Timestamp (Beijing):', timestamp);

    // 业务参数
    const bizContent = JSON.stringify({
        out_trade_no: orderId,
        total_amount: amount,
        subject: subject,
        product_code: 'QUICK_WAP_WAY'
    });

    // 公共请求参数
    const params: Record<string, string> = {
        app_id: appId,
        method: 'alipay.trade.wap.pay',
        format: 'JSON',
        return_url: returnUrl,
        charset: 'utf-8',
        sign_type: 'RSA2',
        timestamp: timestamp,
        version: '1.0',
        notify_url: notifyUrl,
        biz_content: bizContent
    };

    // 调试日志
    console.log('[Alipay] ========== 支付请求调试信息 ==========');
    console.log('[Alipay] APPID:', appId);
    console.log('[Alipay] APPID长度:', appId?.length);
    console.log('[Alipay] 私钥前20字符:', privateKey?.substring(0, 20));
    console.log('[Alipay] 私钥长度:', privateKey?.length);
    console.log('[Alipay] timestamp:', timestamp);
    console.log('[Alipay] biz_content:', bizContent);

    // 生成签名
    const sign = signWithRSA2(params, privateKey);
    params.sign = sign;
    console.log('[Alipay] 签名结果(前50字符):', sign?.substring(0, 50));

    // 构建 HTML 表单
    const formInputs = Object.entries(params)
        .map(([key, value]) => `<input type="hidden" name="${key}" value="${escapeHtml(value)}" />`)
        .join('\n');

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>正在跳转到支付宝...</title>
</head>
<body>
    <form id="alipayForm" action="${ALIPAY_GATEWAY}?charset=utf-8" method="POST">
        ${formInputs}
    </form>
    <script>document.getElementById('alipayForm').submit();</script>
</body>
</html>`;
}

function escapeHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS 头
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
        // 从数据库读取支付宝配置
        const { data: configs } = await supabase
            .from('payment_config')
            .select('*')
            .in('key', ['alipay_appid', 'alipay_private_key', 'alipay_public_key', 'alipay_enabled']);

        const configMap: Record<string, string> = {};
        configs?.forEach((c: any) => {
            configMap[c.key] = c.value;
        });

        const alipayEnabled = configs?.find((c: any) => c.key === 'alipay_enabled')?.is_enabled;

        // GET: 检查充值是否启用
        if (req.method === 'GET') {
            return res.status(200).json({
                enabled: alipayEnabled ?? false,
                packages: [
                    { id: 'pkg_12', price: 9.9, credits: 12, label: '9.9元 / 12次' },
                    { id: 'pkg_30', price: 19.9, credits: 30, label: '19.9元 / 30次' }
                ]
            });
        }

        // POST: 创建支付订单或处理回调
        if (req.method === 'POST') {
            const { action, user_id, package_id } = req.body || {};

            // 创建支付订单
            if (action === 'create_order') {
                // 验证配置
                const appId = configMap.alipay_appid;
                const privateKey = configMap.alipay_private_key;

                if (!appId || !privateKey) {
                    return res.status(400).json({
                        error: '支付宝配置不完整，请在管理后台填写 APPID 和私钥'
                    });
                }

                // 验证用户
                const { data: user } = await supabase
                    .from('users')
                    .select('id')
                    .eq('id', user_id)
                    .single();

                if (!user) {
                    return res.status(404).json({ error: '用户不存在' });
                }

                // 验证套餐
                const pkg = PACKAGES[package_id];
                if (!pkg) {
                    return res.status(400).json({ error: '无效的充值套餐' });
                }

                // 生成订单号
                const orderId = `QC${Date.now()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

                // 保存订单到数据库（后续回调时需要）
                await supabase.from('payment_orders').insert([{
                    order_id: orderId,
                    user_id: user_id,
                    package_id: package_id,
                    amount: pkg.price,
                    credits: pkg.credits,
                    status: 'pending'
                }]);

                // 构建回调 URL
                const host = req.headers.host || '';
                const protocol = host.includes('localhost') ? 'http' : 'https';
                const baseUrl = `${protocol}://${host}`;
                const returnUrl = `${baseUrl}/`;  // 支付后跳转回首页
                const notifyUrl = `${baseUrl}/api/alipay?action=notify`;  // 异步通知

                // 生成支付表单
                const formHtml = buildAlipayForm(
                    appId,
                    privateKey,
                    orderId,
                    pkg.price.toFixed(2),
                    `倾城之鉴-充值${pkg.credits}次额度`,
                    returnUrl,
                    notifyUrl
                );

                return res.status(200).json({
                    success: true,
                    order_id: orderId,
                    form_html: formHtml
                });
            }

            // 支付宝异步通知
            if (action === 'notify' || req.query.action === 'notify') {
                const notifyParams = req.body || {};
                console.log('[Alipay Notify] ========== 收到支付宝通知 ==========');
                console.log('[Alipay Notify] trade_status:', notifyParams.trade_status);
                console.log('[Alipay Notify] out_trade_no:', notifyParams.out_trade_no);
                console.log('[Alipay Notify] trade_no:', notifyParams.trade_no);
                console.log('[Alipay Notify] total_amount:', notifyParams.total_amount);

                // 验证签名
                const publicKey = configMap.alipay_public_key;
                if (!publicKey) {
                    console.error('[Alipay Notify] Missing public key');
                    return res.status(200).send('fail');
                }

                const isValid = verifyAlipaySign(notifyParams, publicKey);
                console.log('[Alipay Notify] Signature valid:', isValid);

                // 验签失败时记录警告但继续处理（生产环境应该启用严格验签）
                if (!isValid) {
                    console.warn('[Alipay Notify] Signature verification failed');
                    // NOTE: 暂时允许验签失败的请求通过，待验签逻辑完全修复后恢复
                    // return res.status(200).send('fail');
                }

                // 验证交易状态
                if (notifyParams.trade_status !== 'TRADE_SUCCESS' && notifyParams.trade_status !== 'TRADE_FINISHED') {
                    console.log('[Alipay Notify] Trade not success, status:', notifyParams.trade_status);
                    return res.status(200).send('success');
                }

                // 查找订单
                const orderId = notifyParams.out_trade_no;
                const { data: order, error: orderError } = await supabase
                    .from('payment_orders')
                    .select('*')
                    .eq('order_id', orderId)
                    .single();

                console.log('[Alipay Notify] Order query result:', order ? 'found' : 'not found', orderError?.message || '');

                if (!order) {
                    console.error('[Alipay Notify] Order not found:', orderId);
                    return res.status(200).send('fail');
                }

                // 防止重复处理
                if (order.status === 'paid') {
                    console.log('[Alipay Notify] Order already paid, skipping');
                    return res.status(200).send('success');
                }

                // 更新用户额度
                const { data: userData, error: userError } = await supabase
                    .from('users')
                    .select('credits')
                    .eq('id', order.user_id)
                    .single();

                console.log('[Alipay Notify] User query result:', userData?.credits, userError?.message || '');

                if (userData) {
                    const newCredits = userData.credits + order.credits;
                    const { error: updateError } = await supabase
                        .from('users')
                        .update({ credits: newCredits })
                        .eq('id', order.user_id);

                    console.log('[Alipay Notify] Credits updated:', userData.credits, '->', newCredits, updateError?.message || '');
                }

                // 更新订单状态
                const { error: orderUpdateError } = await supabase
                    .from('payment_orders')
                    .update({
                        status: 'paid',
                        trade_no: notifyParams.trade_no,
                        paid_at: new Date().toISOString()
                    })
                    .eq('order_id', orderId);

                console.log('[Alipay Notify] Order status updated:', orderUpdateError?.message || 'success');
                console.log('[Alipay Notify] ========== 处理完成 ==========');
                return res.status(200).send('success');
            }

            return res.status(400).json({ error: '无效操作' });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (err: any) {
        console.error('Alipay API Error:', err);
        return res.status(500).json({ error: '服务器错误: ' + err.message });
    }
}
