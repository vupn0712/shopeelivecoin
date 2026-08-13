const API_URL = "https://script.google.com/macros/s/AKfycbxhd52vK5-MQ21Xg92JYKTpx3L_wOi9DNbKXJB_UWOy_DkjUTMGRDY1TQfZiksKzqudNA/exec";
const POLL_DELAY_MS = 8000;
const COUNTDOWN_DELAY_MS = 1000;
const REQUEST_TIMEOUT_MS = 12000;

const dataList = document.getElementById("data-list");
const loading = document.getElementById("loading");
const emptyState = document.getElementById("koco");

let items = [];
let dataSignature = "";
let pollTimer;
let countdownTimer;
let requestController;

function formatCountdown(timeDifference) {
  if (timeDifference <= 0) return "Đã bắt đầu";

  const seconds = Math.floor((timeDifference / 1000) % 60);
  const minutes = Math.floor((timeDifference / (1000 * 60)) % 60);
  const hours = Math.floor((timeDifference / (1000 * 60 * 60)) % 24);
  const days = Math.floor(timeDifference / (1000 * 60 * 60 * 24));
  const parts = [];

  if (days > 0) parts.push(`${days} ngày`);
  if (hours > 0) parts.push(`${hours} giờ`);
  if (minutes > 0) parts.push(`${minutes} phút`);
  parts.push(`${seconds} giây`);

  return parts.join(" ");
}

function getSafeUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : "#";
  } catch {
    return "#";
  }
}

function createCard(item) {
  const card = document.createElement("article");
  const topRow = document.createElement("div");
  const shopName = document.createElement("div");
  const coinSection = document.createElement("div");
  const buttonSection = document.createElement("div");
  const link = document.createElement("a");
  const countdown = document.createElement("div");

  card.className = "card";
  topRow.className = "top-row";
  shopName.className = "shop-name";
  shopName.textContent = item.userName;
  coinSection.className = "coin-section";
  coinSection.textContent = item.maxcoin === 0 ? "voucher" : `${item.maxcoin}xu`;
  buttonSection.className = "button-section";
  link.href = getSafeUrl(item.sessionId);
  link.textContent = "Vào ngay";
  countdown.className = "countdown";
  countdown.dataset.startTime = String(item.startTime);

  buttonSection.append(link);
  topRow.append(shopName, coinSection, buttonSection);
  card.append(topRow, countdown);

  return { element: countdown, startTime: item.startTime, row: card };
}

function normalizeData(data) {
  if (!Array.isArray(data)) throw new Error("Dữ liệu túi quà không hợp lệ");

  return data
    .map(item => ({
      userName: String(item.userName ?? ""),
      maxcoin: Number(item.maxcoin) || 0,
      sessionId: String(item.sessionId ?? ""),
      startTime: Number(item.startTime) * 1000,
    }))
    .filter(item => item.userName && Number.isFinite(item.startTime))
    .sort((a, b) => a.startTime - b.startTime);
}

function updateEmptyState() {
  emptyState.style.display = items.length === 0 ? "block" : "none";
}

function renderData(data) {
  const nextSignature = JSON.stringify(data);
  if (nextSignature === dataSignature) return;

  const fragment = document.createDocumentFragment();
  const nextItems = data.map(item => {
    const renderedItem = createCard(item);
    fragment.append(renderedItem.row);
    return renderedItem;
  });

  dataList.replaceChildren(fragment);
  items = nextItems;
  dataSignature = nextSignature;
  updateCountdowns();
  updateEmptyState();
}

function updateCountdowns() {
  if (document.hidden) return;

  const currentTime = Date.now();
  items = items.filter(item => {
    const timeDifference = item.startTime - currentTime;
    if (timeDifference > 0) {
      item.element.textContent = formatCountdown(timeDifference);
      return true;
    }

    item.row.remove();
    return false;
  });
  updateEmptyState();
}

function schedulePoll() {
  clearTimeout(pollTimer);
  if (!document.hidden) pollTimer = setTimeout(fetchData, POLL_DELAY_MS);
}

function scheduleCountdown() {
  clearTimeout(countdownTimer);
  if (document.hidden) return;

  countdownTimer = setTimeout(() => {
    updateCountdowns();
    scheduleCountdown();
  }, COUNTDOWN_DELAY_MS);
}

async function fetchData() {
  if (document.hidden || requestController) return;

  requestController = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    requestController.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(API_URL, { signal: requestController.signal });
    if (!response.ok) throw new Error(`API trả về ${response.status}`);

    renderData(normalizeData(await response.json()));
    loading.textContent = "";
  } catch (error) {
    if (error.name !== "AbortError" || timedOut) {
      loading.textContent = "Không tải được dữ liệu. Hệ thống sẽ tự thử lại.";
      console.error("Lỗi khi lấy dữ liệu túi quà:", error);
    }
  } finally {
    clearTimeout(timeout);
    requestController = undefined;
    loading.style.display = loading.textContent ? "block" : "none";
    schedulePoll();
  }
}

document.addEventListener("visibilitychange", () => {
  clearTimeout(pollTimer);
  clearTimeout(countdownTimer);

  if (document.hidden) {
    requestController?.abort();
    return;
  }

  updateCountdowns();
  scheduleCountdown();
  fetchData();
});

scheduleCountdown();
fetchData();
