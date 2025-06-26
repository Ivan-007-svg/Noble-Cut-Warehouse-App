import React, { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import * as XLSX from "xlsx"; // <-- NEW

// Helper: Format cut date as "dd.mm.yyyy hh:mm"
function formatCutDate(cutDateString) {
  if (!cutDateString || cutDateString === "-") return "-";
  try {
    const date = new Date(cutDateString);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${day}.${month}.${year} ${hours}:${minutes}`;
  } catch {
    return cutDateString;
  }
}

function isCutStatus(status) {
  if (!status) return false;
  const s = status.trim().toLowerCase();
  return (
    s === "in stitching" ||
    s === "qc" ||
    s.startsWith("qc-recontrol") ||
    s === "packing" ||
    s === "delivered"
  );
}

const gold = "#dab253";

// --- Expanded row details ---
function ExpandedRow({ order, onClose }) {
  const [recuts, setRecuts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch recuts from subcollection (live)
    const fetchRecuts = async () => {
      if (!order || !order.id) return setLoading(false);
      try {
        const recutsSnap = await getDocs(collection(db, "orders", order.id, "recuts"));
        const recutsList = [];
        recutsSnap.forEach(docSnap => {
          recutsList.push({ ...docSnap.data(), id: docSnap.id });
        });
        recutsList.sort((a, b) => new Date(a.timestamp || a.date || 0) - new Date(b.timestamp || b.date || 0));
        setRecuts(recutsList);
      } catch {
        setRecuts([]);
      }
      setLoading(false);
    };
    fetchRecuts();
  }, [order]);

  // Show only initial cut (not including recuts)
  const getInitialCut = () => {
    const totalCut =
      Number(order.actualConsumedMeters) ||
      Number(order.actualConsumed) ||
      Number(order.actualCutMeters) ||
      0;
    const totalRecuts = recuts.reduce(
      (sum, r) => sum + (Number(r.meters) || 0),
      0
    );
    if (totalCut && totalRecuts) {
      return (totalCut - totalRecuts);
    }
    return totalCut ? totalCut : "-";
  };

  return (
    <tr>
      <td colSpan={7} style={{ padding: 0, background: "transparent" }}>
        <div
          style={{
            margin: "8px 0 8px 0",
            padding: "22px 24px 18px 24px",
            background: "#191611",
            border: `2px solid ${gold}`,
            borderRadius: 18,
            boxShadow: "0 0 28px #0006",
            maxWidth: 550,
            marginLeft: "auto",
            marginRight: "auto",
            animation: "fadeIn 0.18s",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <h3
              style={{
                color: gold,
                fontSize: 23,
                fontWeight: 700,
                textAlign: "left",
                letterSpacing: 1,
                marginBottom: 7,
                fontFamily: "serif",
              }}
            >
              Cut & Recut Details
            </h3>
            <button
              onClick={onClose}
              style={{
                background: gold,
                color: "#111",
                border: "none",
                fontWeight: 600,
                fontSize: 17,
                borderRadius: 7,
                padding: "4px 16px",
                marginLeft: 16,
                minWidth: 72,
                cursor: "pointer",
                boxShadow: "0 1px 7px #222a",
              }}
            >
              Close
            </button>
          </div>
          <div
            style={{
              color: "#fff",
              background: "#222",
              borderRadius: 10,
              padding: "10px 13px",
              marginBottom: 14,
              fontSize: 16,
              border: `1px solid ${gold}`,
            }}
          >
            <div>
              <span style={{ color: gold, fontWeight: 600 }}>Order ID:</span> {order.id}
            </div>
            <div>
              <span style={{ color: gold, fontWeight: 600 }}>Client:</span>{" "}
              {order["Client Name"] || order.Client || "-"}
            </div>
            <div>
              <span style={{ color: gold, fontWeight: 600 }}>Initial Cut:</span>{" "}
              {getInitialCut() && !isNaN(getInitialCut())
                ? Number(getInitialCut()).toFixed(2)
                : getInitialCut()} m
            </div>
            <div>
              <span style={{ color: gold, fontWeight: 600 }}>Cut Date:</span>{" "}
              {formatCutDate(
                order.cutDate ||
                  order["Cut Date"] ||
                  order.cuttingDate ||
                  order.cut_date ||
                  order.dateCut ||
                  "-"
              )}
            </div>
          </div>

          <div>
            <div
              style={{
                color: gold,
                fontWeight: 600,
                marginBottom: 4,
                fontSize: 16,
                letterSpacing: 0.2,
              }}
            >
              Recuts ({loading ? "…" : recuts.length})
            </div>
            {loading && (
              <div style={{ color: "#aaa", fontSize: 16, margin: "13px 0" }}>
                Loading…
              </div>
            )}
            {!loading && recuts.length === 0 && (
              <div style={{ color: "#aaa", fontSize: 16, margin: "11px 0" }}>
                No recuts for this order.
              </div>
            )}
            {!loading && recuts.length > 0 && (
              <div style={{ maxHeight: 185, overflowY: "auto", marginTop: 3 }}>
                <table style={{ width: "100%", background: "transparent" }}>
                  <thead>
                    <tr>
                      <th style={{ color: gold, fontWeight: 500, fontSize: 15, textAlign: "left" }}>Date</th>
                      <th style={{ color: gold, fontWeight: 500, fontSize: 15, textAlign: "left" }}>Meters</th>
                      <th style={{ color: gold, fontWeight: 500, fontSize: 15, textAlign: "left" }}>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recuts.map((rec, idx) => (
                      <tr key={rec.id || idx}>
                        <td style={{ color: "#fff", fontSize: 15 }}>
                          {rec.timestamp
                            ? formatCutDate(rec.timestamp)
                            : rec.date
                            ? formatCutDate(rec.date)
                            : "-"}
                        </td>
                        <td style={{ color: gold, fontSize: 15, fontWeight: 600 }}>
                          {rec.meters && !isNaN(rec.meters)
                            ? Number(rec.meters).toFixed(2)
                            : rec.meters} m
                        </td>
                        <td style={{ color: "#fff", fontSize: 15 }}>{rec.reason || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}

// --- EXCEL EXPORT ---
async function fetchRecutsForOrder(orderId) {
  try {
    const recutsSnap = await getDocs(collection(db, "orders", orderId, "recuts"));
    const recutsList = [];
    recutsSnap.forEach(docSnap => {
      recutsList.push({ ...docSnap.data(), id: docSnap.id });
    });
    recutsList.sort((a, b) => new Date(a.timestamp || a.date || 0) - new Date(b.timestamp || b.date || 0));
    return recutsList;
  } catch {
    return [];
  }
}

async function exportToExcel(orders) {
  // Fetch all recuts for all orders
  const exportRows = [];
  for (let order of orders) {
    // Get recuts for order
    const recuts = await fetchRecutsForOrder(order.id);
    // Calculate initial cut
    const totalCut =
      Number(order.actualConsumedMeters) ||
      Number(order.actualConsumed) ||
      Number(order.actualCutMeters) ||
      0;
    const totalRecuts = recuts.reduce((sum, r) => sum + (Number(r.meters) || 0), 0);
    const initialCut = totalCut && totalRecuts ? (totalCut - totalRecuts) : totalCut ? totalCut : "";

    if (recuts.length === 0) {
      exportRows.push({
        "Order ID": order.id || "",
        "Client": order["Client Name"] || order.Client || "",
        "Fabric Code": order["Fabric Code"] || order.FabricCode || "",
        "Roll #": order["Assigned Rolls"]?.[0]?.rollNumber ||
                 order.RollNumber ||
                 order["Roll #"] ||
                 "",
        "Initial Cut (m)": initialCut && !isNaN(initialCut) ? Number(initialCut).toFixed(2) : "",
        "Cut Date & Time": formatCutDate(order.cutDate ||
                  order["Cut Date"] ||
                  order.cuttingDate ||
                  order.cut_date ||
                  order.dateCut ||
                  ""),
        "Recut #": "",
        "Recut Date & Time": "",
        "Recut Meters": "",
        "Recut Reason": ""
      });
    } else {
      recuts.forEach((rec, idx) => {
        exportRows.push({
          "Order ID": order.id || "",
          "Client": order["Client Name"] || order.Client || "",
          "Fabric Code": order["Fabric Code"] || order.FabricCode || "",
          "Roll #": order["Assigned Rolls"]?.[0]?.rollNumber ||
                   order.RollNumber ||
                   order["Roll #"] ||
                   "",
          "Initial Cut (m)": initialCut && !isNaN(initialCut) ? Number(initialCut).toFixed(2) : "",
          "Cut Date & Time": formatCutDate(order.cutDate ||
                    order["Cut Date"] ||
                    order.cuttingDate ||
                    order.cut_date ||
                    order.dateCut ||
                    ""),
          "Recut #": idx + 1,
          "Recut Date & Time": rec.timestamp
            ? formatCutDate(rec.timestamp)
            : rec.date
            ? formatCutDate(rec.date)
            : "",
          "Recut Meters": rec.meters && !isNaN(rec.meters)
            ? Number(rec.meters).toFixed(2)
            : rec.meters || "",
          "Recut Reason": rec.reason || ""
        });
      });
    }
  }

  // Build worksheet and workbook
  const ws = XLSX.utils.json_to_sheet(exportRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Cut Orders");

  // Download
  XLSX.writeFile(wb, `CutOrders_${new Date().toISOString().slice(0,10)}.xlsx`);
}

// --- MAIN PAGE ---
const CutOrdersPage = () => {
  const [orders, setOrders] = useState([]);
  const [expandedOrderId, setExpandedOrderId] = useState(null);

  useEffect(() => {
    const fetchCutOrders = async () => {
      const q = collection(db, "orders");
      const snapshot = await getDocs(q);
      const allOrders = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (isCutStatus(data.Status)) {
          allOrders.push({ ...data, id: doc.id });
        }
      });
      setOrders(allOrders);
    };
    fetchCutOrders();
  }, []);

  const getRollNumber = (order) =>
    order["Assigned Rolls"]?.[0]?.rollNumber ||
    order.RollNumber ||
    order["Roll #"] ||
    "-";

  const getCutMeters = (order) =>
    order.actualConsumedMeters ||
    order.actualConsumed ||
    order.actualCutMeters ||
    "-";

  const getCutDate = (order) =>
    formatCutDate(
      order.cutDate ||
        order["Cut Date"] ||
        order.cuttingDate ||
        order.cut_date ||
        order.dateCut ||
        "-"
    );

  return (
    <div style={{ minHeight: "100vh", background: "#131313" }}>
      <div style={{ textAlign: "center", padding: "6px 0 0" }}>
        <h2
          style={{
            color: gold,
            fontFamily: "serif",
            fontWeight: 600,
            margin: "8px 0 12px",
            fontSize: 32,
            letterSpacing: 1,
            textAlign: "center",
          }}
        >
          Cut Orders
        </h2>
        {/* --- Export to Excel Button --- */}
        <button
          onClick={() => exportToExcel(orders)}
          style={{
            marginTop: 12,
            marginBottom: 10,
            background: gold,
            color: "#181818",
            border: "none",
            fontWeight: 600,
            fontSize: 17,
            borderRadius: 10,
            padding: "9px 32px",
            cursor: "pointer",
            boxShadow: "0 2px 14px #222a",
            letterSpacing: "0.5px"
          }}
        >
          Export to Excel
        </button>
      </div>
      <div
        style={{
          background: "#181818",
          margin: "0 auto",
          borderRadius: 22,
          boxShadow: "0 0 24px #0007",
          maxWidth: 950,
          padding: "36px 26px 36px 26px",
          marginBottom: 48,
        }}
      >
        <div style={{ overflowX: "auto", position: "relative" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", background: "transparent" }}>
            <thead>
              <tr style={{ color: gold, fontWeight: 700, fontSize: 18 }}>
                <th style={{ textAlign: "left" }}>Order ID</th>
                <th>Client</th>
                <th>Fabric Code</th>
                <th>Roll #</th>
                <th>Cut (mtrs)</th>
                <th>Cut Date</th>
                <th style={{ textAlign: "center" }}>Details</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    style={{
                      color: gold,
                      fontSize: 20,
                      padding: "32px 0",
                      textAlign: "center",
                    }}
                  >
                    No cut orders found.
                  </td>
                </tr>
              )}
              {orders.map((order) => (
                <React.Fragment key={order.id || order["Order ID"]}>
                  <tr
                    style={{
                      color: gold,
                      fontSize: 17,
                      borderTop: "1px solid #222",
                      position: "relative",
                    }}
                  >
                    <td style={{ fontWeight: 500 }}>
                      {order.id || order["Order ID"]}
                    </td>
                    <td>{order["Client Name"] || order.Client || "-"}</td>
                    <td>{order["Fabric Code"] || order.FabricCode || "-"}</td>
                    <td>{getRollNumber(order)}</td>
                    <td>
                      {getCutMeters(order) && !isNaN(Number(getCutMeters(order)))
                        ? Number(getCutMeters(order)).toFixed(2)
                        : getCutMeters(order)}
                    </td>
                    <td>{getCutDate(order)}</td>
                    <td style={{ textAlign: "center", position: "relative" }}>
                      <button
                        onClick={() =>
                          setExpandedOrderId(
                            expandedOrderId === order.id ? null : order.id
                          )
                        }
                        style={{
                          background: gold,
                          color: "#111",
                          border: "none",
                          fontWeight: 600,
                          fontSize: 15,
                          borderRadius: 8,
                          padding: "4px 16px",
                          cursor: "pointer",
                          boxShadow: "0 1px 4px #222a",
                          transition: "background 0.15s",
                        }}
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                  {expandedOrderId === order.id && (
                    <ExpandedRow order={order} onClose={() => setExpandedOrderId(null)} />
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <style>{`
        th, td {
          padding: 9px 16px;
          text-align: left;
        }
        th {
          border-bottom: 2px solid ${gold};
        }
        tr {
          vertical-align: middle;
        }
        tr > td[colspan] {
          background: #222;
        }
        @keyframes fadeIn {
          from { opacity: 0 }
          to { opacity: 1 }
        }
      `}</style>
    </div>
  );
};

export default CutOrdersPage;
