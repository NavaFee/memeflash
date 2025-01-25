// content.js
document.addEventListener("mouseup", async () => {
  const selectedText = window.getSelection().toString().trim();
  console.log("选中的文本:", selectedText);

  if (selectedText) {
    chrome.runtime.sendMessage(
      { action: "checkAddress", address: selectedText },
      (response) => {
        console.log("收到后台响应:", response);

        if (response && response.valid) {
          // 移除可能存在的旧容器
          const existingContainer = document.querySelector(
            ".memeflash-container"
          );
          if (existingContainer) {
            existingContainer.remove();
          }

          // 创建一个弹窗容器
          const container = document.createElement("div");
          container.className = "memeflash-container";
          container.style.cssText = `
            position: fixed;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            z-index: 10000;
            background: black;
            box-shadow: 0 4px 20px rgba(0,0,0,0.15);
            border-radius: 12px;
            padding: 4px;
            display: flex;
            gap: 4px;
          `;

          // 创建左侧K线图容器
          const klineContainer = document.createElement("div");
          klineContainer.style.cssText = `
            width: 960px;
            height: 530px;
          `;

          // 创建K线图iframe
          const klineIframe = document.createElement("iframe");
          klineIframe.style.cssText = `
            width: 100%;
            height: 100%;
            border: none;
            border-radius: 12px;
            background-color: black;
          `;
          klineIframe.src = response.url;

          // 创建右侧DEX Widget容器
          const dexContainer = document.createElement("div");
          dexContainer.style.cssText = `
            width: 450px;
            height: 530px;
            background: black;

          `;

          // 创建DEX Widget iframe
          const dexIframe = document.createElement("iframe");
          dexIframe.style.cssText = `
            width: 100%;
            height: 100%;
            border: none;
            border-radius: 12px;
            background-color: black;

          `;
          dexIframe.src = `http://localhost:3000?token=${selectedText}`;
          // 创建关闭按钮
          const closeButton = document.createElement("button");
          closeButton.innerText = "×";
          closeButton.style.cssText = `
            position: absolute;
            right: 12px;
            top: 12px;
            width: 24px;
            height: 24px;
            border: none;
            background: rgba(0, 0, 0, 0.5);
            color: white;
            border-radius: 12px;
            cursor: pointer;
            font-size: 16px;
            line-height: 24px;
            text-align: center;
            z-index: 10001;
          `;
          closeButton.onclick = () => {
            container.remove();
            overlay.remove();
          };

          // 组装容器
          klineContainer.appendChild(klineIframe);
          dexContainer.appendChild(dexIframe);
          container.appendChild(klineContainer);
          container.appendChild(dexContainer);
          container.appendChild(closeButton);
          document.body.appendChild(container);

          // 添加半透明背景遮罩
          const overlay = document.createElement("div");
          overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.3);
            z-index: 9999;
          `;
          overlay.onclick = () => {
            container.remove();
            overlay.remove();
          };
          document.body.appendChild(overlay);

          // ESC 键关闭
          const handleEscKey = (event) => {
            if (event.key === "Escape") {
              container.remove();
              overlay.remove();
              document.removeEventListener("keydown", handleEscKey);
            }
          };
          document.addEventListener("keydown", handleEscKey);
        }
      }
    );
  }
});

// 移除之前的悬停效果样式
const style = document.createElement("style");
style.textContent = `
  .memeflash-container {
    transition: opacity 0.2s ease-in-out;
  }
`;
document.head.appendChild(style);
