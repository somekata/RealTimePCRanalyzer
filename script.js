let charts = [];

// filename -> { parsed, dataset }
const store = new Map();

const fileInput = document.getElementById("fileInput");
const fileSelect = document.getElementById("fileSelect");
const statusEl = document.getElementById("status");

// ----------- File Input Handler (Multi) ----------
fileInput.addEventListener("change", async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    statusEl.textContent = `読み込み中...（${files.length}件）`;
    store.clear();

    // まとめて読む
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        try {
            const text = await file.text();
            const parsed = parseCSV(text);

            // 必須セクションが無いなどのケースは弾く（軽くガード）
            if (!parsed.raw || !parsed.corrected) {
                throw new Error("Raw Data / Corrected Data セクションが見つかりませんでした");
            }

            const dataset = compute(parsed);
            store.set(file.name, { parsed, dataset });
        } catch (err) {
            console.error(err);
            // 1つ壊れてても他は読ませる
            statusEl.textContent = `⚠ 一部読み込み失敗: ${file.name}`;
        }
    }

    if (store.size === 0) {
        statusEl.textContent = "❌ 読み込みできるCSVがありませんでした";
        fileSelect.disabled = true;
        fileSelect.innerHTML = `<option value="">（未読み込み）</option>`;
        return;
    }

    buildFileDropdown([...store.keys()]);
    fileSelect.disabled = false;

    // 先頭を表示
    const first = store.keys().next().value;
    fileSelect.value = first;
    showByFilename(first);

    statusEl.textContent = `✔ Completed（${store.size}件 読み込み）`;
});

// ----------- Dropdown Handler ----------
fileSelect.addEventListener("change", () => {
    const name = fileSelect.value;
    if (!name) return;
    showByFilename(name);
});

function buildFileDropdown(names) {
    // 表示を安定させたいならソート
    names.sort((a, b) => a.localeCompare(b, "ja"));

    fileSelect.innerHTML = names
        .map(n => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`)
        .join("");
}

function showByFilename(filename) {
    const item = store.get(filename);
    if (!item) return;

    const { parsed, dataset } = item;

    drawAll(dataset);
    renderTable(dataset);
    renderMeta(parsed.meta);

    // 画面上に「今どれ表示してるか」軽く出す（邪魔なら消してOK）
    statusEl.textContent = `表示中：${filename}`;
}

// ----------- CSV Parsing -----------

function parseCSV(text) {
    const lines = text.split(/\r?\n/).map(x => x.trim());

    const meta = {};
    lines.forEach(l => {
        if (l.includes(",") && !l.match(/^\d/)) {
            const [k, v] = l.split(",");
            if (k && v) meta[k.trim()] = v.trim();
        }
    });

    return {
        meta,
        corrected: parseSection(lines, "Corrected Data"),
        raw: parseSection(lines, "Raw Data")
    };
}

function parseSection(lines, name) {
    const idx = lines.findIndex(l => l === name);
    if (idx === -1) return null;

    const block = [];
    for (let i = idx + 1; i < lines.length; i++) {
        if (/^\*{3}/.test(lines[i])) break;
        if (lines[i]) block.push(lines[i]);
    }

    if (block.length === 0) return null;

    const cycles = block[0].split(",").slice(1).map(Number);

    return {
        cycles,
        series: block.slice(1).map(row => {
            const p = row.split(",");
            return { name: p[0], values: p.slice(1).map(Number) };
        })
    };
}

// ----------- Data Processing -----------

function compute({ raw, corrected }) {
    const rel = raw.series.map(s => ({ name: s.name, values: s.values.map(v => v / s.values[0]) }));
    const delta = raw.series.map(s => ({ name: s.name, values: s.values.map(v => v - s.values[0]) }));

    return { cycles: raw.cycles, corrected, raw, relative: rel, delta };
}

// ----------- Chart Drawing -----------

function drawAll(data) {
    charts.forEach(c => c.destroy());
    charts = [];

    charts.push(draw("chartCorrected", data.cycles, data.corrected.series));
    charts.push(draw("chartDelta", data.cycles, data.delta));
    charts.push(draw("chartRelative", data.cycles, data.relative));
    charts.push(draw("chartRaw", data.cycles, data.raw.series));
}

function draw(id, cycles, dataset) {
    const colors = {
        "R": "rgba(255,0,0,.9)",
        "G": "rgba(0,150,0,.9)",
        "B": "rgba(0,0,255,.9)"
    };

    return new Chart(document.getElementById(id), {
        type: "line",
        data: {
            labels: cycles,
            datasets: dataset.map(s => ({
                label: s.name,
                data: s.values,
                borderColor: colors[s.name] || "black",
                tension: .2,
                fill: false
            }))
        },
        options: {
            plugins: {
                tooltip: {
                    callbacks: {
                        label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(3)}`
                    }
                }
            }
        }
    });
}

// ----------- Table Rendering -----------

function renderTable({ cycles, corrected, raw }) {
    const div = document.getElementById("tableContainer");

    let html = `<table><tr><th>Channel</th>${cycles.map(c => `<th>${c}</th>`).join("")}</tr>`;

    corrected.series.forEach(s => {
        html += `<tr><td>${escapeHtml(s.name)} (Corrected)</td>${s.values.map(v => `<td>${v}</td>`).join("")}</tr>`;
    });

    raw.series.forEach(s => {
        html += `<tr><td>${escapeHtml(s.name)} (Raw)</td>${s.values.map(v => `<td>${v}</td>`).join("")}</tr>`;
    });

    html += "</table>";
    div.innerHTML = html;
}

// ----------- Meta Rendering -----------

function renderMeta(meta) {
    const table = document.getElementById("metaTable");
    table.innerHTML = Object.entries(meta)
        .map(([k, v]) => `<tr><td>${escapeHtml(k)}</td><td>${escapeHtml(v)}</td></tr>`)
        .join("");
}

// ----------- Tab Switch -----------

document.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
        document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));

        btn.classList.add("active");
        document.getElementById(btn.dataset.target).classList.add("active");
    });
});

// ----------- small utilities -----------

function escapeHtml(str) {
    return String(str)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}
