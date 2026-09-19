import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, formatPrice } from "../api";
import { useAuth } from "../auth";
import type { Order } from "../types";

type DatePreset = "today" | "7d" | "month" | "all" | "custom";

function toDateInput(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dateKey(iso?: string): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

function inDateRange(iso: string | undefined, from: string, to: string): boolean {
  const key = dateKey(iso);
  if (!key) return false;
  if (from && key < from) return false;
  if (to && key > to) return false;
  return true;
}

function formatDisplayDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDisplayDateTime(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function rangeLabel(from: string, to: string, preset: DatePreset): string {
  if (preset === "all" || (!from && !to)) return "All time";
  if (from === to) return formatDisplayDate(from);
  return `${formatDisplayDate(from)} – ${formatDisplayDate(to)}`;
}

function getPresetRange(preset: DatePreset): { from: string; to: string } {
  const today = new Date();
  const to = toDateInput(today);
  if (preset === "today") return { from: to, to };
  if (preset === "7d") {
    const start = new Date(today);
    start.setDate(start.getDate() - 6);
    return { from: toDateInput(start), to };
  }
  if (preset === "month") {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    return { from: toDateInput(start), to };
  }
  return { from: "", to: "" };
}

export function OrdersPage() {
  const { token, ready } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState("");
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [noteNotify, setNoteNotify] = useState<Record<string, boolean>>({});
  const monthRange = getPresetRange("month");
  const [datePreset, setDatePreset] = useState<DatePreset>("month");
  const [fromDate, setFromDate] = useState(monthRange.from);
  const [toDate, setToDate] = useState(monthRange.to);

  useEffect(() => {
    if (!ready) return;
    if (!token) {
      navigate("/login");
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    api
      .myOrders()
      .then((data) => {
        if (!cancelled) setOrders(data);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        if (err.message.includes("finish creating")) {
          navigate("/signup");
          return;
        }
        setError(err.message || "Could not load orders.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, ready, navigate]);

  const summary = useMemo(() => {
    const from = datePreset === "all" ? "" : fromDate;
    const to = datePreset === "all" ? "" : toDate;
    const filtered = orders.filter((o) =>
      datePreset === "all" ? true : inDateRange(o.created_at, from, to),
    );
    const revenue = filtered.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    const quoteOrders = filtered.filter((o) => !(Number(o.total) > 0)).length;
    return {
      orders: filtered.length,
      revenue,
      quoteOrders,
      items: filtered,
      label: rangeLabel(from, to, datePreset),
    };
  }, [orders, datePreset, fromDate, toDate]);

  function applyPreset(preset: DatePreset) {
    setDatePreset(preset);
    const range = getPresetRange(preset);
    setFromDate(range.from);
    setToDate(range.to);
  }

  async function confirmOrder(order: Order) {
    const hasEmail = Boolean(order.buyer_email?.trim());
    const message = hasEmail
      ? `Confirm order ${order.reference}? The buyer will get an email that the order is confirmed.`
      : `Confirm order ${order.reference}? The buyer did not share an email, so no buyer email will be sent.`;
    if (!window.confirm(message)) return;
    setBusyId(order.id);
    setError("");
    setNotice("");
    try {
      const result = await api.confirmOrder(order.id);
      setOrders((items) =>
        items.map((item) => (item.id === order.id ? result.order : item)),
      );
      if (result.already_confirmed) {
        setNotice(`Order ${result.order.reference} was already confirmed.`);
      } else if (result.buyer_notified) {
        setNotice(`Order ${result.order.reference} confirmed. Buyer email sent.`);
      } else {
        setNotice(
          `Order ${result.order.reference} confirmed. No buyer email on file, so email was not sent.`,
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not confirm order.");
    } finally {
      setBusyId("");
    }
  }

  async function completeOrder(order: Order) {
    if (
      !window.confirm(
        `Mark order ${order.reference} as completed? The buyer will get an email if they shared one.`,
      )
    ) {
      return;
    }
    setBusyId(`complete:${order.id}`);
    setError("");
    setNotice("");
    try {
      const result = await api.completeOrder(order.id);
      setOrders((items) =>
        items.map((item) => (item.id === order.id ? result.order : item)),
      );
      setNotice(
        result.buyer_notified
          ? `Order ${result.order.reference} completed. Buyer email sent.`
          : `Order ${result.order.reference} completed.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not complete order.");
    } finally {
      setBusyId("");
    }
  }

  async function addNote(order: Order) {
    const message = (noteDrafts[order.id] || "").trim();
    if (!message) {
      setError("Enter an update note first.");
      return;
    }
    setBusyId(`note:${order.id}`);
    setError("");
    setNotice("");
    try {
      const result = await api.addOrderNote(order.id, {
        message,
        notify_buyer: Boolean(noteNotify[order.id]),
      });
      setOrders((items) =>
        items.map((item) => (item.id === order.id ? result.order : item)),
      );
      setNoteDrafts((current) => ({ ...current, [order.id]: "" }));
      setNotice(
        result.buyer_notified
          ? `Update added and emailed to the buyer.`
          : `Update added to order ${order.reference}.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add update.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="wrap orders-page">
      <div className="orders-head">
        <div>
          <h1>Orders</h1>
          <p className="lede">
            Pending → Confirm with buyer → Confirm here → Complete when done. Add updates anytime
            (optional email to buyer).
          </p>
        </div>
      </div>

      {error ? <div className="error">{error}</div> : null}
      {notice ? <div className="notice-banner">{notice}</div> : null}

      {loading ? (
        <p className="muted">Loading orders…</p>
      ) : (
        <>
          <div className="date-filter-bar">
            <div className="date-filter-left">
              <span className="date-filter-title">Summary period</span>
              <div className="date-presets">
                {(
                  [
                    ["today", "Today"],
                    ["7d", "Last 7 days"],
                    ["month", "This month"],
                    ["all", "All time"],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    className={datePreset === key ? "date-preset is-active" : "date-preset"}
                    onClick={() => applyPreset(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="date-filter-right">
              <label className="date-field">
                <span>From</span>
                <input
                  type="date"
                  value={fromDate}
                  max={toDate || undefined}
                  onChange={(e) => {
                    setDatePreset("custom");
                    setFromDate(e.target.value);
                  }}
                  disabled={datePreset === "all"}
                />
              </label>
              <label className="date-field">
                <span>To</span>
                <input
                  type="date"
                  value={toDate}
                  min={fromDate || undefined}
                  onChange={(e) => {
                    setDatePreset("custom");
                    setToDate(e.target.value);
                  }}
                  disabled={datePreset === "all"}
                />
              </label>
            </div>
          </div>

          <p className="overview-range-note">
            Showing metrics for <strong>{summary.label}</strong>
          </p>

          <div className="overview-metrics orders-metrics">
            <div className="metric-card metric-primary">
              <span className="metric-label">Orders</span>
              <strong className="metric-value">{summary.orders}</strong>
              <span className="metric-hint">
                {summary.quoteOrders > 0
                  ? `${summary.quoteOrders} contact-for-price`
                  : "In selected period"}
              </span>
            </div>
            <div className="metric-card metric-revenue">
              <span className="metric-label">Revenue</span>
              <strong className="metric-value">{formatPrice(summary.revenue)}</strong>
              <span className="metric-hint">Priced orders only</span>
            </div>
            <div className="metric-card">
              <span className="metric-label">All-time orders</span>
              <strong className="metric-value">{orders.length}</strong>
              <span className="metric-hint">Total received</span>
            </div>
          </div>

          <div className="overview-panel">
            <div className="overview-panel-head">
              <div>
                <h2>Orders in period</h2>
                <p>
                  {summary.items.length === 0
                    ? "No orders in this date range."
                    : `${summary.orders} order${summary.orders === 1 ? "" : "s"} matched`}
                </p>
              </div>
            </div>

            {summary.items.length === 0 ? (
              <p className="orders-empty">No orders for {summary.label}.</p>
            ) : (
              <>
                <div className="admin-table-wrap orders-desktop">
                  <table className="admin-table orders-table">
                    <thead>
                      <tr>
                        <th>Ref</th>
                        <th>Product</th>
                        <th>Buyer</th>
                        <th>Payment</th>
                        <th>Total</th>
                        <th>Date</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.items.map((order) => {
                        const status = (order.status || "pending").toLowerCase();
                        const isPending = status === "pending";
                        const isConfirmed = status === "confirmed";
                        const isCompleted = status === "completed";
                        return (
                          <tr key={order.id}>
                            <td>
                              <strong>{order.reference}</strong>
                              <div className="cell-sub">
                                <span
                                  className={
                                    isCompleted
                                      ? "status-pill active"
                                      : isConfirmed
                                        ? "status-pill active"
                                        : "status-pill pending"
                                  }
                                >
                                  {status}
                                </span>
                              </div>
                            </td>
                            <td>
                              {order.product_name}
                              {order.variant_label ? (
                                <div className="cell-sub">{order.variant_label}</div>
                              ) : null}
                              <div className="cell-sub">
                                Qty {order.quantity}
                                {order.product_code ? ` · ${order.product_code}` : ""}
                              </div>
                            </td>
                            <td>
                              {order.buyer_name}
                              <div className="cell-sub">{order.buyer_phone}</div>
                              {order.buyer_email ? (
                                <div className="cell-sub">{order.buyer_email}</div>
                              ) : (
                                <div className="cell-sub">No email</div>
                              )}
                              {order.note ? (
                                <div className="cell-sub">Note: {order.note}</div>
                              ) : null}
                            </td>
                            <td>{order.payment_method_label || order.payment_method || "—"}</td>
                            <td className="metric-money">
                              {order.total > 0 ? formatPrice(order.total) : order.total_label}
                            </td>
                            <td>{formatDisplayDateTime(order.created_at)}</td>
                            <td>
                              <div className="orders-action-stack">
                                {isPending ? (
                                  <button
                                    type="button"
                                    className="btn btn-clay btn-sm"
                                    disabled={busyId === order.id}
                                    onClick={() => void confirmOrder(order)}
                                  >
                                    {busyId === order.id ? "Confirming…" : "Confirm"}
                                  </button>
                                ) : null}
                                {isConfirmed ? (
                                  <button
                                    type="button"
                                    className="btn btn-outline btn-sm"
                                    disabled={busyId === `complete:${order.id}`}
                                    onClick={() => void completeOrder(order)}
                                  >
                                    {busyId === `complete:${order.id}` ? "Saving…" : "Complete"}
                                  </button>
                                ) : null}
                                {isCompleted ? <span className="muted">Completed</span> : null}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="orders-mobile">
                  {summary.items.map((order) => {
                    const status = (order.status || "pending").toLowerCase();
                    const isPending = status === "pending";
                    const isConfirmed = status === "confirmed";
                    const isCompleted = status === "completed";
                    const totalLabel =
                      order.total > 0 ? formatPrice(order.total) : order.total_label;
                    const timeline = order.timeline || [];
                    return (
                      <article
                        key={order.id}
                        className={
                          isCompleted || isConfirmed
                            ? "orders-mobile-card is-confirmed"
                            : "orders-mobile-card"
                        }
                      >
                        <div className="orders-mobile-top">
                          <div className="orders-mobile-ref">
                            <strong>{order.reference}</strong>
                            <span
                              className={
                                isPending ? "status-pill pending" : "status-pill active"
                              }
                            >
                              {status}
                            </span>
                          </div>
                          <strong className="orders-mobile-total">{totalLabel}</strong>
                        </div>

                        <div className="orders-mobile-product">
                          <span className="orders-mobile-name">{order.product_name}</span>
                          {order.variant_label ? (
                            <span className="orders-mobile-variant">{order.variant_label}</span>
                          ) : null}
                          <span className="orders-mobile-meta-line">
                            Qty {order.quantity}
                            {order.product_code ? ` · ${order.product_code}` : ""}
                          </span>
                        </div>

                        <dl className="orders-mobile-meta">
                          <div>
                            <dt>Buyer</dt>
                            <dd>{order.buyer_name}</dd>
                          </div>
                          <div>
                            <dt>Phone</dt>
                            <dd>
                              <a href={`tel:${order.buyer_phone}`}>{order.buyer_phone}</a>
                            </dd>
                          </div>
                          <div>
                            <dt>Email</dt>
                            <dd className="orders-mobile-email">
                              {order.buyer_email ? (
                                <a href={`mailto:${order.buyer_email}`}>{order.buyer_email}</a>
                              ) : (
                                "—"
                              )}
                            </dd>
                          </div>
                          <div>
                            <dt>Payment</dt>
                            <dd>{order.payment_method_label || order.payment_method || "—"}</dd>
                          </div>
                          <div>
                            <dt>Date</dt>
                            <dd>{formatDisplayDateTime(order.created_at)}</dd>
                          </div>
                          {order.note ? (
                            <div className="orders-mobile-note">
                              <dt>Note</dt>
                              <dd>{order.note}</dd>
                            </div>
                          ) : null}
                        </dl>

                        {timeline.length > 0 ? (
                          <div className="orders-timeline">
                            <h3>Updates</h3>
                            <ul>
                              {timeline
                                .slice()
                                .reverse()
                                .map((entry) => (
                                  <li key={entry.id || entry.created_at}>
                                    <strong>{entry.message}</strong>
                                    <span>
                                      {formatDisplayDateTime(entry.created_at)}
                                      {entry.buyer_notified ? " · emailed" : ""}
                                    </span>
                                  </li>
                                ))}
                            </ul>
                          </div>
                        ) : null}

                        <div className="orders-note-box">
                          <label>
                            Add update
                            <textarea
                              rows={2}
                              placeholder='e.g. Ready for pickup'
                              value={noteDrafts[order.id] || ""}
                              onChange={(e) =>
                                setNoteDrafts((current) => ({
                                  ...current,
                                  [order.id]: e.target.value,
                                }))
                              }
                            />
                          </label>
                          <label className="orders-note-check">
                            <input
                              type="checkbox"
                              checked={Boolean(noteNotify[order.id])}
                              onChange={(e) =>
                                setNoteNotify((current) => ({
                                  ...current,
                                  [order.id]: e.target.checked,
                                }))
                              }
                            />
                            Email this update to the buyer
                          </label>
                          <button
                            type="button"
                            className="btn btn-outline"
                            disabled={busyId === `note:${order.id}`}
                            onClick={() => void addNote(order)}
                          >
                            {busyId === `note:${order.id}` ? "Saving…" : "Post update"}
                          </button>
                        </div>

                        <div className="orders-mobile-actions">
                          {isPending ? (
                            <button
                              type="button"
                              className="btn btn-clay"
                              disabled={busyId === order.id}
                              onClick={() => void confirmOrder(order)}
                            >
                              {busyId === order.id ? "Confirming…" : "Confirm order"}
                            </button>
                          ) : null}
                          {isConfirmed ? (
                            <button
                              type="button"
                              className="btn btn-clay"
                              disabled={busyId === `complete:${order.id}`}
                              onClick={() => void completeOrder(order)}
                            >
                              {busyId === `complete:${order.id}`
                                ? "Saving…"
                                : "Mark completed"}
                            </button>
                          ) : null}
                          {isCompleted ? (
                            <span className="orders-mobile-confirmed-label">Order completed</span>
                          ) : null}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
