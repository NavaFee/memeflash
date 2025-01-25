// background.js
chrome.runtime.onInstalled.addListener(() => {
  console.log("Memeflash 插件已安装！");
});

// 监听来自内容脚本的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "checkAddress") {
    const address = request.address;
    const solanaRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/; // 更新后的 Solana 合约地址正则表达式

    if (solanaRegex.test(address)) {
      // 如果是有效的合约地址，发送响应
      sendResponse({
        valid: true,
        url: `https://www.gmgn.cc/kline/sol/${address}`,
      });
    } else {
      sendResponse({ valid: false });
    }
  }
});
