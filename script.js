let charts = [];

// ----------- File Input Handler ----------
document.getElementById("fileInput").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    document.getElementById("status").textContent = "読み込み中...";

    const text = await file.text();
    const parsed = parseCSV(text);

    const dataset = compute(parsed);

    drawAll(dataset);
    renderTable(dataset);
    renderMeta(parsed.meta);

    document.getElementById("status").textContent = "✔ Completed";
});


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
        html += `<tr><td>${s.name} (Corrected)</td>${s.values.map(v => `<td>${v}</td>`).join("")}</tr>`;
    });

    raw.series.forEach(s => {
        html += `<tr><td>${s.name} (Raw)</td>${s.values.map(v => `<td>${v}</td>`).join("")}</tr>`;
    });

    html += "</table>";
    div.innerHTML = html;
}


// ----------- Meta Rendering -----------

function renderMeta(meta) {
    const table = document.getElementById("metaTable");
    table.innerHTML = Object.entries(meta)
        .map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join("");
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
