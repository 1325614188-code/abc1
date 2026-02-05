
import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
    }

    const { code, user_id, device_id } = req.body || {};

    if (!code || !user_id || !device_id) {
        return res.status(400).json({ error: 'Missing parameters' });
    }

    try {
        const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
        const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
        const supabase = createClient(supabaseUrl, supabaseKey);

        // 1. Validate Code Format
        // Rule: "当天日期后两位 + 任意两个大写字母 + 13天后的日期的后两位 + 任意三位大写字母"
        // E.g. Today is 1st (01). 1+13 = 14. Code: 01AB14CDE
        if (code.length !== 9) {
            return res.status(400).json({ error: '无效的兑换码格式' });
        }

        const now = new Date();
        const future = new Date();
        future.setDate(now.getDate() + 13);

        const ddNow = String(now.getDate()).padStart(2, '0');
        const ddFuture = String(future.getDate()).padStart(2, '0');

        const inputDdNow = code.substring(0, 2);
        const inputDdFuture = code.substring(4, 6);
        const letters1 = code.substring(2, 4);
        const letters2 = code.substring(6, 9);

        const isLettersValid = (s: string) => /^[A-Z]+$/.test(s);

        if (inputDdNow !== ddNow || inputDdFuture !== ddFuture || !isLettersValid(letters1) || !isLettersValid(letters2)) {
            return res.status(400).json({ error: '兑换码无效或已过期' });
        }

        // 2. Check Global Uniqueness
        const { data: usedCode } = await supabase
            .from('used_redemption_codes')
            .select('*')
            .eq('code', code)
            .single();

        if (usedCode) {
            return res.status(400).json({ error: '此兑换码已被使用' });
        }

        // 3. Check Monthly Device Limit
        const monthStr = now.toISOString().substring(0, 7); // YYYY-MM
        const { data: existingLog } = await supabase
            .from('redemption_logs')
            .select('*')
            .eq('device_id', device_id)
            .eq('redeemed_month', monthStr)
            .single();

        if (existingLog) {
            return res.status(400).json({ error: '本设备本月已领取过奖励' });
        }

        // 4. Grant Credits
        // First, check user existence
        const { data: user } = await supabase
            .from('users')
            .select('credits')
            .eq('id', user_id)
            .single();

        if (!user) {
            return res.status(404).json({ error: '用户不存在' });
        }

        // Atomicish update
        const { error: updateError } = await supabase
            .from('users')
            .update({ credits: (user.credits || 0) + 5 })
            .eq('id', user_id);

        if (updateError) throw updateError;

        // 5. Log usage
        await supabase.from('used_redemption_codes').insert([{ code, user_id }]);
        await supabase.from('redemption_logs').insert([{
            user_id,
            device_id,
            code,
            redeemed_month: monthStr
        }]);

        return res.status(200).json({ success: true, credits: (user.credits || 0) + 5 });

    } catch (err: any) {
        console.error('Redeem Error:', err);
        return res.status(500).json({ error: '服务器错误' });
    }
}
