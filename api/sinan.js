export default async function handler(req, res) {
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.status(204).end();
        return;
    }

    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method Not Allowed' });
        return;
    }

    const apiKey = process.env.SINAN_API_KEY;
    if (!apiKey) {
        res.status(500).json({ error: 'Missing SINAN_API_KEY' });
        return;
    }

    let body = req.body;
    if (typeof body === 'string') {
        try {
            body = JSON.parse(body);
        } catch {
            body = {};
        }
    }

    const userText = (body && body.userText) || '';
    const productType = (body && body.productType) || '司南过堂';

    const payload = {
        model: 'deepseek-chat',
        messages: [
            {
                role: 'system',
                content: `你叫“司南”，是幸赋链数字联邦的首席导航官。
逻辑背景：对标Toptal的筛选与写字楼运营的风险对冲。
当前产品：${productType}。
交互要求：冷峻、专业、具备悲悯心。针对用户输入的300字，分析其决策可逆性，最后务必提醒扫描右侧二维码完成能量交换。`
            },
            { role: 'user', content: userText }
        ],
        stream: true
    };

    const upstream = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify(payload)
    });

    if (!upstream.ok) {
        const detail = await upstream.text();
        res.status(upstream.status).json({ error: 'Upstream Error', detail });
        return;
    }

    res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*'
    });

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder('utf-8');
    while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        res.write(decoder.decode(value, { stream: true }));
    }
    res.end();
}
