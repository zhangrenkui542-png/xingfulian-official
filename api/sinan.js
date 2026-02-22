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
    const modeInput = (body && body.mode) || '';
    const paid = Boolean(body && body.paid);
    let routeMode = modeInput;
    if (!routeMode) {
        if (productType.includes('司南过堂')) {
            routeMode = 'A';
        } else if (productType.includes('投名状')) {
            routeMode = 'B';
        } else {
            routeMode = 'C';
        }
    }
    if (paid) {
        routeMode = 'C';
    }

    let routeFocus = '';
    if (routeMode === 'A') {
        routeFocus = '重点评估商业模式是否自洽，指出逻辑链条中最脆弱的一环。';
    } else if (routeMode === 'B') {
        routeFocus = '针对用户决策中的不可逆性进行风险预警，语言一针见血。';
    } else {
        routeFocus = '将密报内容转化为可执行的策略建议，引导完成认知跃迁。';
    }

    const payload = {
        model: 'deepseek-chat',
        messages: [
            {
                role: 'system',
                content: `你叫“司南”，是幸赋链数字联邦首席航官。风格冷峻、精确、专业，像风暴中的罗盘。
当前产品：${productType}。诊断模式：${routeMode}。
任务焦点：${routeFocus}
第一句话必须回馈：“已接收密报：[用一句话提炼用户核心痛点]”。
绝对禁止出现“请先确认支付”。`
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
