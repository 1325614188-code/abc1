
import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * 配置管理 API
 * 用于获取和更新系统配置（微信号、支付宝参数等）
 */

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS 头
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
        // GET: 获取配置
        if (req.method === 'GET') {
            const { data: configs } = await supabase
                .from('payment_config')
                .select('*');

            // 转换为键值对象
            const configMap: Record<string, { value: string; is_enabled: boolean }> = {};
            configs?.forEach(c => {
                configMap[c.key] = { value: c.value || '', is_enabled: c.is_enabled ?? true };
            });

            // NOTE: 调试模式 - 不脱敏，显示完整密钥值
            // 生产环境建议恢复脱敏处理
            // const sensitiveKeys = ['alipay_private_key', 'alipay_public_key'];
            // sensitiveKeys.forEach(key => {
            //     if (configMap[key]?.value) {
            //         const val = configMap[key].value;
            //         configMap[key].value = val.length > 4 ? '****' + val.slice(-4) : '****';
            //     }
            // });

            return res.status(200).json({ configs: configMap });
        }

        // PUT: 更新配置（需要管理员权限，此处简化处理）
        if (req.method === 'PUT') {
            const { key, value, is_enabled, user_id } = req.body || {};

            if (!key) {
                return res.status(400).json({ error: '缺少配置项 key' });
            }

            // 验证是否为管理员
            if (user_id) {
                const { data: userData } = await supabase
                    .from('users')
                    .select('is_admin')
                    .eq('id', user_id)
                    .single();

                if (!userData?.is_admin) {
                    return res.status(403).json({ error: '无权限修改配置' });
                }
            }

            // 更新或插入配置
            const updateData: Record<string, any> = {};
            if (value !== undefined) updateData.value = value;
            if (is_enabled !== undefined) updateData.is_enabled = is_enabled;

            const { error } = await supabase
                .from('payment_config')
                .upsert({ key, ...updateData }, { onConflict: 'key' });

            if (error) {
                console.error('Config update error:', error);
                return res.status(500).json({ error: '更新失败' });
            }

            return res.status(200).json({ success: true });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (err: any) {
        console.error('Config API Error:', err);
        return res.status(500).json({ error: '服务器错误' });
    }
}
