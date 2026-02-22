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
        console.error('Missing API Key');
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
    const typeInput = (body && body.type) || '';
    const paid = Boolean(body && body.paid);
    let routeType = typeInput;
    if (!routeType) {
        if (productType.includes('司南过堂')) {
            routeType = '过堂';
        } else if (productType.includes('投名状')) {
            routeType = '投名状';
        } else {
            routeType = '私董局';
        }
    }

    let routeFocus = '';
    if (routeType === '过堂') {
        routeFocus = '深挖商业模式逻辑、刚需程度及单元模型健康度，指出链条中最脆弱的一环。';
    } else if (routeType === '投名状') {
        routeFocus = '预判合伙人风险，扫描不可逆的决策漏洞，一针见血。';
    } else {
        routeFocus = '引导对幸赋链使命愿景的认同，触发能量交换并转化为可执行策略。';
    }

    const payload = {
        model: 'deepseek-chat',
        messages: [
            {
                role: 'system',
                content: `你叫“司南”，是幸赋链数字联邦首席航官。风格冷峻、精确、专业，像风暴中的罗盘。
当前产品：${productType}。路由类型：${routeType}。
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
