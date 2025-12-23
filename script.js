const snsThemes = {
    tiktok: {
      main: "#000000",
      card: "#111827",
      graph: "#00f2ea"
    },
    instagram: {
      main: "#e1306c",
      card: "#1f2937",
      graph: "#c13584"
    },
    youtube: {
      main: "#ff0000",
      card: "#1f2937",
      graph: "#ff0000"
    }
  };
  
  



let chartInstance = null;



// 今選択されているSNS
let currentSNS = "tiktok";

// 今日の日付を表示
const dateEl = document.getElementById("date");
dateEl.textContent =
  "📅 " + new Date().toLocaleDateString("ja-JP");

// localStorageのキーをSNSごとに分ける
function getStorageKey() {
  return `followers_${currentSNS}`;
}

// データ読み込み
function loadData() {
    const data =
      JSON.parse(localStorage.getItem(getStorageKey())) || [];
  
    renderHistory(data);
    renderChart(data); // ← 追加
  }
  

// 履歴表示
function renderHistory(data) {
    const history = document.getElementById("history");
    history.innerHTML = "";
  
    data.forEach((item, index) => {
      const li = document.createElement("li");
  
      const sign =
        item.diff > 0 ? `(+${item.diff})`
        : item.diff < 0 ? `(${item.diff})`
        : "(±0)";
  
      const text = document.createElement("span");
      text.textContent =
      `${item.date} ${item.time || ""}：${item.value} ${sign}`;

  
      const delBtn = document.createElement("button");
      delBtn.textContent = "x";
      delBtn.style.marginLeft = "10px";
  
      delBtn.onclick = () => {
        deleteData(index);
      };
  
      li.appendChild(text);
      li.appendChild(delBtn);
      history.appendChild(li);
    });
  }
  
  

// 初期表示（TikTok）
function changeSNS(sns) {
    currentSNS = sns;
  
    // 表示中SNS名
    document.getElementById("currentSNS").textContent =
      "📱 " + sns.toUpperCase();
  
    // 前日比リセット
    document.getElementById("diff").textContent = "";
  
    // ▼ タブの active 切り替え
    document
      .querySelectorAll(".tabs button")
      .forEach(btn => btn.classList.remove("active"));
  
    document
      .getElementById(`tab-${sns}`)
      ?.classList.add("active");
  
    // ▼ テーマカラー変更
    const theme = snsThemes[sns];
    document.documentElement.style.setProperty(
      "--main-color",
      theme.main
    );
    document.documentElement.style.setProperty(
      "--card-color",
      theme.card
    );
  
    loadData();
  }
  

  


// 保存処理
function save() {
    const input = document.getElementById("followers");
    const value = Number(input.value);
  
    if (!value) return;
  
    let data =
      JSON.parse(localStorage.getItem(getStorageKey())) || [];
  
    const today = new Date().toLocaleDateString("ja-JP");

    const nowTime = new Date().toLocaleTimeString("ja-JP", {
        hour: "2-digit",
        minute: "2-digit"
      });
      
  
    const todayIndex = data.findIndex(d => d.date === today);
  
    let diff = 0;
  
    if (todayIndex !== -1) {
      // 今日の分を上書き
      const prev = data[todayIndex - 1];
      diff = prev ? value - prev.value : 0;
  
      data[todayIndex].value = value;
      data[todayIndex].diff = diff;
      data[todayIndex].time = nowTime;

    } else {
      // 新規追加
      const last = data[data.length - 1];
      diff = last ? value - last.value : 0;
  
      data.push({
        date: today,
        time: nowTime,
        value: value,
        diff: diff
      });
      
    }
  
    localStorage.setItem(getStorageKey(), JSON.stringify(data));
  
    document.getElementById("diff").textContent =
      `昨日比：${diff >= 0 ? "+" : ""}${diff} 人`;
  
    input.value = "";
    renderHistory(data);
renderChart(data);

  }

  function deleteData(index) {
    let data =
      JSON.parse(localStorage.getItem(getStorageKey())) || [];
  
    data.splice(index, 1);
  
    // 削除後、diffを再計算
    data.forEach((item, i) => {
      if (i === 0) {
        item.diff = 0;
      } else {
        item.diff = item.value - data[i - 1].value;
      }
    });
  
    localStorage.setItem(getStorageKey(), JSON.stringify(data));
    renderHistory(data);
renderChart(data);

  }

  function renderChart(data) {
    const ctx = document.getElementById("chart").getContext("2d");
  
    if (chartInstance) {
      chartInstance.destroy();
    }
  
    const labels = data.map(item =>
      item.time ? `${item.date} ${item.time}` : item.date
    );
  
    const values = data.map(item => item.value);
    const theme = snsThemes[currentSNS];
  
    chartInstance = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "フォロワー数",
            data: values,
            tension: 0.3,
            fill: false,
            borderColor: theme.graph,
            backgroundColor: theme.graph,
            pointRadius: 5,
            pointHoverRadius: 8,
            borderWidth: 3
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            labels: {
              color: "#fff"
            }
          }
        },
        scales: {
          x: {
            ticks: { color: "#9ca3af" }
          },
          y: {
            ticks: { color: "#9ca3af" }
          }
        }
      }
    });
  }
  

  // 初期表示
changeSNS("tiktok");

  
  
  
  
  
