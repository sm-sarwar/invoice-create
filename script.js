(function () {
  "use strict";

  /* ---------- helpers ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const SHOP_NAME = "Puzzle Bazaar Bangladesh";
  const CUBE_COLORS = [
    "#ffffff",
    "#B7E8E1",
    "#E0663E",
    "#B7E8E1",
    "#079E8D",
    "#ffffff",
    "#E0663E",
    "#ffffff",
    "#B7E8E1",
  ];

  const store = {
    get(k, d) {
      try {
        const v = localStorage.getItem(k);
        return v === null ? d : JSON.parse(v);
      } catch (e) {
        return d;
      }
    },
    set(k, v) {
      try {
        localStorage.setItem(k, JSON.stringify(v));
      } catch (e) {}
    },
  };

  const esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const escBr = (s) => esc(s).replace(/\n/g, "<br>");
  const num = (v) => {
    const n = parseFloat(v);
    return isFinite(n) && n > 0 ? n : 0;
  };
  const qtyOf = (i) => Math.max(1, parseInt(i.qty, 10) || 1);
  const money = (n) =>
    "৳" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
  const uid = () => Math.random().toString(36).slice(2, 9);
  const todayISO = () => {
    const d = new Date();
    return (
      d.getFullYear() +
      "-" +
      String(d.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(d.getDate()).padStart(2, "0")
    );
  };
  const fmtDate = (iso) => {
    if (!iso) return "";
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  function cubeHTML(cls) {
    return (
      `<div class="${cls}">` +
      CUBE_COLORS.map((c) => `<span style="background:${c}"></span>`).join("") +
      "</div>"
    );
  }
  $("#hdr-cube").innerHTML = CUBE_COLORS.map(
    (c) => `<span style="background:${c}"></span>`,
  ).join("");

  let toastTimer;
  function toast(msg, isError) {
    const t = $("#toast");
    t.textContent = msg;
    t.className = "show" + (isError ? " error" : "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.className = ""), 3200);
  }

  /* ---------- state ---------- */
  const newItem = () => ({
    id: uid(),
    name: "",
    price: "",
    qty: 1,
    img: "",
  });
  let items = [newItem()];
  let logo = store.get("pb_logo", "");
  let lastSuggested = "";

  /* ---------- image processing ---------- */
  function readImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = reader.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
  // product photo -> centered square crop, 360px JPEG (keeps the PDF small)
  async function productImage(file) {
    const img = await readImage(file);
    const size = 360,
      s = Math.min(img.width, img.height);
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(
      img,
      (img.width - s) / 2,
      (img.height - s) / 2,
      s,
      s,
      0,
      0,
      size,
      size,
    );
    return c.toDataURL("image/jpeg", 0.88);
  }
  // logo -> keep aspect ratio and transparency, max height 160px
  async function logoImage(file) {
    const img = await readImage(file);
    const k = Math.min(1, 160 / img.height, 480 / img.width);
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * k);
    c.height = Math.round(img.height * k);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/png");
  }

  /* ---------- invoice number ---------- */
  function suggestNo() {
    const c = store.get("pb_counter", 0) + 1;
    return (
      "PB-" + todayISO().replace(/-/g, "") + "-" + String(c).padStart(3, "0")
    );
  }

  /* ---------- product list (form side) ---------- */
  function renderProducts() {
    $("#products").innerHTML = items
      .map(
        (it) => `
      <div class="prod" data-id="${it.id}">
        <label class="img-drop ${it.img ? "has" : ""}" title="Upload product image">
          <input type="file" accept="image/*" class="p-file" hidden>
          ${
            it.img
              ? `<img src="${it.img}" alt="">`
              : `<span class="img-ph"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg><small>Photo</small></span>`
          }
        </label>
        <div class="prod-fields">
          <input type="text" class="p-name" placeholder="Product name" value="${esc(it.name)}">
          <div class="row2">
            <div class="money"><span>৳</span><input type="number" class="p-price" min="0" step="any" inputmode="decimal" placeholder="Price" value="${esc(it.price)}"></div>
            <div class="qty">
              <button type="button" class="q-minus" aria-label="Decrease quantity">−</button>
              <input type="number" class="p-qty" min="1" step="1" value="${it.qty}" aria-label="Quantity">
              <button type="button" class="q-plus" aria-label="Increase quantity">+</button>
            </div>
          </div>
        </div>
        <button type="button" class="remove" title="Remove product" ${items.length === 1 ? "disabled" : ""}>✕</button>
      </div>`,
      )
      .join("");
  }

  const productsBox = $("#products");
  const itemOf = (el) =>
    items.find((i) => i.id === el.closest(".prod").dataset.id);

  productsBox.addEventListener("input", (e) => {
    const it = itemOf(e.target);
    if (!it) return;
    if (e.target.classList.contains("p-name")) it.name = e.target.value;
    if (e.target.classList.contains("p-price")) it.price = e.target.value;
    if (e.target.classList.contains("p-qty")) it.qty = e.target.value;
    renderInvoice();
  });

  productsBox.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const row = btn.closest(".prod");
    const it = itemOf(btn);
    if (btn.classList.contains("remove") && items.length > 1) {
      items = items.filter((i) => i.id !== it.id);
      renderProducts();
      renderInvoice();
    }
    if (btn.classList.contains("q-plus") || btn.classList.contains("q-minus")) {
      const d = btn.classList.contains("q-plus") ? 1 : -1;
      it.qty = Math.max(1, qtyOf(it) + d);
      row.querySelector(".p-qty").value = it.qty;
      renderInvoice();
    }
  });

  productsBox.addEventListener("change", async (e) => {
    if (!e.target.classList.contains("p-file")) return;
    const file = e.target.files && e.target.files[0];
    const it = itemOf(e.target);
    if (!file || !it) return;
    try {
      it.img = await productImage(file);
      renderProducts();
      renderInvoice();
    } catch (err) {
      toast("Could not read that image. Try a JPG or PNG file.", true);
    }
  });

  $("#btn-add").addEventListener("click", () => {
    items.push(newItem());
    renderProducts();
    renderInvoice();
    const rows = productsBox.querySelectorAll(".prod");
    const last = rows[rows.length - 1];
    if (last) last.querySelector(".p-name").focus();
  });

  /* ---------- shop settings ---------- */
  function shopInfo() {
    return {
      tagline: $("#shop-tagline").value.trim(),
      phone: $("#shop-phone").value.trim(),
      email: $("#shop-email").value.trim(),
      address: $("#shop-address").value.trim(),
    };
  }
  function loadShop() {
    const s = store.get("pb_shop", {
      tagline: "A Trusted Online Cube Shop",
      phone: "",
      email: "",
      address: "",
    });
    $("#shop-tagline").value = s.tagline || "";
    $("#shop-phone").value = s.phone || "";
    $("#shop-email").value = s.email || "";
    $("#shop-address").value = s.address || "";
    renderLogoThumb();
  }
  function renderLogoThumb() {
    $("#logo-thumb").innerHTML = logo
      ? `<img src="${logo}" alt="Logo">`
      : cubeHTML("cube").replace(
          'class="cube"',
          'class="cube" style="width:30px;height:30px"',
        );
    $("#logo-remove").style.display = logo ? "inline" : "none";
  }
  ["#shop-tagline", "#shop-phone", "#shop-email", "#shop-address"].forEach(
    (sel) => {
      $(sel).addEventListener("input", () => {
        store.set("pb_shop", shopInfo());
        renderInvoice();
      });
    },
  );
  $("#shop-logo").addEventListener("change", async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      logo = await logoImage(file);
      store.set("pb_logo", logo);
      renderLogoThumb();
      renderInvoice();
    } catch (err) {
      toast("Could not read that logo image.", true);
    }
  });
  $("#logo-remove").addEventListener("click", () => {
    logo = "";
    store.set("pb_logo", "");
    renderLogoThumb();
    renderInvoice();
  });

  /* ---------- invoice (preview + PDF source) ---------- */
  function renderInvoice() {
    const cust = {
      name: $("#cust-name").value.trim(),
      phone: $("#cust-phone").value.trim(),
      address: $("#cust-address").value.trim(),
    };
    const no = $("#inv-no").value.trim();
    const date = fmtDate($("#inv-date").value);
    const delivery = num($("#delivery").value);
    const discount = num($("#discount").value);
    const paid = num($("#paid").value);
    const method = $("#method").value;
    const notes = $("#notes").value.trim();
    const shop = shopInfo();

    const rows = items.filter((i) => i.name.trim() || num(i.price) > 0);
    const subtotal = rows.reduce((a, i) => a + num(i.price) * qtyOf(i), 0);
    const count = rows.reduce((a, i) => a + qtyOf(i), 0);
    const total = Math.max(subtotal + delivery - discount, 0);
    const due = Math.max(total - paid, 0);

    let status = "unpaid",
      label = "UNPAID";
    if (total > 0 && paid >= total) {
      status = "paid";
      label = "PAID";
    } else if (paid > 0) {
      status = "partial";
      label = "PARTIALLY PAID";
    }

    $("#mini-count").textContent = count;
    $("#mini-subtotal").textContent = money(subtotal);

    const logoHTML = logo
      ? `<div class="inv-logo-chip"><img src="${logo}" alt=""></div>`
      : `<div class="inv-logo-chip"><img src="favicon.png"></div>`;

    const rowsHTML = rows.length
      ? rows
          .map(
            (i, idx) => `
      <tr>
        <td class="c" style="color:#8AA09D;width:30px;">${idx + 1}</td>
        <td style="width:70px;">${i.img ? `<img class="thumb" src="${i.img}" alt="">` : '<div class="thumb-empty"></div>'}</td>
        <td class="pname">${esc(i.name.trim()) || '<span class="inv-muted">Untitled product</span>'}</td>
        <td class="r">${money(num(i.price))}</td>
        <td class="c">${qtyOf(i)}</td>
        <td class="r" style="font-weight:700;">${money(num(i.price) * qtyOf(i))}</td>
      </tr>`,
          )
          .join("")
      : `<tr><td colspan="6" class="inv-empty">Products you add will appear here</td></tr>`;

    const contact = [shop.phone, shop.email, shop.address]
      .filter(Boolean)
      .map(esc)
      .join(" &nbsp;•&nbsp; ");

    $("#invoice").innerHTML = `
      <div class="inv-watermark" aria-hidden="true">
        <div class="wm-inner">
          <div class="wm-cube"> <img src="favicon.png" alt="Logo"> </div>
          <div class="wm-1">PUZZLEBAZAAR</div>
          <div class="wm-2">BANGLADESH</div>
        </div>
      </div>

      <div class="inv-top">
        <div class="inv-brand">
          ${logoHTML}
          <div>
            <div class="inv-shop">${SHOP_NAME}</div>
            ${shop.tagline ? `<div class="inv-tag">${esc(shop.tagline)}</div>` : ""}
          </div>
        </div>
        <div class="inv-title">
          <div class="inv-word">INVOICE</div>
          <div class="inv-no">${no ? "#" + esc(no) : ""}</div>
        </div>
      </div>

      <div class="inv-body">
        <div class="inv-meta">
          <div class="inv-meta-box" style="flex:1.5;">
            <div class="inv-label">Billed to</div>
            <div class="v ${cust.name ? "" : "inv-muted"}">${cust.name ? esc(cust.name) : "Customer name"}</div>
            <div class="s ${cust.phone ? "" : "inv-muted"}">${cust.phone ? esc(cust.phone) : "Phone number"}</div>
            ${cust.address ? `<div class="s">${escBr(cust.address)}</div>` : ""}
          </div>
          <div class="inv-meta-box">
            <div class="inv-label">Invoice date</div>
            <div class="v">${esc(date)}</div>
            <div class="s">${rows.length} product${rows.length === 1 ? "" : "s"} &middot; ${count} item${count === 1 ? "" : "s"}</div>
          </div>
          <div class="inv-meta-box">
            <div class="inv-label">Payment</div>
            <div class="v">${esc(method)}</div>
            <span class="badge ${status}">${label}</span>
          </div>
        </div>

        <table class="inv-table">
          <thead>
            <tr>
              <th class="c">#</th><th>Image</th><th>Product</th>
              <th class="r">Unit price</th><th class="c">Qty</th><th class="r">Amount</th>
            </tr>
          </thead>
          <tbody>${rowsHTML}</tbody>
        </table>

        <div class="inv-lower avoid-break">
          <div class="inv-notes">
            ${notes ? `<div class="inv-label">Notes</div><div class="txt">${escBr(notes)}</div>` : ""}
          </div>
          <div class="totals">
            <div class="t-row"><span>Subtotal</span><b>${money(subtotal)}</b></div>
            ${delivery ? `<div class="t-row"><span>Delivery charge</span><b>${money(delivery)}</b></div>` : ""}
            ${discount ? `<div class="t-row"><span>Discount</span><b>− ${money(discount)}</b></div>` : ""}
            <div class="t-grand"><span>Total</span><span>${money(total)}</span></div>
            <div class="t-row"><span>Amount paid</span><b>${money(paid)}</b></div>
            <div class="t-due ${due === 0 ? "clear" : ""}"><span>Balance due</span><span>${money(due)}</span></div>
          </div>
        </div>
      </div>

      <div class="inv-footer avoid-break">
        <div class="inv-sign">
          <div class="box">
            <div class="space">${sig ? `<img class="sig-img" src="${sig}" alt="">` : ""}</div>
            <div class="cap">Authorized signature</div>
            <div class="sub">${SHOP_NAME}</div>
          </div>
        </div>
        <div class="inv-thanks">
          <div class="t1">Thank you for shopping with ${SHOP_NAME}!</div>
          <div class="t2">আপনার কেনাকাটার জন্য ধন্যবাদ।</div>
          ${contact ? `<div class="inv-contact">${contact}</div>` : ""}
          
        </div>
      </div>`;

    fitPreview();
  }

  /* ---------- scale the A4 preview to fit its column ---------- */
  function fitPreview() {
    const stage = $("#stage"),
      inv = $("#invoice");
    const s = Math.min(1, stage.clientWidth / inv.offsetWidth);
    inv.style.transformOrigin = "top left";
    inv.style.transform = "scale(" + s + ")";
    stage.style.height = inv.offsetHeight * s + "px";
  }
  window.addEventListener("resize", fitPreview);
  if ("ResizeObserver" in window)
    new ResizeObserver(fitPreview).observe($("#stage"));
  if (document.fonts && document.fonts.ready)
    document.fonts.ready.then(fitPreview);

  /* ---------- signature pad ---------- */
  const pad = $("#sig-pad"),
    pctx = pad.getContext("2d"),
    sigWrap = $("#sig-wrap");
  let sig = store.get("pb_sign", "");
  let drawing = false,
    last = null;
  pctx.lineCap = "round";
  pctx.lineJoin = "round";
  pctx.lineWidth = 5;
  pctx.strokeStyle = "#0B2A55";

  const padPos = (e) => {
    const r = pad.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) * pad.width) / r.width,
      y: ((e.clientY - r.top) * pad.height) / r.height,
    };
  };
  // crop the drawing to its own bounding box so it sits neatly on the invoice
  function exportSig() {
    const w = pad.width,
      h = pad.height;
    const d = pctx.getImageData(0, 0, w, h).data;
    let x0 = w,
      y0 = h,
      x1 = -1,
      y1 = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (d[(y * w + x) * 4 + 3] > 10) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
    if (x1 < 0) return "";
    const m = 8;
    x0 = Math.max(0, x0 - m);
    y0 = Math.max(0, y0 - m);
    x1 = Math.min(w - 1, x1 + m);
    y1 = Math.min(h - 1, y1 + m);
    const c = document.createElement("canvas");
    c.width = x1 - x0 + 1;
    c.height = y1 - y0 + 1;
    c.getContext("2d").drawImage(
      pad,
      x0,
      y0,
      c.width,
      c.height,
      0,
      0,
      c.width,
      c.height,
    );
    return c.toDataURL("image/png");
  }
  function persistSig() {
    const keep = $("#sig-remember").checked;
    store.set("pb_sign_remember", keep);
    store.set("pb_sign", keep ? sig : "");
  }
  function commitSig() {
    sig = exportSig();
    sigWrap.classList.toggle("signed", !!sig);
    persistSig();
    renderInvoice();
  }
  pad.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    drawing = true;
    last = padPos(e);
    pad.setPointerCapture(e.pointerId);
    sigWrap.classList.add("drawing");
    pctx.beginPath();
    pctx.moveTo(last.x, last.y);
    pctx.lineTo(last.x + 0.01, last.y);
    pctx.stroke();
  });
  pad.addEventListener("pointermove", (e) => {
    if (!drawing) return;
    e.preventDefault();
    const p = padPos(e);
    pctx.beginPath();
    pctx.moveTo(last.x, last.y);
    pctx.lineTo(p.x, p.y);
    pctx.stroke();
    last = p;
  });
  const endStroke = () => {
    if (!drawing) return;
    drawing = false;
    sigWrap.classList.remove("drawing");
    commitSig();
  };
  pad.addEventListener("pointerup", endStroke);
  pad.addEventListener("pointercancel", endStroke);
  $("#sig-clear").addEventListener("click", () => {
    pctx.clearRect(0, 0, pad.width, pad.height);
    commitSig();
  });
  // upload a signature image: fit it on the pad, then knock out the paper background
  $("#sig-file").addEventListener("change", async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      const img = await readImage(file);
      const k = Math.min(
        (pad.width * 0.9) / img.width,
        (pad.height * 0.85) / img.height,
        1,
      );
      const w = Math.max(1, Math.round(img.width * k)),
        h = Math.max(1, Math.round(img.height * k));
      const x = Math.round((pad.width - w) / 2),
        y = Math.round((pad.height - h) / 2);
      pctx.clearRect(0, 0, pad.width, pad.height);
      pctx.drawImage(img, x, y, w, h);
      const data = pctx.getImageData(x, y, w, h);
      const px = data.data;
      for (let i = 0; i < px.length; i += 4) {
        const lum = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
        // light pixels (paper) become transparent, dark ink stays solid
        const a = Math.max(0, Math.min(1, (225 - lum) / 90));
        px[i + 3] = Math.round(px[i + 3] * a);
      }
      pctx.putImageData(data, x, y);
      commitSig();
      if (!sig)
        toast(
          "No signature found in that image. Try a darker photo on white paper.",
          true,
        );
    } catch (err) {
      toast("Could not read that image. Try a JPG or PNG file.", true);
    }
  });
  $("#sig-remember").checked = store.get("pb_sign_remember", true);
  $("#sig-remember").addEventListener("change", persistSig);
  // restore a remembered signature onto the pad
  if (sig) {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(
        (pad.width * 0.8) / img.width,
        (pad.height * 0.65) / img.height,
        1,
      );
      const w = img.width * k,
        h = img.height * k;
      pctx.drawImage(img, (pad.width - w) / 2, (pad.height - h) / 2, w, h);
      sigWrap.classList.add("signed");
    };
    img.src = sig;
  }

  /* ---------- live updates from simple inputs ---------- */
  [
    "#inv-no",
    "#inv-date",
    "#cust-name",
    "#cust-phone",
    "#cust-address",
    "#delivery",
    "#discount",
    "#paid",
    "#method",
    "#notes",
  ].forEach((sel) => {
    $(sel).addEventListener("input", () => {
      $(sel).classList.remove("invalid");
      renderInvoice();
    });
    $(sel).addEventListener("change", renderInvoice);
  });

  /* ---------- validation ---------- */
  function fail(msg, sel) {
    toast(msg, true);
    if (sel) {
      const el = $(sel);
      el.classList.add("invalid");
      el.focus();
    }
    return false;
  }
  function validate() {
    if (!$("#cust-name").value.trim())
      return fail("Please enter the customer name.", "#cust-name");
    if (!$("#cust-phone").value.trim())
      return fail("Please enter the customer phone number.", "#cust-phone");
    const ok = items.filter((i) => i.name.trim() && num(i.price) > 0);
    if (!ok.length)
      return fail("Add at least one product with a name and a price.");
    return true;
  }

  /* ---------- PDF download ---------- */
  async function download() {
    if (!validate()) return;
    if (typeof html2pdf === "undefined") {
      toast(
        "PDF library could not load. Check your internet connection and reload.",
        true,
      );
      return;
    }
    const btn = $("#btn-download"),
      label = $("#dl-label");
    btn.disabled = true;
    label.textContent = "Generating PDF…";
    try {
      if (document.fonts && document.fonts.ready) await document.fonts.ready;

      const clone = $("#invoice").cloneNode(true);
      clone.removeAttribute("id");
      clone.style.transform = "none";
      clone.style.transformOrigin = "";

      const no = $("#inv-no").value.trim() || "invoice";
      const fileName = "Invoice-" + no.replace(/[^a-z0-9\-_]+/gi, "_") + ".pdf";

      await html2pdf()
        .set({
          margin: 0,
          filename: fileName,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: {
            scale: 2,
            useCORS: true,
            backgroundColor: "#ffffff",
            scrollX: 0,
            scrollY: 0,
          },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
          pagebreak: {
            mode: ["css", "legacy"],
            avoid: ["tr", ".avoid-break"],
          },
        })
        .from(clone)
        .save();

      // advance the invoice number only if the user kept the suggested one
      if (no === lastSuggested) {
        store.set("pb_counter", store.get("pb_counter", 0) + 1);
        lastSuggested = suggestNo();
        $("#inv-no").value = lastSuggested;
        renderInvoice();
      }
      toast("Invoice downloaded ✓");
    } catch (err) {
      console.error(err);
      toast(
        "Something went wrong while creating the PDF. Please try again.",
        true,
      );
    } finally {
      btn.disabled = false;
      label.textContent = "Download invoice PDF";
    }
  }
  $("#btn-download").addEventListener("click", download);

  /* ---------- reset ---------- */
  function resetForm() {
    [
      "#cust-name",
      "#cust-phone",
      "#cust-address",
      "#delivery",
      "#discount",
      "#paid",
      "#notes",
    ].forEach((s) => {
      $(s).value = "";
      $(s).classList.remove("invalid");
    });
    $("#method").selectedIndex = 0;
    $("#inv-date").value = todayISO();
    lastSuggested = suggestNo();
    $("#inv-no").value = lastSuggested;
    items = [newItem()];
    renderProducts();
    renderInvoice();
  }
  $("#btn-reset").addEventListener("click", () => {
    if (confirm("Clear the whole form and start a new invoice?")) resetForm();
  });

  /* ---------- init ---------- */
  loadShop();
  $("#inv-date").value = todayISO();
  lastSuggested = suggestNo();
  $("#inv-no").value = lastSuggested;
  renderProducts();
  renderInvoice();
})();
