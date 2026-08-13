const API_URL = "https://shopeelivecoinbackend.vercel.app/get_live_session";
const REFRESH_DELAY_MS = 300000;
const SEARCH_DELAY_MS = 180;
const REQUEST_TIMEOUT_MS = 12000;
const RELOAD_COOLDOWN_MS = 5000;

const grid = document.getElementById("grid");
const loading = document.getElementById("loading");
const search = document.getElementById("search");
const clearBtn = document.getElementById("clear");
const reloadBtn = document.getElementById("reloadBtn");

const alias = {
  bịp: "siêu sao",
  xe: "accesstradevn",
};

let liveData = [];
let dataSignature = "";
let renderedSignature = "";
let refreshTimer;
let searchTimer;
let requestController;
let lastReload = 0;

function formatCoin(value) {
  if (!value) return 0;
  if (value < 1000) return value;

  const thousands = Math.floor(value / 1000);
  const remainder = Math.floor((value % 1000) / 100);
  return remainder ? `${thousands}k${remainder}` : `${thousands}k`;
}

function normalizeQuery(value) {
  const query = value.trim().toLocaleLowerCase("vi");
  return alias[query] ?? query;
}

function normalizeData(data) {
  if (!Array.isArray(data)) throw new Error("Dữ liệu live không hợp lệ");

  return data
    .map(item => ({
      avatar: String(item.avatar ?? "").replace(/[^a-zA-Z0-9_-]/g, ""),
      coin: item.coin == null ? null : Number(item.coin),
      sessionId: String(item.session_id ?? ""),
      username: String(item.username ?? ""),
      normalizedName: String(item.username ?? "").toLocaleLowerCase("vi"),
    }))
    .filter(item => item.sessionId && item.username)
    .sort((a, b) => {
      const coinDifference = (b.coin ?? -1) - (a.coin ?? -1);
      return coinDifference || a.username.localeCompare(b.username, "vi");
    });
}

function createLiveCard(item) {
  const card = document.createElement("article");
  const link = document.createElement("a");
  const avatarBox = document.createElement("div");
  const avatar = document.createElement("img");
  const liveBadge = document.createElement("div");
  const username = document.createElement("div");

  card.className = "item";
  link.href = `https://s.shopee.vn/an_redir?affiliate_id=17396220028&sub_id=---livex-&origin_link=${encodeURIComponent(`https://live.shopee.vn/share?from=live&session=${item.sessionId}`)}`;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.setAttribute("aria-label", `Xem live của ${item.username}`);
  avatarBox.className = "avatar-box";
  avatar.className = "avatar";
  avatar.src = `https://cf.shopee.vn/file/${item.avatar}`;
  avatar.alt = "";
  avatar.width = 72;
  avatar.height = 72;
  avatar.loading = "lazy";
  avatar.decoding = "async";
  liveBadge.className = "live";
  liveBadge.textContent = "LIVE";
  username.className = "username";
  username.textContent = item.username;

  avatarBox.append(avatar, liveBadge);
  if (item.coin != null) {
    const coinBadge = document.createElement("div");
    coinBadge.className = "coin-badge";
    coinBadge.textContent = `${formatCoin(item.coin)} xu`;
    avatarBox.append(coinBadge);
  }

  link.append(avatarBox);
  card.append(link, username);
  return card;
}

function render(list) {
  const nextSignature = list.map(item => `${item.sessionId}:${item.coin}`).join("|");
  if (nextSignature === renderedSignature) return;

  const fragment = document.createDocumentFragment();
  list.forEach(item => fragment.append(createLiveCard(item)));
  grid.replaceChildren(fragment);
  renderedSignature = nextSignature;
}

function renderSearchResults() {
  const query = normalizeQuery(search.value);
  clearBtn.style.display = query ? "block" : "none";
  render(query ? liveData.filter(item => item.normalizedName.includes(query)) : liveData);
}

function scheduleRefresh() {
  clearTimeout(refreshTimer);
  if (!document.hidden) refreshTimer = setTimeout(loadData, REFRESH_DELAY_MS);
}

async function loadData() {
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

    const nextData = normalizeData(await response.json());
    const nextSignature = JSON.stringify(nextData);
    if (nextSignature !== dataSignature) {
      liveData = nextData;
      dataSignature = nextSignature;
      renderedSignature = "";
    }
    renderSearchResults();
    loading.hidden = true;
  } catch (error) {
    if (error.name !== "AbortError" || timedOut) {
      loading.hidden = false;
      loading.textContent = "Không tải được dữ liệu. Nhấn ⟳ để thử lại.";
      console.error("Lỗi khi lấy dữ liệu live:", error);
    }
  } finally {
    clearTimeout(timeout);
    requestController = undefined;
    scheduleRefresh();
  }
}

search.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(renderSearchResults, SEARCH_DELAY_MS);
});

clearBtn.addEventListener("click", () => {
  clearTimeout(searchTimer);
  search.value = "";
  renderSearchResults();
  search.focus();
});

document.querySelectorAll(".suggest-btn").forEach(button => {
  button.addEventListener("click", () => {
    clearTimeout(searchTimer);
    search.value = button.dataset.key;
    renderSearchResults();
  });
});

reloadBtn.addEventListener("click", async () => {
  const now = Date.now();
  if (now - lastReload < RELOAD_COOLDOWN_MS || requestController) return;

  lastReload = now;
  reloadBtn.classList.add("disabled");
  reloadBtn.style.transform = "rotate(360deg)";
  await loadData();

  setTimeout(() => {
    reloadBtn.classList.remove("disabled");
    reloadBtn.style.transform = "rotate(0deg)";
  }, RELOAD_COOLDOWN_MS);
});

document.addEventListener("visibilitychange", () => {
  clearTimeout(refreshTimer);
  clearTimeout(searchTimer);

  if (document.hidden) {
    requestController?.abort();
    return;
  }

  renderSearchResults();
  loadData();
});

loadData();
